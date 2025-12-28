"""
Okta Cross-App Access (XAA) Manager

Uses the official okta-ai-sdk-proto SDK for XAA token exchanges.
"""

import os
import json
import time
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass

from okta_ai_sdk import (
    OktaAIConfig,
    CrossAppAccessClient,
    IdJagTokenRequest,
    AuthServerTokenRequest
)

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
    Manages Okta Cross-App Access (XAA) token exchanges using okta-ai-sdk-proto.
    """
    
    def __init__(self):
        # Okta domain
        self.okta_domain = os.getenv("OKTA_DOMAIN", "").replace("https://", "").rstrip("/")
        
        # Agent/Client credentials
        self.client_id = os.getenv("OKTA_AGENT_ID")
        self.client_secret = os.getenv("OKTA_CLIENT_SECRET")
        
        # Private key for JWT assertions
        self.agent_private_key_json = os.getenv("OKTA_AGENT_PRIVATE_KEY")
        self._private_jwk = None
        
        # Authorization servers
        self.default_auth_server_id = os.getenv("OKTA_AUTH_SERVER_ID", "default")
        self.google_auth_server_id = os.getenv("OKTA_GOOGLE_AUTH_SERVER_ID")
        
        # Audiences
        self.default_audience = os.getenv("OKTA_DEFAULT_AUDIENCE", "api://default")
        self.google_audience = os.getenv("OKTA_GOOGLE_AUDIENCE", "https://google.com")
        
        self._sdk_config = None
        self._xaa_client = None
        self._initialized = False
        self._kid = None
        
        self._initialize()
    
    def _initialize(self):
        """Initialize the XAA manager with SDK."""
        try:
            if not self.okta_domain:
                logger.warning("OKTA_DOMAIN not configured")
                return
                
            if not self.client_id:
                logger.warning("OKTA_AGENT_ID not configured")
                return
                
            if not self.client_secret:
                logger.warning("OKTA_CLIENT_SECRET not configured")
                return
            
            # Parse private JWK if available
            if self.agent_private_key_json:
                try:
                    self._private_jwk = json.loads(self.agent_private_key_json)
                    self._kid = self._private_jwk.get("kid")
                except Exception as e:
                    logger.warning(f"Could not parse private key: {e}")
            
            # Initialize SDK config
            self._sdk_config = OktaAIConfig(
                oktaDomain=self.okta_domain,
                clientId=self.client_id,
                clientSecret=self.client_secret,
                authorizationServerId=self.default_auth_server_id,
                principalId=self.client_id,  # Use client_id as principal
                privateJWK=self._private_jwk
            )
            
            # Initialize CrossAppAccess client
            self._xaa_client = CrossAppAccessClient(self._sdk_config)
            
            self._initialized = True
            
            logger.info(f"XAA Manager initialized with okta-ai-sdk-proto")
            logger.info(f"  Okta Domain: {self.okta_domain}")
            logger.info(f"  Client ID: {self.client_id}")
            logger.info(f"  Client Secret: configured")
            logger.info(f"  Key ID: {self._kid}")
            logger.info(f"  Default Auth Server: {self.default_auth_server_id}")
            logger.info(f"  Google Auth Server: {self.google_auth_server_id}")
            
        except Exception as e:
            logger.error(f"Failed to initialize XAA Manager: {e}")
            import traceback
            traceback.print_exc()
    
    @property
    def is_available(self) -> bool:
        """Check if real XAA is available."""
        return self._initialized and self._xaa_client is not None
    
    async def exchange_for_google_token(
        self,
        id_token: str,
        scope: str = "mcp:read"
    ) -> Optional[XAATokenInfo]:
        """Exchange ID token for Google Workspace auth server token."""
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
        """Exchange ID token for default MCP auth server token."""
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
        Perform the complete XAA exchange flow using the SDK.
        
        Step 1: ID Token → ID-JAG (via SDK exchange_token)
        Step 2: ID-JAG → Auth Server Token (via SDK exchange_id_jag_for_auth_server_token)
        """
        if not self.is_available:
            logger.warning("XAA not configured - SDK not initialized")
            return None
        
        try:
            # Step 1: ID Token → ID-JAG
            logger.info(f"Step 1: Exchanging ID Token for ID-JAG via SDK")
            logger.info(f"  audience: {audience}")
            start_time = time.time()
            
            id_jag_request = IdJagTokenRequest(
                subject_token=id_token,
                subject_token_type="urn:ietf:params:oauth:token-type:id_token",
                audience=audience,
                client_id=self.client_id,
                client_secret=self.client_secret,
                scope=scope
            )
            
            id_jag_response = self._xaa_client.exchange_token(id_jag_request)
            
            id_jag_duration = int((time.time() - start_time) * 1000)
            
            if not id_jag_response or not id_jag_response.access_token:
                logger.error("Step 1 failed: Could not get ID-JAG token from SDK")
                return None
            
            id_jag_token = id_jag_response.access_token
            logger.info(f"Step 1 complete: ID-JAG obtained ({id_jag_duration}ms)")
            logger.info(f"  issued_token_type: {id_jag_response.issued_token_type}")
            
            # Step 2: ID-JAG → Auth Server Token
            logger.info(f"Step 2: Exchanging ID-JAG for Auth Server Token via SDK")
            logger.info(f"  auth_server: {auth_server_id}")
            start_time = time.time()
            
            auth_server_request = AuthServerTokenRequest(
                id_jag_token=id_jag_token,
                authorization_server_id=auth_server_id,
                principal_id=self.client_id,
                private_jwk=self._private_jwk
            )
            
            auth_server_response = self._xaa_client.exchange_id_jag_for_auth_server_token(auth_server_request)
            
            auth_server_duration = int((time.time() - start_time) * 1000)
            
            if not auth_server_response or not auth_server_response.access_token:
                logger.error("Step 2 failed: Could not get Auth Server token from SDK")
                return None
            
            logger.info(f"Step 2 complete: Auth Server Token obtained ({auth_server_duration}ms)")
            
            return XAATokenInfo(
                id_jag_token=id_jag_token,
                auth_server_token=auth_server_response.access_token,
                expires_in=auth_server_response.expires_in or 3600,
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
    
    def get_status(self) -> Dict[str, Any]:
        """Get XAA manager status for health checks."""
        return {
            "mode": "real" if self.is_available else "not_configured",
            "sdk": "okta-ai-sdk-proto",
            "okta_domain": self.okta_domain,
            "client_id": self.client_id,
            "client_secret": "configured" if self.client_secret else "missing",
            "kid": self._kid,
            "default_auth_server": self.default_auth_server_id,
            "google_auth_server": self.google_auth_server_id,
            "default_audience": self.default_audience,
            "google_audience": self.google_audience,
            "initialized": self._initialized
        }


# Singleton instance
xaa_manager = OktaCrossAppAccessManager()
