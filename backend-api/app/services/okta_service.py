"""
Okta Authentication Service

Handles:
- Token validation
- Token exchange (Cross-App Access / ID-JAG)
- User info retrieval

Okta Configuration (from C0):
- Tenant: qa-aiagentsproducttc1.trexcloud.com
- OAuth App: 0oa8x8i98ebUMhrhw0g7
- Agent: wlp8x98zcxMOXEPHJ0g7
- Auth Server: default
"""

import httpx
import jwt
from jwt import PyJWKClient
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import time

from app.config import settings
from app.models.schemas import UserInfo, TokenExchangeResponse

logger = logging.getLogger(__name__)


class OktaService:
    """Service for Okta authentication and authorization."""
    
    def __init__(self):
        self.domain = settings.OKTA_DOMAIN
        self.client_id = settings.OKTA_CLIENT_ID
        self.client_secret = settings.OKTA_CLIENT_SECRET
        self.issuer = settings.OKTA_ISSUER
        self.jwks_url = settings.OKTA_JWKS_URL
        self.token_url = settings.OKTA_TOKEN_URL
        
        # Cache for JWKS
        self._jwks_client = None
        self._jwks_cache_time = None
        self._jwks_cache_ttl = 3600  # 1 hour
    
    def _get_jwks_client(self) -> PyJWKClient:
        """Get or create JWKS client with caching."""
        now = time.time()
        if self._jwks_client is None or (
            self._jwks_cache_time and now - self._jwks_cache_time > self._jwks_cache_ttl
        ):
            self._jwks_client = PyJWKClient(self.jwks_url)
            self._jwks_cache_time = now
        return self._jwks_client
    
    async def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Validate an Okta access token.
        
        Args:
            token: JWT access token
            
        Returns:
            Decoded token claims if valid, None otherwise
        """
        try:
            # Get signing key from JWKS
            jwks_client = self._get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            
            # Verify and decode token
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                issuer=self.issuer,
                audience=self.client_id,
                options={"verify_exp": True}
            )
            
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
        """
        Get user info from Okta using access token.
        
        Args:
            access_token: Valid Okta access token
            
        Returns:
            UserInfo if successful, None otherwise
        """
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
        Exchange token for Cross-App Access (ID-JAG flow).
        
        This implements RFC 8693 Token Exchange for the agent to access
        downstream services (like the MCP Server) on behalf of the user.
        
        Args:
            subject_token: Original access token
            target_audience: Target service audience (e.g., MCP Server)
            requested_scopes: Scopes to request for the new token
            
        Returns:
            TokenExchangeResponse with new token if successful
        """
        try:
            # Build token exchange request
            data = {
                "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
                "subject_token": subject_token,
                "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
                "audience": target_audience,
                "requested_token_type": "urn:ietf:params:oauth:token-type:access_token",
            }
            
            if requested_scopes:
                data["scope"] = " ".join(requested_scopes)
            
            # Client authentication
            auth = (self.client_id, self.client_secret) if self.client_secret else None
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.token_url,
                    data=data,
                    auth=auth,
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                
                if response.status_code == 200:
                    token_data = response.json()
                    
                    # Extract delegation chain from token if present
                    delegation_chain = []
                    try:
                        # Decode without verification to get claims
                        claims = jwt.decode(
                            token_data["access_token"],
                            options={"verify_signature": False}
                        )
                        if "act" in claims:
                            # Build delegation chain from actor claims
                            actor = claims["act"]
                            while actor:
                                delegation_chain.append(actor.get("sub", "unknown"))
                                actor = actor.get("act")
                    except Exception:
                        pass
                    
                    logger.info(f"Token exchanged for audience: {target_audience}")
                    
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
                    error_data = response.json()
                    logger.error(f"Token exchange failed: {error_data}")
                    return None
                    
        except Exception as e:
            logger.error(f"Token exchange error: {e}")
            return None
    
    async def introspect_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Introspect a token to get its metadata.
        
        Args:
            token: Token to introspect
            
        Returns:
            Token metadata if valid
        """
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
        """
        Generate Okta authorization URL for login.
        
        Args:
            redirect_uri: Callback URL
            state: CSRF state parameter
            scopes: OAuth scopes to request
            
        Returns:
            Authorization URL
        """
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
        """
        Exchange authorization code for tokens.
        
        Args:
            code: Authorization code
            redirect_uri: Redirect URI used in auth request
            code_verifier: PKCE code verifier
            
        Returns:
            Token response if successful
        """
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
        """Check Okta connectivity."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(self.jwks_url)
                if response.status_code == 200:
                    return {
                        "status": "healthy",
                        "message": "Okta is reachable"
                    }
                return {
                    "status": "degraded",
                    "message": f"Okta returned status {response.status_code}"
                }
        except Exception as e:
            return {
                "status": "unhealthy",
                "message": str(e)
            }


# Global Okta service instance
okta_service = OktaService()
