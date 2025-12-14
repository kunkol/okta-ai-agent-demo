"""
Health check endpoints.
"""

from fastapi import APIRouter
from datetime import datetime

from app.models.schemas import HealthResponse, ServiceHealth
from app.services.mcp_client import mcp_client
from app.services.claude_service import claude_service
from app.services.okta_service import okta_service
from app.config import settings

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Check health of all connected services.
    
    Returns health status of:
    - MCP Server (C1)
    - Claude AI
    - Okta
    """
    services = []
    overall_status = "healthy"
    
    # Check MCP Server
    mcp_health = await mcp_client.health_check()
    services.append(ServiceHealth(
        name="MCP Server",
        status=mcp_health["status"],
        latency_ms=mcp_health.get("latency_ms"),
        message=mcp_health.get("message")
    ))
    if mcp_health["status"] != "healthy":
        overall_status = "degraded"
    
    # Check Okta
    okta_health = await okta_service.health_check()
    services.append(ServiceHealth(
        name="Okta",
        status=okta_health["status"],
        message=okta_health.get("message")
    ))
    if okta_health["status"] == "unhealthy":
        overall_status = "degraded"
    
    # Check Claude (only if API key is configured)
    if settings.ANTHROPIC_API_KEY:
        claude_health = await claude_service.health_check()
        services.append(ServiceHealth(
            name="Claude AI",
            status=claude_health["status"],
            message=claude_health.get("message")
        ))
        if claude_health["status"] == "unhealthy":
            overall_status = "degraded"
    else:
        services.append(ServiceHealth(
            name="Claude AI",
            status="not_configured",
            message="ANTHROPIC_API_KEY not set"
        ))
    
    return HealthResponse(
        status=overall_status,
        version="1.0.0",
        services=services,
        timestamp=datetime.utcnow()
    )


@router.get("/health/mcp")
async def mcp_health():
    """Check MCP Server health specifically."""
    return await mcp_client.health_check()


@router.get("/health/okta")
async def okta_health():
    """Check Okta health specifically."""
    return await okta_service.health_check()
