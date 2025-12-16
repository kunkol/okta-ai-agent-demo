"""
MCP Server for Okta AI Agent Security Demo
Project C1 - Part of the okta-ai-agent-demo

This server exposes tools that AI agents can call:
- get_customer: Retrieve customer data (with permission simulation)
- search_documents: Search documents (with FGA filtering)
- initiate_payment: Process payments (high-risk detection)

Will be secured with Okta Cross-App Access (XAA) in Project C4.
"""

from fastapi import FastAPI, HTTPException, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
import logging

# Import tools
from tools.customer import get_customer_data, CustomerResponse
from tools.documents import search_documents_data, DocumentSearchResponse
from tools.payments import initiate_payment_data, PaymentResponse
from tools.token_vault import (
    get_calendar_events,
    post_to_slack,
    create_github_issue,
    get_github_repos
)
from tools.internal_tools import (
    run_data_analysis,
    run_compliance_check,
    coordinate_agents,
    get_agent_registry,
    get_delegation_chain
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Okta AI Agent Demo - MCP Server",
    description="MCP Server with tools for AI Agent Security Demo",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration (will be tightened in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Will restrict in C4
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# Request/Response Models
# =============================================================================

class ToolCallRequest(BaseModel):
    tool_name: str
    parameters: dict
    
class ToolCallResponse(BaseModel):
    tool_name: str
    success: bool
    result: Any
    risk_level: Optional[str] = None
    requires_approval: bool = False
    timestamp: str
    
class ToolDefinition(BaseModel):
    name: str
    description: str
    parameters: dict
    risk_level: str

# =============================================================================
# Health & Discovery Endpoints
# =============================================================================

@app.get("/")
async def root():
    """Root endpoint with API info"""
    return {
        "message": "Okta AI Agent Demo - MCP Server",
        "version": "1.0.0",
        "docs": "/docs",
        "tools": "/tools/list"
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "mcp-server"
    }

# =============================================================================
# Tool Discovery Endpoints
# =============================================================================

@app.get("/tools/list", response_model=List[ToolDefinition])
async def list_tools():
    """List all available tools and their schemas"""
    return [
        # =====================================================================
        # SCENARIO 1: Customer Support (FGA Demo)
        # =====================================================================
        {
            "name": "get_customer",
            "description": "Retrieve customer information by name. Returns customer profile, account status, and permissions. Demonstrates FGA (Fine-Grained Authorization).",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Customer name to look up (e.g., 'Alice', 'Bob', 'Charlie')"
                    }
                },
                "required": ["name"]
            },
            "risk_level": "low",
            "category": "customer_support",
            "security_demo": "FGA allow/deny/partial access"
        },
        
        # =====================================================================
        # SCENARIO 2: Financial Transactions (Risk + CIBA)
        # =====================================================================
        {
            "name": "initiate_payment",
            "description": "Initiate a payment transfer. Amounts over $10,000 are flagged as high-risk and require CIBA (out-of-band) approval.",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {
                        "type": "number",
                        "description": "Payment amount in USD"
                    },
                    "recipient": {
                        "type": "string",
                        "description": "Recipient name or account"
                    },
                    "description": {
                        "type": "string",
                        "description": "Payment description/memo"
                    }
                },
                "required": ["amount", "recipient"]
            },
            "risk_level": "high",
            "category": "financial",
            "security_demo": "Risk-based authorization + CIBA human-in-the-loop"
        },
        
        # =====================================================================
        # SCENARIO 3: RAG Document Search (Role-Based)
        # =====================================================================
        {
            "name": "search_documents",
            "description": "Search internal documents with permission-based filtering. Returns documents the requesting user has access to based on role.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query for documents"
                    },
                    "user_role": {
                        "type": "string",
                        "description": "Role of requesting user for permission filtering",
                        "enum": ["employee", "manager", "admin"]
                    }
                },
                "required": ["query"]
            },
            "risk_level": "medium",
            "category": "documents",
            "security_demo": "Role-based document filtering for RAG"
        },
        
        # =====================================================================
        # SCENARIO 4: Token Vault (Third-Party APIs)
        # =====================================================================
        {
            "name": "get_calendar_events",
            "description": "Retrieve calendar events via Token Vault. Demonstrates OAuth token exchange for Google Calendar.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "User requesting calendar access"
                    },
                    "date": {
                        "type": "string",
                        "description": "Date to fetch events (YYYY-MM-DD)"
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum events to return"
                    }
                },
                "required": []
            },
            "risk_level": "medium",
            "category": "token_vault",
            "security_demo": "Token Vault - Google Calendar OAuth exchange"
        },
        {
            "name": "post_to_slack",
            "description": "Post message to Slack via Token Vault. Agent never sees raw OAuth credentials.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "User on whose behalf to post"
                    },
                    "channel": {
                        "type": "string",
                        "description": "Slack channel name (without #)"
                    },
                    "message": {
                        "type": "string",
                        "description": "Message content to post"
                    }
                },
                "required": ["channel", "message"]
            },
            "risk_level": "medium",
            "category": "token_vault",
            "security_demo": "Token Vault - Slack OAuth exchange"
        },
        {
            "name": "create_github_issue",
            "description": "Create GitHub issue via Token Vault. Demonstrates external service access with scoped tokens.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "User on whose behalf to create issue"
                    },
                    "repo": {
                        "type": "string",
                        "description": "Repository name"
                    },
                    "title": {
                        "type": "string",
                        "description": "Issue title"
                    },
                    "body": {
                        "type": "string",
                        "description": "Issue body/description"
                    },
                    "labels": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Labels to apply"
                    }
                },
                "required": ["title"]
            },
            "risk_level": "medium",
            "category": "token_vault",
            "security_demo": "Token Vault - GitHub OAuth exchange"
        },
        {
            "name": "get_github_repos",
            "description": "List GitHub repositories via Token Vault.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {
                        "type": "string",
                        "description": "User requesting repo list"
                    }
                },
                "required": []
            },
            "risk_level": "low",
            "category": "token_vault",
            "security_demo": "Token Vault - GitHub read access"
        },
        
        # =====================================================================
        # SCENARIO 5: Internal MCP Tools (XAA/ID-JAG)
        # =====================================================================
        {
            "name": "run_data_analysis",
            "description": "Run data analysis on internal datasets. Requires ID-JAG authentication with proper audience.",
            "parameters": {
                "type": "object",
                "properties": {
                    "analysis_type": {
                        "type": "string",
                        "description": "Type of analysis",
                        "enum": ["sales_summary", "pipeline", "churn", "forecast", "yoy_comparison"]
                    },
                    "quarter": {
                        "type": "string",
                        "description": "Specific quarter (Q1-Q4)"
                    },
                    "include_projections": {
                        "type": "boolean",
                        "description": "Include AI-generated projections"
                    }
                },
                "required": []
            },
            "risk_level": "medium",
            "category": "internal_mcp",
            "security_demo": "XAA/ID-JAG - Internal MCP tool access"
        },
        {
            "name": "run_compliance_check",
            "description": "Run compliance check against SOX, GDPR, SOC2 requirements.",
            "parameters": {
                "type": "object",
                "properties": {
                    "check_type": {
                        "type": "string",
                        "description": "Type of compliance check",
                        "enum": ["all", "data_retention", "pii_handling", "access_logging", "agent_authorization"]
                    },
                    "resource": {
                        "type": "string",
                        "description": "Specific resource to check"
                    },
                    "include_recommendations": {
                        "type": "boolean",
                        "description": "Include remediation recommendations"
                    }
                },
                "required": []
            },
            "risk_level": "low",
            "category": "internal_mcp",
            "security_demo": "XAA - Compliance and audit tools"
        },
        {
            "name": "coordinate_agents",
            "description": "Coordinate multiple agents for complex tasks. Demonstrates multi-agent orchestration with XAA.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_description": {
                        "type": "string",
                        "description": "Description of the task"
                    },
                    "required_capabilities": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Required agent capabilities"
                    },
                    "coordination_type": {
                        "type": "string",
                        "description": "How to coordinate",
                        "enum": ["sequential", "parallel", "hierarchical"]
                    }
                },
                "required": ["task_description"]
            },
            "risk_level": "high",
            "category": "internal_mcp",
            "security_demo": "Multi-agent coordination with delegation chains"
        },
        {
            "name": "get_agent_registry",
            "description": "Get list of registered agents and their capabilities.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            },
            "risk_level": "low",
            "category": "internal_mcp",
            "security_demo": "Agent discovery and registry"
        },
        {
            "name": "get_delegation_chain",
            "description": "Retrieve full delegation chain for audit. Shows User → App → Agent → Resource with cryptographic proof.",
            "parameters": {
                "type": "object",
                "properties": {
                    "transaction_id": {
                        "type": "string",
                        "description": "Specific transaction to trace"
                    },
                    "user_id": {
                        "type": "string",
                        "description": "Filter by user"
                    },
                    "time_range_hours": {
                        "type": "integer",
                        "description": "How far back to look"
                    }
                },
                "required": []
            },
            "risk_level": "low",
            "category": "audit",
            "security_demo": "Delegation chain visibility and audit trail"
        }
    ]

# =============================================================================
# Tool Execution Endpoints
# =============================================================================

@app.post("/tools/call", response_model=ToolCallResponse)
async def call_tool(
    request: ToolCallRequest,
    req: Request,
    authorization: Optional[str] = Header(None)
):
    """
    Execute a tool call with optional Okta token validation.
    
    Token validation is optional for backward compatibility:
    - If token provided: validates and includes claims in audit
    - If no token: allows access (backward compatible mode)
    """
    logger.info(f"Tool call: {request.tool_name} with params: {request.parameters}")
    
    # Token validation (optional - backward compatible)
    headers = dict(req.headers)
    is_valid, claims, error = await validate_request_token(headers)
    
    if not is_valid:
        logger.warning(f"Token validation failed: {error}")
        raise HTTPException(status_code=401, detail=f"Authentication failed: {error}")
    
    # Log authentication context
    if claims:
        logger.info(f"Authenticated: sub={claims.get('sub')}, client_id={claims.get('client_id')}")
    else:
        logger.info("Unauthenticated request (backward compatible mode)")
    
    timestamp = datetime.utcnow().isoformat()
    
    try:
        # =================================================================
        # SCENARIO 1: Customer Support (FGA)
        # =================================================================
        if request.tool_name == "get_customer":
            result = get_customer_data(request.parameters.get("name", ""))
            return ToolCallResponse(
                tool_name="get_customer",
                success=result.get("success", False),
                result=result,
                risk_level="low",
                requires_approval=False,
                timestamp=timestamp
            )
        
        # =================================================================
        # SCENARIO 2: Financial Transactions (Risk + CIBA)
        # =================================================================
        elif request.tool_name == "initiate_payment":
            result = initiate_payment_data(
                amount=request.parameters.get("amount", 0),
                recipient=request.parameters.get("recipient", ""),
                description=request.parameters.get("description", "")
            )
            return ToolCallResponse(
                tool_name="initiate_payment",
                success=result.get("success", False),
                result=result,
                risk_level=result.get("risk_level", "low"),
                requires_approval=result.get("requires_approval", False),
                timestamp=timestamp
            )
        
        # =================================================================
        # SCENARIO 3: RAG Document Search (Role-Based)
        # =================================================================
        elif request.tool_name == "search_documents":
            result = search_documents_data(
                query=request.parameters.get("query", ""),
                user_role=request.parameters.get("user_role", "employee")
            )
            return ToolCallResponse(
                tool_name="search_documents",
                success=True,
                result=result,
                risk_level="medium",
                requires_approval=False,
                timestamp=timestamp
            )
        
        # =================================================================
        # SCENARIO 4: Token Vault (Third-Party APIs)
        # =================================================================
        elif request.tool_name == "get_calendar_events":
            result = get_calendar_events(
                user_id=request.parameters.get("user_id", "alice"),
                date=request.parameters.get("date"),
                max_results=request.parameters.get("max_results", 10)
            )
            return ToolCallResponse(
                tool_name="get_calendar_events",
                success=result.get("success", False),
                result=result,
                risk_level="medium",
                requires_approval=result.get("requires_oauth", False),
                timestamp=timestamp
            )
            
        elif request.tool_name == "post_to_slack":
            result = post_to_slack(
                user_id=request.parameters.get("user_id", "alice"),
                channel=request.parameters.get("channel", "team"),
                message=request.parameters.get("message", ""),
                as_user=request.parameters.get("as_user", True)
            )
            return ToolCallResponse(
                tool_name="post_to_slack",
                success=result.get("success", False),
                result=result,
                risk_level="medium",
                requires_approval=result.get("requires_oauth", False),
                timestamp=timestamp
            )
            
        elif request.tool_name == "create_github_issue":
            result = create_github_issue(
                user_id=request.parameters.get("user_id", "alice"),
                repo=request.parameters.get("repo", "okta-ai-agent-demo"),
                title=request.parameters.get("title", ""),
                body=request.parameters.get("body", ""),
                labels=request.parameters.get("labels", [])
            )
            return ToolCallResponse(
                tool_name="create_github_issue",
                success=result.get("success", False),
                result=result,
                risk_level="medium",
                requires_approval=result.get("requires_oauth", False),
                timestamp=timestamp
            )
            
        elif request.tool_name == "get_github_repos":
            result = get_github_repos(
                user_id=request.parameters.get("user_id", "alice")
            )
            return ToolCallResponse(
                tool_name="get_github_repos",
                success=result.get("success", False),
                result=result,
                risk_level="low",
                requires_approval=False,
                timestamp=timestamp
            )
        
        # =================================================================
        # SCENARIO 5: Internal MCP Tools (XAA/ID-JAG)
        # =================================================================
        elif request.tool_name == "run_data_analysis":
            result = run_data_analysis(
                analysis_type=request.parameters.get("analysis_type", "sales_summary"),
                quarter=request.parameters.get("quarter"),
                metrics=request.parameters.get("metrics"),
                include_projections=request.parameters.get("include_projections", False)
            )
            return ToolCallResponse(
                tool_name="run_data_analysis",
                success=result.get("success", False),
                result=result,
                risk_level="medium",
                requires_approval=False,
                timestamp=timestamp
            )
            
        elif request.tool_name == "run_compliance_check":
            result = run_compliance_check(
                check_type=request.parameters.get("check_type", "all"),
                resource=request.parameters.get("resource"),
                include_recommendations=request.parameters.get("include_recommendations", True)
            )
            return ToolCallResponse(
                tool_name="run_compliance_check",
                success=result.get("success", False),
                result=result,
                risk_level="low",
                requires_approval=False,
                timestamp=timestamp
            )
            
        elif request.tool_name == "coordinate_agents":
            result = coordinate_agents(
                task_description=request.parameters.get("task_description", ""),
                required_capabilities=request.parameters.get("required_capabilities"),
                coordination_type=request.parameters.get("coordination_type", "sequential")
            )
            return ToolCallResponse(
                tool_name="coordinate_agents",
                success=result.get("success", False),
                result=result,
                risk_level="high",
                requires_approval=False,
                timestamp=timestamp
            )
            
        elif request.tool_name == "get_agent_registry":
            result = get_agent_registry()
            return ToolCallResponse(
                tool_name="get_agent_registry",
                success=result.get("success", False),
                result=result,
                risk_level="low",
                requires_approval=False,
                timestamp=timestamp
            )
            
        elif request.tool_name == "get_delegation_chain":
            result = get_delegation_chain(
                transaction_id=request.parameters.get("transaction_id"),
                user_id=request.parameters.get("user_id"),
                time_range_hours=request.parameters.get("time_range_hours", 24)
            )
            return ToolCallResponse(
                tool_name="get_delegation_chain",
                success=result.get("success", False),
                result=result,
                risk_level="low",
                requires_approval=False,
                timestamp=timestamp
            )
            
        else:
            raise HTTPException(status_code=404, detail=f"Tool '{request.tool_name}' not found")
            
    except Exception as e:
        logger.error(f"Tool execution error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# Individual Tool Endpoints (for direct access)
# =============================================================================

# ----- SCENARIO 1: Customer Support -----
@app.get("/tools/get_customer/{name}")
async def get_customer_endpoint(name: str):
    """Direct endpoint for get_customer tool"""
    return get_customer_data(name)

# ----- SCENARIO 2: Financial Transactions -----
@app.post("/tools/initiate_payment")
async def initiate_payment_endpoint(
    amount: float,
    recipient: str,
    description: str = ""
):
    """Direct endpoint for initiate_payment tool"""
    return initiate_payment_data(amount, recipient, description)

# ----- SCENARIO 3: RAG Document Search -----
@app.get("/tools/search_documents")
async def search_documents_endpoint(query: str, user_role: str = "employee"):
    """Direct endpoint for search_documents tool"""
    return search_documents_data(query, user_role)

# ----- SCENARIO 4: Token Vault Tools -----
@app.get("/tools/calendar/events")
async def calendar_events_endpoint(
    user_id: str = "alice",
    date: str = None,
    max_results: int = 10
):
    """Get calendar events via Token Vault"""
    return get_calendar_events(user_id, date, max_results)

@app.post("/tools/slack/post")
async def slack_post_endpoint(
    channel: str,
    message: str,
    user_id: str = "alice",
    as_user: bool = True
):
    """Post to Slack via Token Vault"""
    return post_to_slack(user_id, channel, message, as_user)

@app.post("/tools/github/issues")
async def github_issue_endpoint(
    title: str,
    repo: str = "okta-ai-agent-demo",
    body: str = "",
    user_id: str = "alice"
):
    """Create GitHub issue via Token Vault"""
    return create_github_issue(user_id, repo, title, body)

@app.get("/tools/github/repos")
async def github_repos_endpoint(user_id: str = "alice"):
    """List GitHub repos via Token Vault"""
    return get_github_repos(user_id)

# ----- SCENARIO 5: Internal MCP Tools (XAA) -----
@app.get("/tools/analysis/run")
async def data_analysis_endpoint(
    analysis_type: str = "sales_summary",
    quarter: str = None,
    include_projections: bool = False
):
    """Run data analysis (requires XAA/ID-JAG in production)"""
    return run_data_analysis(analysis_type, quarter, include_projections=include_projections)

@app.get("/tools/compliance/check")
async def compliance_check_endpoint(
    check_type: str = "all",
    resource: str = None,
    include_recommendations: bool = True
):
    """Run compliance check"""
    return run_compliance_check(check_type, resource, include_recommendations)

@app.post("/tools/agents/coordinate")
async def coordinate_agents_endpoint(
    task_description: str,
    coordination_type: str = "sequential"
):
    """Coordinate multiple agents for complex tasks"""
    return coordinate_agents(task_description, coordination_type=coordination_type)

@app.get("/tools/agents/registry")
async def agent_registry_endpoint():
    """Get list of registered agents"""
    return get_agent_registry()

@app.get("/tools/audit/delegation-chain")
async def delegation_chain_endpoint(
    transaction_id: str = None,
    user_id: str = None,
    time_range_hours: int = 24
):
    """Get delegation chain for audit"""
    return get_delegation_chain(transaction_id, user_id, time_range_hours)

# =============================================================================
# Audit Log Endpoint (for demo visualization)
# =============================================================================

# In-memory audit log (would be database in production)
audit_log = []

@app.get("/audit/log")
async def get_audit_log():
    """Get recent audit entries for demo visualization"""
    return {"entries": audit_log[-50:]}  # Last 50 entries

@app.post("/audit/log")
async def add_audit_entry(entry: dict):
    """Add audit entry (called by backend in C2)"""
    entry["timestamp"] = datetime.utcnow().isoformat()
    audit_log.append(entry)
    return {"success": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


# =============================================================================
# MCP Protocol Endpoints (SSE Transport)
# =============================================================================

from fastapi.responses import StreamingResponse
from mcp_protocol import process_mcp_message, MCP_VERSION, SERVER_NAME, SERVER_VERSION
from token_validator import validate_request_token, validate_token, TokenValidationResult
import json

@app.get("/sse")
async def mcp_sse_endpoint(request: Request):
    """
    MCP Server-Sent Events endpoint.
    This is the standard MCP transport for Claude Desktop and other MCP clients.
    """
    async def event_stream():
        # Send endpoint info
        yield f"event: endpoint\ndata: /messages\n\n"
        
        # Keep connection alive
        while True:
            if await request.is_disconnected():
                break
            yield ": keepalive\n\n"
            await asyncio.sleep(30)
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "*"
        }
    )

@app.post("/messages")
async def mcp_messages_endpoint(request: Request):
    """
    MCP messages endpoint for JSON-RPC communication.
    Handles initialize, tools/list, and tools/call methods.
    """
    try:
        body = await request.json()
        response = process_mcp_message(body)
        return response
    except Exception as e:
        logger.error(f"MCP message error: {str(e)}")
        return {
            "jsonrpc": "2.0",
            "id": None,
            "error": {"code": -32700, "message": f"Parse error: {str(e)}"}
        }

@app.get("/.well-known/oauth-protected-resource")
async def oauth_protected_resource():
    """
    RFC 9728 Protected Resource Metadata.
    Tells MCP clients where to authenticate.
    """
    return {
        "resource": "https://okta-ai-agent-demo.onrender.com",
        "authorization_servers": ["https://qa-aiagentsproducttc1.trexcloud.com/oauth2/default"],
        "scopes_supported": ["read_data", "write_data", "payments", "analytics", "compliance"],
        "bearer_methods_supported": ["header"]
    }

@app.get("/mcp/info")
async def mcp_info():
    """MCP Server information endpoint"""
    return {
        "name": SERVER_NAME,
        "version": SERVER_VERSION,
        "protocol_version": MCP_VERSION,
        "transport": "sse",
        "endpoints": {
            "sse": "/sse",
            "messages": "/messages",
            "oauth_metadata": "/.well-known/oauth-protected-resource"
        },
        "tools_count": 12,
        "capabilities": ["tools"]
    }



# =============================================================================
# Token Validation Endpoint
# =============================================================================

@app.post("/auth/validate")
async def validate_token_endpoint(request: Request):
    """
    Validate a token and return claims.
    Useful for debugging and testing token validation.
    """
    headers = dict(request.headers)
    is_valid, claims, error = await validate_request_token(headers)
    
    return {
        "valid": is_valid,
        "claims": claims,
        "error": error,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/auth/info")
async def auth_info():
    """Return authentication configuration info"""
    return {
        "auth_enabled": True,
        "auth_optional": True,
        "okta_domain": "qa-aiagentsproducttc1.trexcloud.com",
        "okta_issuer": "https://qa-aiagentsproducttc1.trexcloud.com/oauth2/default",
        "supported_headers": ["Authorization", "mcp_token", "mcp-token", "x-mcp-token"],
        "note": "Token validation is optional for backward compatibility"
    }

import asyncio
