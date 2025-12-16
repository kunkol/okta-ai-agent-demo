"""
Pydantic models for API requests and responses.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# =============================================================================
# Enums
# =============================================================================

class ToolCallStatus(str, Enum):
    """Status of a tool call."""
    PENDING = "pending"
    ALLOWED = "allowed"
    DENIED = "denied"
    REQUIRES_APPROVAL = "requires_approval"
    COMPLETED = "completed"
    FAILED = "failed"


class RiskLevel(str, Enum):
    """Risk level for operations."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# =============================================================================
# Chat Models
# =============================================================================

class ChatMessage(BaseModel):
    """A single chat message."""
    role: str = Field(..., description="Message role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")
    timestamp: Optional[datetime] = None


class ChatRequest(BaseModel):
    """Request to send a chat message."""
    message: str = Field(..., description="User's message")
    conversation_id: Optional[str] = Field(None, description="Conversation ID for context")
    user_id: Optional[str] = Field(None, description="User ID from Okta token")
    
    class Config:
        json_schema_extra = {
            "example": {
                "message": "Get customer information for Alice Johnson",
                "conversation_id": "conv-123",
                "user_id": "user-456"
            }
        }


class ToolCall(BaseModel):
    """Details of a tool call made by Claude."""
    tool_name: str = Field(..., description="Name of the tool called")
    tool_input: Dict[str, Any] = Field(..., description="Input parameters")
    tool_output: Optional[Any] = Field(None, description="Output from tool")
    status: ToolCallStatus = Field(default=ToolCallStatus.PENDING)
    risk_level: RiskLevel = Field(default=RiskLevel.LOW)
    requires_approval: bool = Field(default=False)
    approval_reason: Optional[str] = None
    execution_time_ms: Optional[int] = None


class SecurityFlow(BaseModel):
    """Security flow visualization data."""
    token_exchanged: bool = Field(default=False)
    target_audience: Optional[str] = None
    fga_check_result: Optional[str] = None
    ciba_approval_required: bool = Field(default=False)
    ciba_approval_status: Optional[str] = None
    delegation_chain: List[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    """Response from chat endpoint."""
    response: str = Field(..., description="Claude's response")
    conversation_id: str = Field(..., description="Conversation ID")
    tool_calls: List[ToolCall] = Field(default_factory=list)
    security_flow: SecurityFlow = Field(default_factory=SecurityFlow)
    audit_id: str = Field(..., description="Audit log entry ID")
    mcp_info: Optional[Dict[str, Any]] = Field(default=None, description="MCP token info from XAA exchange")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "response": "I found Alice Johnson's customer record...",
                "conversation_id": "conv-123",
                "tool_calls": [
                    {
                        "tool_name": "get_customer",
                        "tool_input": {"name": "Alice Johnson"},
                        "status": "completed",
                        "risk_level": "low"
                    }
                ],
                "security_flow": {
                    "token_exchanged": True,
                    "target_audience": "mcp-server",
                    "fga_check_result": "ALLOWED"
                },
                "audit_id": "audit-789"
            }
        }


# =============================================================================
# Authentication Models
# =============================================================================

class TokenRequest(BaseModel):
    """Request to exchange authorization code for tokens."""
    code: str = Field(..., description="Authorization code from Okta")
    redirect_uri: str = Field(..., description="Redirect URI used in auth request")
    code_verifier: Optional[str] = Field(None, description="PKCE code verifier")


class TokenResponse(BaseModel):
    """Token response from Okta."""
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    id_token: Optional[str] = None
    refresh_token: Optional[str] = None
    scope: Optional[str] = None


class UserInfo(BaseModel):
    """User information from Okta token."""
    sub: str = Field(..., description="User's unique identifier")
    email: Optional[str] = None
    name: Optional[str] = None
    preferred_username: Optional[str] = None
    groups: List[str] = Field(default_factory=list)


class TokenExchangeRequest(BaseModel):
    """Request for token exchange (Cross-App Access)."""
    subject_token: str = Field(..., description="Original access token")
    target_audience: str = Field(..., description="Target service audience")
    requested_scopes: List[str] = Field(default_factory=list)


class TokenExchangeResponse(BaseModel):
    """Response from token exchange."""
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    issued_token_type: str = "urn:ietf:params:oauth:token-type:access_token"
    scope: Optional[str] = None
    delegation_chain: List[str] = Field(default_factory=list)


# =============================================================================
# Audit Models
# =============================================================================

class AuditEntry(BaseModel):
    """Audit log entry."""
    id: str = Field(..., description="Unique audit entry ID")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    user_id: Optional[str] = None
    agent_id: Optional[str] = None
    action: str = Field(..., description="Action performed")
    resource: Optional[str] = None
    tool_name: Optional[str] = None
    tool_input: Optional[Dict[str, Any]] = None
    result: str = Field(..., description="Result: success, denied, error")
    risk_level: RiskLevel = Field(default=RiskLevel.LOW)
    security_context: Optional[Dict[str, Any]] = None
    delegation_chain: List[str] = Field(default_factory=list)
    message: Optional[str] = None


class AuditLogResponse(BaseModel):
    """Response containing audit log entries."""
    entries: List[AuditEntry]
    total_count: int
    page: int = 1
    page_size: int = 50


# =============================================================================
# MCP Tool Models
# =============================================================================

class MCPTool(BaseModel):
    """MCP Tool definition."""
    name: str
    description: str
    input_schema: Dict[str, Any]


class MCPToolsResponse(BaseModel):
    """Response from MCP tools/list endpoint."""
    tools: List[MCPTool]


class MCPToolCallRequest(BaseModel):
    """Request to call an MCP tool."""
    tool_name: str
    arguments: Dict[str, Any]
    access_token: Optional[str] = None


class MCPToolCallResponse(BaseModel):
    """Response from MCP tool call."""
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None
    execution_time_ms: int
    xaa_token_used: bool = Field(default=False, description="Whether XAA token exchange was performed")


# =============================================================================
# Health Check Models
# =============================================================================

class ServiceHealth(BaseModel):
    """Health status of a service."""
    name: str
    status: str  # "healthy", "unhealthy", "degraded"
    latency_ms: Optional[int] = None
    message: Optional[str] = None


class HealthResponse(BaseModel):
    """Overall health check response."""
    status: str
    version: str
    services: List[ServiceHealth]
    timestamp: datetime = Field(default_factory=datetime.utcnow)
