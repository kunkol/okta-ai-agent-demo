"""
Okta Cross-App Access (XAA) Manager using okta-ai-sdk-proto

Implements the ID-JAG flow:
1. ID Token → ID-JAG Token (via ORG auth server)
2. ID-JAG Token → Auth Server Access Token (via custom auth server)

Based on Indranil's cross_app_access_demo.ipynb
"""

import os
import json
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class MCPTokenInfo:
    """MCP token information returned after XAA exchange."""
    id_jag_token: str
    mcp_access_token: Optional[str]
    expires_in: int
    scope: str
    token_type: str = "Bearer"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id_jag_token": self.id_jag_token[:50] + "..." if self.id_jag_token else None,
            "mcp_access_token": self.mcp_access_token[:50] + "..." if self.mcp_access_token else None,
            "expires_in": self.expires_in,
            "scope": self.scope,
            "token_type": self.token_type
        }


class OktaCrossAppAccessManager:
    """
    Manages Okta Cross-App Access (XAA) token exchanges using okta-ai-sdk-proto.
    
    Flow:
    1. Exchange user's ID token (from ORG auth server) for ID-JAG token
    2. Exchange ID-JAG token for Auth Server access token
    """
    
    def __init__(self):
        # Okta domain (without https://)
        self.okta_domain = os.getenv("OKTA_DOMAIN", "").replace("https://", "").replace("http://", "")
        
        # Agent/Workload Principal credentials - using YOUR env var names
        self.client_id = os.getenv("OKTA_AGENT_ID")  # wlp8x98zcxMOXEPHJ0g7
        self.client_secret = os.getenv("OKTA_CLIENT_SECRET")
        
        # Private JWK for JWT bearer assertion
        self.private_jwk_json = os.getenv("OKTA_AGENT_PRIVATE_KEY")
        self._private_jwk = None
        self._kid = None
        
        # Authorization servers - using YOUR env var names
        self.default_auth_server = os.getenv("OKTA_AUTH_SERVER_ID", "default")  # ApexCustomMCP
        self.google_auth_server = os.getenv("OKTA_GOOGLE_AUTH_SERVER_ID")
        
        # Audiences - using YOUR env var names
        self.default_audience = os.getenv("OKTA_DEFAULT_AUDIENCE", "api://default")
        self.google_audience = os.getenv("OKTA_GOOGLE_AUDIENCE", "https://google.com")
        
        # SDK components
        self._sdk = None
        self._xaa_client = None
        self._initialized = False
        
        self._initialize()
    
    def _initialize(self):
        """Initialize the SDK with credentials."""
        try:
            # Parse private JWK
            if self.private_jwk_json:
                self._private_jwk = json.loads(self.private_jwk_json)
                self._kid = self._private_jwk.get("kid")
            
            # Check required credentials
            if not self.client_id:
                logger.warning("OKTA_AGENT_ID not configured")
                return
            
            if not self._private_jwk:
                logger.warning("OKTA_AGENT_PRIVATE_KEY not configured or invalid JSON")
                return
            
            if not self.okta_domain:
                logger.warning("OKTA_DOMAIN not configured")
                return
            
            # Import SDK
            try:
                from okta_ai_sdk import OktaAIConfig, OktaAISDK
                
                # Initialize SDK - okta_domain needs https:// prefix
                config = OktaAIConfig(
                    okta_domain=f"https://{self.okta_domain}",
                    client_id=self.client_id,
                    client_secret=self.client_secret or "",
                    authorization_server_id=self.default_auth_server,
                    principal_id=self.client_id,  # workload principal ID
                    private_jwk=self._private_jwk
                )
                
                self._sdk = OktaAISDK(config)
                self._xaa_client = self._sdk.cross_app_access
                self._initialized = True
                
                logger.info(f"XAA Manager initialized with SDK")
                logger.info(f"  okta_domain: {self.okta_domain}")
                logger.info(f"  client_id (OKTA_AGENT_ID): {self.client_id}")
                logger.info(f"  auth_server (OKTA_AUTH_SERVER_ID): {self.default_auth_server}")
                logger.info(f"  kid: {self._kid}")
                
            except ImportError as e:
                logger.error(f"Failed to import okta-ai-sdk: {e}")
                return
                
        except Exception as e:
            logger.error(f"Failed to initialize XAA Manager: {e}")
            import traceback
            traceback.print_exc()
    
    @property
    def is_available(self) -> bool:
        """Check if XAA is available."""
        return self._initialized and self._xaa_client is not None
    
    async def exchange_id_to_mcp_token(
        self,
        id_token: str,
        mcp_resource: str = None
    ) -> Optional[MCPTokenInfo]:
        """
        Exchange user's ID token for MCP access token via ID-JAG flow.
        
        Args:
            id_token: User's ID token from ORG auth server (issuer = https://{domain})
            mcp_resource: Target MCP resource identifier
            
        Returns:
            MCPTokenInfo with ID-JAG and access tokens
        """
        if not self.is_available:
            logger.warning("XAA not configured - SDK not initialized")
            return None
        
        try:
            return await self._perform_full_xaa_exchange(id_token)
        except Exception as e:
            logger.error(f"XAA exchange failed: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def _perform_full_xaa_exchange(self, id_token: str) -> Optional[MCPTokenInfo]:
        """
        Perform the full XAA exchange:
        1. ID Token → ID-JAG Token
        2. ID-JAG Token → Auth Server Access Token
        """
        from okta_ai_sdk.types import AuthServerTokenRequest
        
        # Step 1: Exchange ID Token for ID-JAG Token
        # Audience format: {OKTA_DOMAIN}/oauth2/{AUTH_SERVER_ID}
        id_jag_audience = f"https://{self.okta_domain}/oauth2/{self.default_auth_server}"
        
        logger.info(f"Step 1: Exchanging ID Token for ID-JAG via SDK")
        logger.info(f"  audience: {id_jag_audience}")
        
        try:
            # Use the SDK's exchange_token method
            id_jag_response = self._xaa_client.exchange_token(
                token=id_token,
                audience=id_jag_audience,
                scope="openid profile email",
                token_type="id_token"
            )
            
            id_jag_token = id_jag_response.access_token
            logger.info(f"Step 1 SUCCESS: Got ID-JAG token")
            logger.info(f"  token_type: {id_jag_response.token_type}")
            logger.info(f"  expires_in: {id_jag_response.expires_in}")
            
        except Exception as e:
            logger.error(f"Step 1 FAILED: {e}")
            raise
        
        # Step 2: Exchange ID-JAG for Auth Server Access Token
        logger.info(f"Step 2: Exchanging ID-JAG for Auth Server Token")
        logger.info(f"  auth_server: {self.default_auth_server}")
        
        try:
            auth_server_request = AuthServerTokenRequest(
                id_jag_token=id_jag_token,
                authorization_server_id=self.default_auth_server,
                principal_id=self.client_id,
                private_jwk=self._private_jwk
            )
            
            auth_server_response = self._xaa_client.exchange_id_jag_for_auth_server_token(
                auth_server_request
            )
            
            access_token = auth_server_response.access_token
            logger.info(f"Step 2 SUCCESS: Got Auth Server access token")
            logger.info(f"  token_type: {auth_server_response.token_type}")
            logger.info(f"  expires_in: {auth_server_response.expires_in}")
            logger.info(f"  scope: {auth_server_response.scope}")
            
        except Exception as e:
            logger.error(f"Step 2 FAILED: {e}")
            # Return ID-JAG token even if Step 2 fails
            return MCPTokenInfo(
                id_jag_token=id_jag_token,
                mcp_access_token=None,
                expires_in=id_jag_response.expires_in or 3600,
                scope="openid profile email"
            )
        
        # Return full token info
        return MCPTokenInfo(
            id_jag_token=id_jag_token,
            mcp_access_token=access_token,
            expires_in=auth_server_response.expires_in or 3600,
            scope=auth_server_response.scope or "openid profile email"
        )
    
    def get_status(self) -> Dict[str, Any]:
        """Get XAA manager status for health checks."""
        return {
            "mode": "real" if self.is_available else "not_configured",
            "sdk": "okta-ai-sdk-proto",
            "okta_domain": self.okta_domain,
            "client_id": self.client_id,
            "client_secret": "configured" if self.client_secret else "not_configured",
            "kid": self._kid,
            "default_auth_server": self.default_auth_server,
            "google_auth_server": self.google_auth_server,
            "default_audience": self.default_audience,
            "google_audience": self.google_audience,
            "initialized": self._initialized
        }


# Singleton instance
xaa_manager = OktaCrossAppAccessManager()
