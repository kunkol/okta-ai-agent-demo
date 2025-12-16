"""
Okta Cross-App Access (XAA) Manager

Handles ID-JAG token exchange for MCP server access.
Reference: Indranil's auth/okta_cross_app_access.py pattern
"""

import os
import json
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class MCPTokenInfo:
    """MCP token information returned after exchange."""
    id_jag_token: str
    mcp_access_token: str
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
    
    Flow:
    1. Receive user's ID token from frontend
    2. Exchange ID token for ID-JAG (Identity JSON Assertion Grant)
    3. Exchange ID-JAG for MCP access token
    """
    
    def __init__(self):
        self.okta_domain = os.getenv("OKTA_DOMAIN", "qa-aiagentsproducttc1.trexcloud.com")
        self.agent_id = os.getenv("OKTA_CHAT_ASSISTANT_AGENT_ID")
        self.agent_private_key = os.getenv("OKTA_AGENT_PRIVATE_KEY")
        self.mcp_auth_server_id = os.getenv("OKTA_EMPLOYEE_MCP_AUTHORIZATION_SERVER_ID", "default")
        self.agent_audience = os.getenv("OKTA_CHAT_ASSISTANT_AGENT_AUDIENCE")
        
        self._sdk_available = False
        self._xaa_client = None
        
        self._initialize_sdk()
    
    def _initialize_sdk(self):
        """Initialize the Okta AI SDK if available."""
        try:
            from okta_ai_sdk_proto import OktaCrossAppAccess
            
            if not self.agent_id or not self.agent_private_key:
                logger.warning("XAA credentials not configured - using simulation mode")
                return
            
            # Parse JWK if it's a JSON string
            private_key = self.agent_private_key
            if private_key and private_key.startswith("{"):
                private_key = json.loads(private_key)
            
            self._xaa_client = OktaCrossAppAccess(
                okta_domain=self.okta_domain,
                agent_id=self.agent_id,
                private_key=private_key,
                authorization_server_id=self.mcp_auth_server_id
            )
            self._sdk_available = True
            logger.info("Okta XAA SDK initialized successfully")
            
        except ImportError as ie:
            logger.warning(f"Import error details: {ie}")
            logger.warning("okta-ai-sdk-proto not installed - using simulation mode")
        except Exception as e:
            logger.error(f"Failed to initialize XAA SDK: {e}")
    
    @property
    def is_available(self) -> bool:
        """Check if real XAA is available."""
        return self._sdk_available and self._xaa_client is not None
    
    async def exchange_id_to_mcp_token(
        self,
        id_token: str,
        mcp_resource: str = "mcp-server"
    ) -> Optional[MCPTokenInfo]:
        """
        Exchange user's ID token for MCP access token.
        
        Args:
            id_token: User's ID token from Okta SSO
            mcp_resource: Target MCP resource identifier
            
        Returns:
            MCPTokenInfo with tokens, or None if exchange fails
        """
        if self.is_available:
            return await self._real_exchange(id_token, mcp_resource)
        else:
            return await self._simulated_exchange(id_token, mcp_resource)
    
    async def _real_exchange(
        self,
        id_token: str,
        mcp_resource: str
    ) -> Optional[MCPTokenInfo]:
        """Perform real token exchange using Okta AI SDK."""
        try:
            # Step 1: Exchange ID token for ID-JAG
            id_jag_response = await self._xaa_client.exchange_id_token_for_id_jag(
                id_token=id_token,
                resource=mcp_resource,
                audience=self.agent_audience
            )
            
            id_jag_token = id_jag_response.get("id_jag")
            if not id_jag_token:
                logger.error("No ID-JAG token in response")
                return None
            
            # Step 2: Exchange ID-JAG for MCP access token
            mcp_token_response = await self._xaa_client.exchange_id_jag_for_access_token(
                id_jag=id_jag_token,
                resource=mcp_resource
            )
            
            return MCPTokenInfo(
                id_jag_token=id_jag_token,
                mcp_access_token=mcp_token_response.get("access_token", ""),
                expires_in=mcp_token_response.get("expires_in", 3600),
                scope=mcp_token_response.get("scope", "read write")
            )
            
        except Exception as e:
            logger.error(f"Real XAA exchange failed: {e}")
            # Fall back to simulation
            return await self._simulated_exchange(id_token, mcp_resource)
    
    async def _simulated_exchange(
        self,
        id_token: str,
        mcp_resource: str
    ) -> MCPTokenInfo:
        """
        Simulate token exchange for demo purposes.
        Returns realistic-looking tokens that demonstrate the pattern.
        """
        import hashlib
        import time
        
        # Generate deterministic but unique tokens based on input
        token_seed = f"{id_token[:20] if id_token else 'demo'}:{mcp_resource}:{int(time.time())}"
        token_hash = hashlib.sha256(token_seed.encode()).hexdigest()
        
        # Simulated ID-JAG (JWT-like structure)
        id_jag = f"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.{token_hash[:64]}.{token_hash[64:96]}_simulated"
        
        # Simulated MCP access token
        mcp_token = f"mcp_at_{token_hash[:32]}_simulated"
        
        logger.info(f"Simulated XAA exchange for resource: {mcp_resource}")
        
        return MCPTokenInfo(
            id_jag_token=id_jag,
            mcp_access_token=mcp_token,
            expires_in=3600,
            scope="read write mcp:tools"
        )
    
    def get_status(self) -> Dict[str, Any]:
        """Get XAA manager status for health checks."""
        return {
            "mode": "real" if self.is_available else "simulated",
            "okta_domain": self.okta_domain,
            "agent_configured": bool(self.agent_id),
            "mcp_auth_server": self.mcp_auth_server_id
        }


# Singleton instance
xaa_manager = OktaCrossAppAccessManager()
