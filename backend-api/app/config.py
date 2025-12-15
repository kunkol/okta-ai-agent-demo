"""
Configuration settings for Backend API.

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

from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # ==========================================================================
    # API Keys
    # ==========================================================================
    ANTHROPIC_API_KEY: str = ""
    
    # ==========================================================================
    # MCP Server (from C1)
    # ==========================================================================
    MCP_SERVER_URL: str = "https://okta-ai-agent-demo.onrender.com"
    
    # ==========================================================================
    # Okta Configuration (from C0)
    # ==========================================================================
    OKTA_DOMAIN: str = "qa-aiagentsproducttc1.trexcloud.com"
    OKTA_CLIENT_ID: str = "0oa8x8i98ebUMhrhw0g7"  # Test_KK OAuth App (for agent/backend)
    OKTA_CLIENT_SECRET: str = ""  # Set via environment variable
    OKTA_AUTH_SERVER: str = "default"
    OKTA_AGENT_ID: str = "wlp8x98zcxMOXEPHJ0g7"  # KK Demo Agent UI
    OKTA_PRIVATE_KEY_KID: str = "0a26ff81-0eb6-43a4-9eb6-1829576211c9"
    
    # Agent private key for XAA token exchange (JSON string)
    # Set via OKTA_AGENT_PRIVATE_KEY environment variable
    OKTA_AGENT_PRIVATE_KEY: str = ""
    
    # ==========================================================================
    # Frontend OAuth App (from C4)
    # ==========================================================================
    OKTA_FRONTEND_CLIENT_ID: str = "0oa8xatd11PBe622F0g7"  # Apex Customer 360 Frontend
    
    # Okta endpoints (constructed from domain)
    @property
    def OKTA_ISSUER(self) -> str:
        return f"https://{self.OKTA_DOMAIN}/oauth2/{self.OKTA_AUTH_SERVER}"
    
    @property
    def OKTA_TOKEN_URL(self) -> str:
        return f"{self.OKTA_ISSUER}/v1/token"
    
    @property
    def OKTA_JWKS_URL(self) -> str:
        return f"{self.OKTA_ISSUER}/v1/keys"
    
    @property
    def OKTA_USERINFO_URL(self) -> str:
        return f"{self.OKTA_ISSUER}/v1/userinfo"
    
    @property
    def OKTA_VALID_AUDIENCES(self) -> List[str]:
        """List of valid token audiences (frontend and backend client IDs)."""
        return [
            self.OKTA_CLIENT_ID,           # Backend/Agent client ID
            self.OKTA_FRONTEND_CLIENT_ID,  # Frontend SPA client ID
            "api://default",               # Default API audience
        ]
    
    # ==========================================================================
    # CORS Configuration
    # ==========================================================================
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",      # Local frontend dev
        "http://localhost:5173",      # Vite dev server
        "https://okta-ai-agent-demo.vercel.app",
        "https://*.onrender.com",     # Render deployments
    ]
    
    # ==========================================================================
    # Claude AI Configuration
    # ==========================================================================
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"
    CLAUDE_MAX_TOKENS: int = 4096
    
    # ==========================================================================
    # Security Settings
    # ==========================================================================
    JWT_ALGORITHM: str = "RS256"
    TOKEN_EXPIRY_MINUTES: int = 60
    
    # ==========================================================================
    # Audit Configuration
    # ==========================================================================
    AUDIT_LOG_LEVEL: str = "INFO"
    ENABLE_AUDIT_LOGGING: bool = True
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Global settings instance
settings = Settings()


# Validate required settings on startup
def validate_settings():
    """Validate that required settings are configured."""
    errors = []
    
    if not settings.ANTHROPIC_API_KEY:
        errors.append("ANTHROPIC_API_KEY is required")
    
    if errors:
        raise ValueError(f"Configuration errors: {', '.join(errors)}")


# Export for easy importing
__all__ = ["settings", "validate_settings"]
