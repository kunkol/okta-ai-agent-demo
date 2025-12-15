"""
Chat endpoints with Claude AI integration.

This is the main endpoint that:
1. Receives user messages
2. Extracts user token from Authorization header
3. Sends to Claude AI
4. Claude decides which MCP tools to call
5. Performs XAA token exchange before calling MCP tools
6. Returns response with security flow data
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional
import uuid
import logging

from app.models.schemas import (
    ChatRequest, ChatResponse, SecurityFlow,
    AuditEntry, AuditLogResponse, ToolCall, ToolCallStatus
)
from app.services.claude_service import claude_service
from app.services.mcp_client import mcp_client
from app.services.audit_service import audit_service
from app.services.okta_service import okta_service
from app.routers.auth import get_current_user, require_auth
from app.models.schemas import UserInfo
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory conversation storage (use Redis/DB in production)
conversations = {}


def extract_token(authorization: Optional[str]) -> Optional[str]:
    """Extract Bearer token from Authorization header."""
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]
    return None


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    user: Optional[UserInfo] = Depends(get_current_user),
    authorization: Optional[str] = Header(None)
):
    """
    Process a chat message with Claude AI.
    
    Flow:
    1. Receive user message
    2. Extract user token from Authorization header
    3. Get conversation history
    4. Send to Claude with available MCP tools
    5. Claude decides which tools to call
    6. Perform XAA token exchange (user token -> MCP token)
    7. Execute tools via MCP Server with exchanged token
    8. Return response with security flow visualization
    
    Args:
        request: Chat request with message
        user: Optional authenticated user
        authorization: Authorization header with Bearer token
        
    Returns:
        ChatResponse with AI response, tool calls, and security data
    """
    # Generate or use existing conversation ID
    conversation_id = request.conversation_id or f"conv-{uuid.uuid4().hex[:8]}"
    
    # Get conversation history
    history = conversations.get(conversation_id, [])
    
    # Extract user token for XAA
    user_token = extract_token(authorization)
    
    # Build user context
    user_context = None
    if user:
        user_context = {
            "sub": user.sub,
            "email": user.email,
            "name": user.name,
            "groups": user.groups
        }
    
    # Log the incoming request
    request_audit = audit_service.log(
        action="chat_request",
        result="received",
        user_id=user.sub if user else None,
        conversation_id=conversation_id,
        message=f"Chat request: {request.message[:100]}..."
    )
    
    try:
        # Process message with Claude, passing user token for XAA
        result = await claude_service.process_message(
            message=request.message,
            conversation_history=history,
            user_context=user_context,
            user_token=user_token  # Pass token for XAA exchange
        )
        
        # Build security flow data
        security_flow = SecurityFlow()
        
        # Check if XAA was performed
        if result.get("xaa_performed"):
            security_flow.token_exchanged = True
            security_flow.target_audience = "api://default"
            logger.info("XAA token exchange was performed for this request")
        
        # Process tool calls and build security flow
        tool_calls = result.get("tool_calls", [])
        for tool_call in tool_calls:
            # Log each tool call
            audit_service.log_tool_call(
                tool_name=tool_call.tool_name,
                tool_input=tool_call.tool_input,
                result=tool_call.status.value,
                user_id=user.sub if user else None,
                conversation_id=conversation_id,
                risk_level=tool_call.risk_level,
                execution_time_ms=tool_call.execution_time_ms
            )
            
            # Update security flow based on tool calls
            if tool_call.status == ToolCallStatus.COMPLETED:
                security_flow.token_exchanged = True
                security_flow.target_audience = "api://default"
                security_flow.fga_check_result = "ALLOWED"
            elif tool_call.status == ToolCallStatus.REQUIRES_APPROVAL:
                security_flow.ciba_approval_required = True
                security_flow.ciba_approval_status = "pending"
            elif tool_call.status == ToolCallStatus.DENIED:
                security_flow.fga_check_result = "DENIED"
        
        # Update conversation history
        history.append({"role": "user", "content": request.message})
        history.append({"role": "assistant", "content": result["response"]})
        conversations[conversation_id] = history[-20:]  # Keep last 20 messages
        
        # Create response
        response = ChatResponse(
            response=result["response"],
            conversation_id=conversation_id,
            tool_calls=tool_calls,
            security_flow=security_flow,
            audit_id=request_audit.id
        )
        
        # Log successful response
        audit_service.log(
            action="chat_response",
            result="success",
            user_id=user.sub if user else None,
            conversation_id=conversation_id,
            security_context={
                "tool_calls_count": len(tool_calls),
                "xaa_performed": result.get("xaa_performed", False),
                "tokens_used": result.get("usage", {})
            }
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        
        # Log the error
        audit_service.log(
            action="chat_error",
            result="error",
            user_id=user.sub if user else None,
            conversation_id=conversation_id,
            message=str(e)
        )
        
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/authenticated", response_model=ChatResponse)
async def authenticated_chat(
    request: ChatRequest,
    user: UserInfo = Depends(require_auth),
    authorization: str = Header(...)
):
    """
    Authenticated chat endpoint.
    
    Same as /chat but requires valid Okta authentication.
    Useful for production scenarios.
    """
    request.user_id = user.sub
    return await chat(request, user, authorization)


@router.get("/tools")
async def get_available_tools():
    """
    Get list of available MCP tools.
    
    Returns tools from the MCP Server (C1).
    """
    tools = await mcp_client.get_tools()
    return {
        "tools": [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": t.input_schema,
                "risk_level": mcp_client.get_tool_risk_level(t.name).value
            }
            for t in tools
        ],
        "mcp_server": settings.MCP_SERVER_URL
    }


@router.post("/tools/call")
async def call_tool_directly(
    tool_name: str,
    arguments: dict,
    user: Optional[UserInfo] = Depends(get_current_user),
    authorization: Optional[str] = Header(None)
):
    """
    Call an MCP tool directly (for testing).
    
    Bypasses Claude AI and calls the tool directly.
    Supports XAA token exchange if Authorization header is provided.
    """
    # Check if approval is required
    requires_approval, reason = mcp_client.requires_approval(tool_name, arguments)
    
    if requires_approval:
        audit_service.log(
            action="direct_tool_call",
            result="requires_approval",
            user_id=user.sub if user else None,
            tool_name=tool_name,
            tool_input=arguments,
            message=reason
        )
        return {
            "status": "requires_approval",
            "reason": reason,
            "note": "In production, this would trigger CIBA flow"
        }
    
    # Extract user token for XAA
    user_token = extract_token(authorization)
    
    # Execute the tool with XAA
    result = await mcp_client.call_tool(tool_name, arguments, user_token=user_token)
    
    # Log the call
    audit_service.log_tool_call(
        tool_name=tool_name,
        tool_input=arguments,
        result="success" if result.success else "failed",
        user_id=user.sub if user else None,
        risk_level=mcp_client.get_tool_risk_level(tool_name),
        execution_time_ms=result.execution_time_ms,
        error_message=result.error
    )
    
    return result


@router.get("/history/{conversation_id}")
async def get_conversation_history(
    conversation_id: str,
    user: Optional[UserInfo] = Depends(get_current_user)
):
    """
    Get conversation history.
    """
    history = conversations.get(conversation_id, [])
    return {
        "conversation_id": conversation_id,
        "messages": history,
        "message_count": len(history)
    }


@router.delete("/history/{conversation_id}")
async def clear_conversation(
    conversation_id: str,
    user: Optional[UserInfo] = Depends(get_current_user)
):
    """
    Clear conversation history.
    """
    if conversation_id in conversations:
        del conversations[conversation_id]
        return {"message": "Conversation cleared"}
    return {"message": "Conversation not found"}


@router.get("/audit", response_model=AuditLogResponse)
async def get_audit_log(
    conversation_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: Optional[UserInfo] = Depends(get_current_user)
):
    """
    Get audit log entries.
    
    Can filter by conversation_id or user.
    """
    user_id = user.sub if user else None
    
    entries, total = audit_service.get_entries(
        user_id=user_id,
        conversation_id=conversation_id,
        limit=limit,
        offset=offset
    )
    
    return AuditLogResponse(
        entries=entries,
        total_count=total,
        page=(offset // limit) + 1,
        page_size=limit
    )


@router.get("/audit/{conversation_id}/trail")
async def get_conversation_audit_trail(
    conversation_id: str,
    user: Optional[UserInfo] = Depends(get_current_user)
):
    """
    Get complete audit trail for a conversation.
    
    Shows all actions in chronological order.
    """
    trail = audit_service.get_conversation_trail(conversation_id)
    return {
        "conversation_id": conversation_id,
        "trail": trail,
        "event_count": len(trail)
    }
