"""
Okta Cross-App Access (XAA) Manager

Handles ID-JAG token exchange for MCP server access.
Uses Private Key JWT for agent authentication.
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
class MCPTokenInfo:
    """MCP token information returned after exchange."""
    id_jag_token: str
    mcp_access_token: Optional[str]
    expires_in: int
    scope: str
    token_type: str = "Bearer"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id_jag_token": self.id_jag_token,
            "mcp_access_token": self.mcp_access_token,
            "expires_in": self.expires_in,
            "scope": self.scope,
            "token_type": self.token_type
        }


class OktaCrossAppAccessManager:
    """
    Manages Okta Cross-App Access (XAA) token exchanges.
    
    Uses Private Key JWT (RFC 7523) for agent authentication.
    Implements RFC 8693 Token Exchange for ID-JAG flow.
    """
    
    def __init__(self):
        self.okta_domain = os.getenv("OKTA_DOMAIN", "qa-aiagentsproducttc1.trexcloud.com")
        self.agent_id = os.getenv("OKTA_CHAT_ASSISTANT_AGENT_ID")
        self.agent_private_key_json = os.getenv("OKTA_AGENT_PRIVATE_KEY")
        self.mcp_auth_server_id = os.getenv("OKTA_EMPLOYEE_MCP_AUTHORIZATION_SERVER_ID", "default")
        self.agent_audience = os.getenv("OKTA_CHAT_ASSISTANT_AGENT_AUDIENCE", "api://default")
        
        self._private_key = None
        self._kid = None
        self._initialized = False
        
        self._initialize()
    
    def _initialize(self):
        """Initialize the XAA manager with credentials."""
        try:
            if not self.agent_id:
                logger.warning("OKTA_CHAT_ASSISTANT_AGENT_ID not configured")
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
            logger.info(f"XAA Manager initialized - agent_id: {self.agent_id}, kid: {self._kid}")
            
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
    
    def _create_client_assertion(self) -> str:
        """Create a signed JWT client assertion for Okta token endpoint."""
        now = int(time.time())
        
        # Token endpoint URL - this is the audience for the assertion
        token_url = f"https://{self.okta_domain}/oauth2/{self.mcp_auth_server_id}/v1/token"
        
        payload = {
            "iss": self.agent_id,
            "sub": self.agent_id,
            "aud": token_url,
            "iat": now,
            "exp": now + 300,
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
    
    async def exchange_id_to_mcp_token(
        self,
        id_token: str,
        mcp_resource: str = None
    ) -> Optional[MCPTokenInfo]:
        """
        Exchange user's ID token for ID-JAG token.
        
        Args:
            id_token: User's ID token from Okta SSO
            mcp_resource: Target MCP resource (defaults to agent_audience)
            
        Returns:
            MCPTokenInfo with ID-JAG token
        """
        if not self.is_available:
            logger.warning("XAA not configured - credentials missing")
            return None
        
        resource = mcp_resource or self.agent_audience
        
        try:
            id_jag_token = await self._exchange_for_id_jag(id_token, resource)
            
            if not id_jag_token:
                logger.error("Failed to get ID-JAG token")
                return None
            
            return MCPTokenInfo(
                id_jag_token=id_jag_token,
                mcp_access_token=None,  # ID-JAG is used directly
                expires_in=3600,
                scope="openid profile"
            )
            
        except Exception as e:
            logger.error(f"XAA exchange failed: {e}")
            return None
    
    async def _exchange_for_id_jag(self, id_token: str, audience: str) -> Optional[str]:
        """
        Exchange ID token for ID-JAG token using RFC 8693 Token Exchange.
        
        POST /oauth2/{authServerId}/v1/token
        grant_type=urn:ietf:params:oauth:grant-type:token-exchange
        requested_token_type=urn:ietf:params:oauth:token-type:id-jag
        subject_token={id_token}
        subject_token_type=urn:ietf:params:oauth:token-type:id_token
        audience={resource}
        client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
        client_assertion={signed_jwt}
        """
        token_url = f"https://{self.okta_domain}/oauth2/{self.mcp_auth_server_id}/v1/token"
        
        client_assertion = self._create_client_assertion()
        
        data = {
            "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
            "requested_token_type": "urn:ietf:params:oauth:token-type:id-jag",
            "subject_token": id_token,
            "subject_token_type": "urn:ietf:params:oauth:token-type:id_token",
            "audience": audience,
            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            "client_assertion": client_assertion
        }
        
        logger.info(f"XAA exchange request to: {token_url}")
        logger.info(f"Audience: {audience}")
        
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
            logger.info("ID-JAG exchange successful!")
            
            # The ID-JAG token is in access_token field
            return result.get("access_token")
    
    def get_status(self) -> Dict[str, Any]:
        """Get XAA manager status for health checks."""
        return {
            "mode": "real" if self.is_available else "not_configured",
            "okta_domain": self.okta_domain,
            "agent_id": self.agent_id,
            "kid": self._kid,
            "mcp_auth_server": self.mcp_auth_server_id,
            "audience": self.agent_audience,
            "initialized": self._initialized
        }


# Singleton instance
xaa_manager = OktaCrossAppAccessManager()
