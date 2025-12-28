"""
Okta Cross-App Access (XAA) Manager

Handles the complete XAA flow:
  Step 1: ID Token → ID-JAG (RFC 8693 Token Exchange) - ORG LEVEL
  Step 2: ID-JAG → Auth Server Access Token (RFC 7523 JWT Bearer)

Based on Indranil's atko-cross-app-access-sdk pattern.
"""

import os
import json
import time
import logging
import httpx
import jwt
from typing import Optional, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class XAATokenInfo:
    """Token information returned after XAA exchange."""
    id_jag_token: str
    auth_server_token: Optional[str]
    expires_in: int
    scope: str
    audience: str
    token_type: str = "Bearer"
    
    # Timing info for security flow visualization
    id_jag_duration_ms: Optional[int] = None
    auth_server_duration_ms: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id_jag_token": self.id_jag_token[:50] + "..." if self.id_jag_token else None,
            "auth_server_token": self.auth_server_token[:50] + "..." if self.auth_server_token else None,
            "expires_in": self.expires_in,
            "scope": self.scope,
            "audience": self.audience,
            "token_type": self.token_type,
            "id_jag_duration_ms": self.id_jag_duration_ms,
            "auth_server_duration_ms": self.auth_server_duration_ms
        }


class OktaCrossAppAccessManager:
    """
    Manages Okta Cross-App Access (XAA) token exchanges.
    
    Based on Indranil's atko-cross-app-access-sdk:
    - Step 1: ID Token → ID-JAG via ORG-LEVEL token endpoint
    - Step 2: ID-JAG → Auth Server Token via custom auth server
    """
    
    def __init__(self):
        # Okta domain
        self.okta_domain = os.getenv("OKTA_DOMAIN", "").replace("https://", "").rstrip("/")
        
        # Agent credentials
        self.agent_id = os.getenv("OKTA_AGENT_ID")
        self.agent_private_key_json = os.getenv("OKTA_AGENT_PRIVATE_KEY")
        
        # Authorization servers
        self.default_auth_server_id = os.getenv("OKTA_AUTH_SERVER_ID", "default")
        self.google_auth_server_id = os.getenv("OKTA_GOOGLE_AUTH_SERVER_ID")
        
        # Default audience for MCP
        self.default_audience = os.getenv("OKTA_DEFAULT_AUDIENCE", "api://default")
        self.google_audience = os.getenv("OKTA_GOOGLE_AUDIENCE", "https://google.com")
        
        self._private_key = None
        self._kid = None
        self._initialized = False
        
        self._initialize()
    
    def _initialize(self):
        """Initialize the XAA manager with credentials."""
        try:
            if not self.okta_domain:
                logger.warning("OKTA_DOMAIN not configured")
                return
                
            if not self.agent_id:
                logger.warning("OKTA_AGENT_ID not configured")
                return
                
            if not self.agent_private_key_json:
                logger.warning("OKTA_AGENT_PRIVATE_KEY not configured")
                return
            
            # Parse JWK
            jwk = json.loads(self.agent_private_key_json)
            self._kid = jwk.get("kid")
            
            # Convert JWK to PEM for signing
            self._private_key = self._jwk_to_pem(jwk)
            self._initialized = True
            
            logger.info(f"XAA Manager initialized successfully")
            logger.info(f"  Okta Domain: {self.okta_domain}")
            logger.info(f"  Agent ID: {self.agent_id}")
            logger.info(f"  Key ID: {self._kid}")
            logger.info(f"  Default Auth Server: {self.default_auth_server_id}")
            logger.info(f"  Google Auth Server: {self.google_auth_server_id}")
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OKTA_AGENT_PRIVATE_KEY as JSON: {e}")
        except Exception as e:
            logger.error(f"Failed to initialize XAA Manager: {e}")
    
    def _jwk_to_pem(self, jwk: dict) -> bytes:
        """Convert RSA JWK to PEM format for JWT signing."""
        import base64
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.backends import default_backend
        
        def b64_to_int(b64_str):
            padded = b64_str + '=' * (4 - len(b64_str) % 4)
            decoded = base64.urlsafe_b64decode(padded)
            return int.from_bytes(decoded, 'big')
        
        n = b64_to_int(jwk['n'])
        e = b64_to_int(jwk['e'])
        d = b64_to_int(jwk['d'])
        p = b64_to_int(jwk['p'])
        q = b64_to_int(jwk['q'])
        dp = b64_to_int(jwk['dp'])
        dq = b64_to_int(jwk['dq'])
        qi = b64_to_int(jwk['qi'])
        
        public_numbers = rsa.RSAPublicNumbers(e, n)
        private_numbers = rsa.RSAPrivateNumbers(p, q, d, dp, dq, qi, public_numbers)
        private_key = private_numbers.private_key(default_backend())
        
        pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        return pem
    
    def _create_client_assertion(self, token_endpoint: str) -> str:
        """
        Create a signed JWT client assertion for Okta token endpoint.
        Used for Step 2 (JWT Bearer grant).
        """
        now = int(time.time())
        
        payload = {
            "iss": self.agent_id,
            "sub": self.agent_id,
            "aud": token_endpoint,
            "iat": now,
            "exp": now + 300,  # 5 minutes
        }
        
        headers = {
            "kid": self._kid,
            "alg": "RS256"
        }
        
        token = jwt.encode(
            payload,
            self._private_key,
            algorithm="RS256",
            headers=headers
        )
        
        return token
    
    @property
    def is_available(self) -> bool:
        """Check if real XAA is available."""
        return self._initialized
    
    async def exchange_for_google_token(
        self,
        id_token: str,
        scope: str = "mcp:read"
    ) -> Optional[XAATokenInfo]:
        """
        Exchange ID token for Google Workspace auth server token.
        """
        if not self.google_auth_server_id:
            logger.error("OKTA_GOOGLE_AUTH_SERVER_ID not configured")
            return None
        
        # For Step 1, audience = issuer URL of target auth server
        target_issuer = f"https://{self.okta_domain}/oauth2/{self.google_auth_server_id}"
            
        return await self._perform_full_xaa_exchange(
            id_token=id_token,
            auth_server_id=self.google_auth_server_id,
            audience=target_issuer,
            scope=scope
        )
    
    async def exchange_for_mcp_token(
        self,
        id_token: str,
        scope: str = "mcp:read"
    ) -> Optional[XAATokenInfo]:
        """
        Exchange ID token for default MCP auth server token.
        
        For Step 1 (ID-JAG), the audience is the auth server's ISSUER URL.
        """
        # For Step 1, audience = issuer URL of target auth server
        target_issuer = f"https://{self.okta_domain}/oauth2/{self.default_auth_server_id}"
        
        return await self._perform_full_xaa_exchange(
            id_token=id_token,
            auth_server_id=self.default_auth_server_id,
            audience=target_issuer,
            scope=scope
        )
    
    async def _perform_full_xaa_exchange(
        self,
        id_token: str,
        auth_server_id: str,
        audience: str,
        scope: str
    ) -> Optional[XAATokenInfo]:
        """
        Perform the complete XAA exchange flow.
        
        Step 1: ID Token → ID-JAG (Token Exchange at ORG level)
        Step 2: ID-JAG → Auth Server Token (JWT Bearer at custom auth server)
        """
        if not self.is_available:
            logger.warning("XAA not configured - credentials missing")
            return None
        
        try:
            # Step 1: ID Token → ID-JAG (ORG LEVEL endpoint)
            logger.info(f"Step 1: Exchanging ID Token for ID-JAG (audience: {audience})")
            start_time = time.time()
            
            id_jag_token = await self._exchange_id_for_id_jag(
                id_token=id_token,
                audience=audience
            )
            
            id_jag_duration = int((time.time() - start_time) * 1000)
            
            if not id_jag_token:
                logger.error("Step 1 failed: Could not get ID-JAG token")
                return None
            
            logger.info(f"Step 1 complete: ID-JAG obtained ({id_jag_duration}ms)")
            
            # Step 2: ID-JAG → Auth Server Token
            logger.info(f"Step 2: Exchanging ID-JAG for Auth Server Token (auth_server: {auth_server_id})")
            start_time = time.time()
            
            auth_server_token, expires_in = await self._exchange_id_jag_for_access_token(
                id_jag_token=id_jag_token,
                auth_server_id=auth_server_id,
                scope=scope
            )
            
            auth_server_duration = int((time.time() - start_time) * 1000)
            
            if not auth_server_token:
                logger.error("Step 2 failed: Could not get Auth Server token")
                return None
            
            logger.info(f"Step 2 complete: Auth Server Token obtained ({auth_server_duration}ms)")
            
            return XAATokenInfo(
                id_jag_token=id_jag_token,
                auth_server_token=auth_server_token,
                expires_in=expires_in,
                scope=scope,
                audience=audience,
                id_jag_duration_ms=id_jag_duration,
                auth_server_duration_ms=auth_server_duration
            )
            
        except Exception as e:
            logger.error(f"XAA exchange failed: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def _exchange_id_for_id_jag(
        self,
        id_token: str,
        audience: str
    ) -> Optional[str]:
        """
        Step 1: Exchange ID token for ID-JAG token using RFC 8693 Token Exchange.
        
        Uses ORG-LEVEL endpoint:
        POST /oauth2/v1/token
        
        grant_type=urn:ietf:params:oauth:grant-type:token-exchange
        requested_token_type=urn:ietf:params:oauth:token-type:id-jag
        subject_token={id_token}
        subject_token_type=urn:ietf:params:oauth:token-type:id_token
        audience={target_auth_server_issuer}
        client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
        client_assertion={signed_jwt}
        """
        # Use ORG-LEVEL token endpoint
        token_url = f"https://{self.okta_domain}/oauth2/v1/token"
        
        # Create client assertion (private key JWT)
        client_assertion = self._create_client_assertion(token_url)
        
        data = {
            "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
            "requested_token_type": "urn:ietf:params:oauth:token-type:id-jag",
            "subject_token": id_token,
            "subject_token_type": "urn:ietf:params:oauth:token-type:id_token",
            "audience": audience,
            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            "client_assertion": client_assertion
        }
        
        logger.info(f"ID-JAG exchange request to: {token_url}")
        logger.info(f"  audience: {audience}")
        logger.info(f"  client_id (in assertion): {self.agent_id}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code != 200:
                logger.error(f"ID-JAG exchange failed: {response.status_code}")
                logger.error(f"Response: {response.text}")
                return None
            
            result = response.json()
            logger.info(f"ID-JAG exchange successful, token_type: {result.get('issued_token_type')}")
            return result.get("access_token")
    
    async def _exchange_id_jag_for_access_token(
        self,
        id_jag_token: str,
        auth_server_id: str,
        scope: str
    ) -> tuple[Optional[str], int]:
        """
        Step 2: Exchange ID-JAG for Auth Server Access Token using RFC 7523 JWT Bearer.
        
        POST /oauth2/{authServerId}/v1/token
        grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
        assertion={id_jag_token}
        scope={scope}
        client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
        client_assertion={signed_jwt}
        """
        token_url = f"https://{self.okta_domain}/oauth2/{auth_server_id}/v1/token"
        
        # Use private key JWT for authentication
        client_assertion = self._create_client_assertion(token_url)
        data = {
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": id_jag_token,
            "scope": scope,
            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            "client_assertion": client_assertion
        }
        
        logger.info(f"JWT Bearer exchange request to: {token_url}")
        logger.info(f"  scope: {scope}")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code != 200:
                logger.error(f"JWT Bearer exchange failed: {response.status_code}")
                logger.error(f"Response: {response.text}")
                return None, 0
            
            result = response.json()
            logger.info(f"JWT Bearer exchange successful")
            return result.get("access_token"), result.get("expires_in", 3600)
    
    def get_status(self) -> Dict[str, Any]:
        """Get XAA manager status for health checks."""
        return {
            "mode": "real" if self.is_available else "not_configured",
            "okta_domain": self.okta_domain,
            "agent_id": self.agent_id,
            "kid": self._kid,
            "default_auth_server": self.default_auth_server_id,
            "google_auth_server": self.google_auth_server_id,
            "default_audience": self.default_audience,
            "google_audience": self.google_audience,
            "initialized": self._initialized
        }


# Singleton instance
xaa_manager = OktaCrossAppAccessManager()
