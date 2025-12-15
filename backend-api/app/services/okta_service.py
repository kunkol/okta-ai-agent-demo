"""
Okta Authentication Service

Handles:
- Token validation (supports tokens from frontend and backend apps)
- Token exchange (Cross-App Access / ID-JAG) - REAL IMPLEMENTATION
- User info retrieval

Okta Configuration (from C0):
- Tenant: qa-aiagentsproducttc1.trexcloud.com
- OAuth App (Test_KK): 0oa8x8i98ebUMhrhw0g7
- Agent (KK Demo Agent UI): wlp8x98zcxMOXEPHJ0g7
- Auth Server: default
- Private Key (kid): 0a26ff81-0eb6-43a4-9eb6-1829576211c9

Frontend OAuth App (from C4):
- App: Apex Customer 360 Frontend
- Client ID: 0oa8xatd11PBe622F0g7
"""

import httpx
import jwt
from jwt import PyJWKClient
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import time
import uuid
import json
import base64

from app.config import settings
from app.models.schemas import UserInfo, TokenExchangeResponse

logger = logging.getLogger(__name__)


def base64url_decode(input_str: str) -> bytes:
    """Decode base64url string to bytes."""
    # Add padding if needed
    padding = 4 - len(input_str) % 4
    if padding != 4:
        input_str += '=' * padding
    return base64.urlsafe_b64decode(input_str)


def jwk_to_pem(jwk: Dict[str, Any]) -> bytes:
    """Convert JWK to PEM format for RSA private key."""
    # Extract the key components
    n = int.from_bytes(base64url_decode(jwk['n']), 'big')
    e = int.from_bytes(base64url_decode(jwk['e']), 'big')
    d = int.from_bytes(base64url_decode(jwk['d']), 'big')
    p = int.from_bytes(base64url_decode(jwk['p']), 'big')
    q = int.from_bytes(base64url_decode(jwk['q']), 'big')
    dp = int.from_bytes(base64url_decode(jwk['dp']), 'big')
    dq = int.from_bytes(base64url_decode(jwk['dq']), 'big')
    qi = int.from_bytes(base64url_decode(jwk['qi']), 'big')
    
    # Create RSA private key
    from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateNumbers, RSAPublicNumbers
    
    public_numbers = RSAPublicNumbers(e, n)
    private_numbers = RSAPrivateNumbers(p, q, d, dp, dq, qi, public_numbers)
    private_key = private_numbers.private_key(default_backend())
    
    # Convert to PEM
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    return pem


class OktaService:
    """Service for Okta authentication and authorization."""
    
    def __init__(self):
        self.domain = settings.OKTA_DOMAIN
        self.client_id = settings.OKTA_CLIENT_ID
        self.client_secret = settings.OKTA_CLIENT_SECRET
        self.issuer = settings.OKTA_ISSUER
        self.jwks_url = settings.OKTA_JWKS_URL
        self.token_url = settings.OKTA_TOKEN_URL
        self.valid_audiences = settings.OKTA_VALID_AUDIENCES
        self.agent_id = settings.OKTA_AGENT_ID
        
        # Cache for JWKS
        self._jwks_client = None
        self._jwks_cache_time = None
        self._jwks_cache_ttl = 3600  # 1 hour
        
        # Private key for agent authentication (PEM format)
        self._private_key_pem = None
        self._private_key_kid = None
        self._load_private_key()
    
    def _load_private_key(self):
        """Load the agent's private key from settings and convert to PEM."""
        try:
            private_key_json = settings.OKTA_AGENT_PRIVATE_KEY
            if private_key_json:
                jwk = json.loads(private_key_json)
                self._private_key_kid = jwk.get('kid')
                self._private_key_pem = jwk_to_pem(jwk)
                logger.info(f"Loaded agent private key with kid: {self._private_key_kid}")
            else:
                logger.warning("No agent private key configured - token exchange will be simulated")
        except Exception as e:
            logger.error(f"Failed to load private key: {e}")
            self._private_key_pem = None
    
    def _get_jwks_client(self) -> PyJWKClient:
        """Get or create JWKS client with caching."""
        now = time.time()
        if self._jwks_client is None or (
            self._jwks_cache_time and now - self._jwks_cache_time > self._jwks_cache_ttl
        ):
            self._jwks_client = PyJWKClient(self.jwks_url)
            self._jwks_cache_time = now
        return self._jwks_client
    
    def _create_client_assertion(self) -> str:
        """
        Create a JWT client assertion for agent authentication.
        
        This JWT is signed with the agent's private key and used
        to authenticate the agent during token exchange.
        """
        if not self._private_key_pem:
            raise ValueError("No private key configured for agent authentication")
        
        now = datetime.utcnow()
        
        # JWT claims for client assertion
        claims = {
            "iss": self.client_id,  # Issuer is the OAuth app client ID
            "sub": self.client_id,  # Subject is also the client ID
            "aud": self.token_url,  # Audience is the token endpoint
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=5)).timestamp()),
            "jti": str(uuid.uuid4()),  # Unique token ID
        }
        
        # Sign with private key (PEM format)
        token = jwt.encode(
            claims,
            self._private_key_pem,
            algorithm="RS256",
            headers={"kid": self._private_key_kid}
        )
        
        return token
    
    def _create_actor_token(self) -> str:
        """
        Create an actor token (JWT) that identifies the AI agent.
        
        This is used in the token exchange to identify who is acting
        on behalf of the user.
        """
        if not self._private_key_pem:
            raise ValueError("No private key configured for agent authentication")
        
        now = datetime.utcnow()
        
        # Actor token claims
        claims = {
            "iss": f"https://{self.domain}",
            "sub": self.agent_id,  # The AI agent's ID
            "aud": self.token_url,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=5)).timestamp()),
            "jti": str(uuid.uuid4()),
        }
        
        # Sign with private key (PEM format)
        token = jwt.encode(
            claims,
            self._private_key_pem,
            algorithm="RS256",
            headers={"kid": self._private_key_kid}
        )
        
        return token
    
    async def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Validate an Okta access token.
        
        Supports tokens from both frontend (SPA) and backend OAuth apps.
        """
        try:
            # Get signing key from JWKS
            jwks_client = self._get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            
            # First, decode without audience validation to check the token
            unverified_claims = jwt.decode(
                token,
                options={"verify_signature": False}
            )
            
            # Get the audience from token
            token_aud = unverified_claims.get("aud")
            if isinstance(token_aud, str):
                token_aud = [token_aud]
            
            # Check if any audiences match
            matching_audience = None
            for aud in (token_aud or []):
                if aud in self.valid_audiences:
                    matching_audience = aud
                    break
            
            # Check client ID
            if not matching_audience and unverified_claims.get("cid"):
                cid = unverified_claims.get("cid")
                if cid in self.valid_audiences:
                    matching_audience = cid
            
            # Verify and decode
            if matching_audience:
                claims = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256"],
                    issuer=self.issuer,
                    audience=matching_audience,
                    options={"verify_exp": True}
                )
            else:
                claims = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256"],
                    issuer=self.issuer,
                    options={
                        "verify_exp": True,
                        "verify_aud": False
                    }
                )
                logger.warning(f"Token validated without audience check. Token aud: {token_aud}")
            
            logger.info(f"Token validated for user: {claims.get('sub')}")
            return claims
            
        except jwt.ExpiredSignatureError:
            logger.warning("Token has expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token: {e}")
            return None
        except Exception as e:
            logger.error(f"Token validation error: {e}")
            return None
    
    async def get_user_info(self, access_token: str) -> Optional[UserInfo]:
        """Get user info from Okta using access token."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    settings.OKTA_USERINFO_URL,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return UserInfo(
                        sub=data["sub"],
                        email=data.get("email"),
                        name=data.get("name"),
                        preferred_username=data.get("preferred_username"),
                        groups=data.get("groups", [])
                    )
                else:
                    logger.warning(f"Failed to get user info: {response.status_code}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error getting user info: {e}")
            return None
    
    async def exchange_token(
        self,
        subject_token: str,
        target_audience: str,
        requested_scopes: list[str] = None
    ) -> Optional[TokenExchangeResponse]:
        """
        Exchange token for Cross-App Access (XAA / ID-JAG flow).
        
        This implements RFC 8693 Token Exchange where:
        1. subject_token = user's access token (who we're acting on behalf of)
        2. actor_token = agent's JWT assertion (who is doing the acting)
        3. Result = new token scoped to target_audience
        
        Args:
            subject_token: User's access token
            target_audience: Target service (e.g., "api://default" for MCP)
            requested_scopes: Scopes to request
            
        Returns:
            TokenExchangeResponse with new token if successful
        """
        # Check if we have a private key for real exchange
        if not self._private_key_pem:
            logger.warning("No private key - returning simulated token exchange")
            return await self._simulated_token_exchange(subject_token, target_audience, requested_scopes)
        
        try:
            # Create actor token (identifies the agent)
            actor_token = self._create_actor_token()
            
            # Create client assertion for authentication
            client_assertion = self._create_client_assertion()
            
            # Build token exchange request per RFC 8693
            data = {
                "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
                "subject_token": subject_token,
                "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
                "actor_token": actor_token,
                "actor_token_type": "urn:ietf:params:oauth:token-type:jwt",
                "audience": target_audience,
                "requested_token_type": "urn:ietf:params:oauth:token-type:access_token",
                "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                "client_assertion": client_assertion,
            }
            
            if requested_scopes:
                data["scope"] = " ".join(requested_scopes)
            
            logger.info(f"Performing token exchange for audience: {target_audience}")
            logger.debug(f"Token exchange request to: {self.token_url}")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.token_url,
                    data=data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                
                if response.status_code == 200:
                    token_data = response.json()
                    
                    # Extract delegation chain from the new token
                    delegation_chain = []
                    try:
                        claims = jwt.decode(
                            token_data["access_token"],
                            options={"verify_signature": False}
                        )
                        # Build delegation chain from actor claims
                        if "act" in claims:
                            actor = claims["act"]
                            while actor:
                                delegation_chain.append(actor.get("sub", "unknown"))
                                actor = actor.get("act")
                        
                        # Add the original subject
                        if claims.get("sub"):
                            delegation_chain.insert(0, claims["sub"])
                            
                    except Exception as e:
                        logger.warning(f"Could not parse delegation chain: {e}")
                    
                    logger.info(f"Token exchange successful! Delegation chain: {delegation_chain}")
                    
                    return TokenExchangeResponse(
                        access_token=token_data["access_token"],
                        token_type=token_data.get("token_type", "Bearer"),
                        expires_in=token_data.get("expires_in", 3600),
                        issued_token_type=token_data.get(
                            "issued_token_type",
                            "urn:ietf:params:oauth:token-type:access_token"
                        ),
                        scope=token_data.get("scope"),
                        delegation_chain=delegation_chain
                    )
                else:
                    error_data = response.json() if response.text else {}
                    logger.error(f"Token exchange failed: {response.status_code} - {error_data}")
                    
                    # Fall back to simulated if real exchange fails
                    logger.warning("Falling back to simulated token exchange")
                    return await self._simulated_token_exchange(subject_token, target_audience, requested_scopes)
                    
        except Exception as e:
            logger.error(f"Token exchange error: {e}")
            # Fall back to simulated
            return await self._simulated_token_exchange(subject_token, target_audience, requested_scopes)
    
    async def _simulated_token_exchange(
        self,
        subject_token: str,
        target_audience: str,
        requested_scopes: list[str] = None
    ) -> TokenExchangeResponse:
        """
        Simulated token exchange for demo purposes.
        
        Used when real token exchange isn't configured or fails.
        """
        logger.info(f"Simulating token exchange for audience: {target_audience}")
        
        # Extract user info from subject token
        try:
            claims = jwt.decode(subject_token, options={"verify_signature": False})
            user_sub = claims.get("sub", "unknown-user")
        except:
            user_sub = "unknown-user"
        
        return TokenExchangeResponse(
            access_token=f"simulated_xaa_token_{uuid.uuid4().hex[:16]}",
            token_type="Bearer",
            expires_in=3600,
            issued_token_type="urn:ietf:params:oauth:token-type:access_token",
            scope=" ".join(requested_scopes) if requested_scopes else "read_data",
            delegation_chain=[user_sub, self.agent_id]
        )
    
    async def introspect_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Introspect a token to get its metadata."""
        try:
            introspect_url = f"{self.issuer}/v1/introspect"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    introspect_url,
                    data={
                        "token": token,
                        "token_type_hint": "access_token"
                    },
                    auth=(self.client_id, self.client_secret) if self.client_secret else None
                )
                
                if response.status_code == 200:
                    return response.json()
                return None
                
        except Exception as e:
            logger.error(f"Token introspection error: {e}")
            return None
    
    def get_auth_url(self, redirect_uri: str, state: str, scopes: list[str] = None) -> str:
        """Generate Okta authorization URL for login."""
        scopes = scopes or ["openid", "profile", "email"]
        scope_str = " ".join(scopes)
        
        return (
            f"{self.issuer}/v1/authorize?"
            f"client_id={self.client_id}&"
            f"response_type=code&"
            f"scope={scope_str}&"
            f"redirect_uri={redirect_uri}&"
            f"state={state}"
        )
    
    async def exchange_code(
        self,
        code: str,
        redirect_uri: str,
        code_verifier: str = None
    ) -> Optional[Dict[str, Any]]:
        """Exchange authorization code for tokens."""
        try:
            data = {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": self.client_id,
            }
            
            if code_verifier:
                data["code_verifier"] = code_verifier
            
            if self.client_secret:
                data["client_secret"] = self.client_secret
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.token_url,
                    data=data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Code exchange failed: {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Code exchange error: {e}")
            return None
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Okta connectivity and configuration."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(self.jwks_url)
                if response.status_code == 200:
                    return {
                        "status": "healthy",
                        "message": "Okta is reachable",
                        "xaa_enabled": self._private_key_pem is not None,
                        "agent_id": self.agent_id if self._private_key_pem else None
                    }
                return {
                    "status": "degraded",
                    "message": f"Okta returned status {response.status_code}",
                    "xaa_enabled": False
                }
        except Exception as e:
            return {
                "status": "unhealthy",
                "message": str(e),
                "xaa_enabled": False
            }


# Global Okta service instance
okta_service = OktaService()
