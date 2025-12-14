"""
Okta AI Agent Demo - Backend API
================================
C2: Backend API Build

This backend integrates:
- Claude AI for intelligent tool orchestration
- MCP Server connection (from C1)
- Okta authentication and token exchange
- Comprehensive audit logging

Connected Chats:
- C0: Initial Outline / Okta Setup
- C1: MCP Server Build (https://okta-ai-agent-demo.onrender.com)
- C3: Frontend Build
- C4: Okta Security Config
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.routers import chat, auth, health
from app.services.audit_service import AuditService
from app.config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    logger.info("Starting Okta AI Agent Backend API...")
    logger.info(f"MCP Server URL: {settings.MCP_SERVER_URL}")
    logger.info(f"Okta Tenant: {settings.OKTA_DOMAIN}")
    yield
    logger.info("Shutting down Backend API...")


app = FastAPI(
    title="Okta AI Agent Demo - Backend API",
    description="""
    Backend API for the Okta AI Agent Security Demo.
    
    ## Features
    - **Claude AI Integration**: Intelligent tool orchestration
    - **MCP Server Connection**: Calls tools via MCP protocol
    - **Okta Authentication**: Token validation and exchange
    - **Audit Logging**: Complete audit trail of all operations
    
    ## Architecture
    ```
    Frontend (C3) → Backend API (C2) → MCP Server (C1)
                         ↓
                    Okta (C0/C4)
    ```
    """,
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "service": "Okta AI Agent Demo - Backend API",
        "version": "1.0.0",
        "project": "C2 - Backend API Build",
        "endpoints": {
            "docs": "/docs",
            "health": "/health",
            "chat": "/api/chat",
            "auth": "/api/auth"
        },
        "connected_services": {
            "mcp_server": settings.MCP_SERVER_URL,
            "okta_tenant": settings.OKTA_DOMAIN
        }
    }
