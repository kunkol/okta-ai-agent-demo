"""
MCP Protocol Handler - SSE Transport
Implements standard MCP (Model Context Protocol) over Server-Sent Events.

This enables compatibility with:
- Claude Desktop
- MCP-compatible AI clients
- Standard MCP tooling
"""

import json
import asyncio
from datetime import datetime
from typing import AsyncGenerator, Optional, Dict, Any
from fastapi import Request, Header, HTTPException
import logging

logger = logging.getLogger(__name__)

# Import tools
from tools.customer import get_customer_data
from tools.documents import search_documents_data
from tools.payments import initiate_payment_data
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

# =============================================================================
# MCP Protocol Constants
# =============================================================================

MCP_VERSION = "2024-11-05"
SERVER_NAME = "okta-ai-agent-demo"
SERVER_VERSION = "1.0.0"

# =============================================================================
# MCP Message Handlers
# =============================================================================

def create_mcp_response(id: str, result: Any) -> dict:
    """Create a JSON-RPC 2.0 response"""
    return {
        "jsonrpc": "2.0",
        "id": id,
        "result": result
    }

def create_mcp_error(id: str, code: int, message: str) -> dict:
    """Create a JSON-RPC 2.0 error response"""
    return {
        "jsonrpc": "2.0",
        "id": id,
        "error": {
            "code": code,
            "message": message
        }
    }

def handle_initialize(params: dict) -> dict:
    """Handle MCP initialize request"""
    return {
        "protocolVersion": MCP_VERSION,
        "serverInfo": {
            "name": SERVER_NAME,
            "version": SERVER_VERSION
        },
        "capabilities": {
            "tools": {}
        }
    }

def handle_tools_list() -> dict:
    """Handle MCP tools/list request"""
    return {
        "tools": [
            {
                "name": "get_customer",
                "description": "Retrieve customer information by name. Demonstrates FGA (Fine-Grained Authorization).",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Customer name (e.g., 'Alice', 'Bob', 'Charlie')"
                        }
                    },
                    "required": ["name"]
                }
            },
            {
                "name": "initiate_payment",
                "description": "Initiate a payment transfer. Amounts over $10,000 require CIBA approval.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "amount": {"type": "number", "description": "Payment amount in USD"},
                        "recipient": {"type": "string", "description": "Recipient name"},
                        "description": {"type": "string", "description": "Payment description"}
                    },
                    "required": ["amount", "recipient"]
                }
            },
            {
                "name": "search_documents",
                "description": "Search internal documents with role-based filtering.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search query"},
                        "user_role": {"type": "string", "enum": ["employee", "manager", "admin"]}
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "get_calendar_events",
                "description": "Retrieve calendar events via Token Vault (Google Calendar).",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "user_id": {"type": "string", "description": "User ID"},
                        "max_results": {"type": "integer", "description": "Max events to return"}
                    },
                    "required": []
                }
            },
            {
                "name": "post_to_slack",
                "description": "Post message to Slack via Token Vault.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "channel": {"type": "string", "description": "Slack channel"},
                        "message": {"type": "string", "description": "Message content"},
                        "user_id": {"type": "string", "description": "User ID"}
                    },
                    "required": ["channel", "message"]
                }
            },
            {
                "name": "create_github_issue",
                "description": "Create GitHub issue via Token Vault.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Issue title"},
                        "body": {"type": "string", "description": "Issue body"},
                        "repo": {"type": "string", "description": "Repository name"},
                        "user_id": {"type": "string", "description": "User ID"}
                    },
                    "required": ["title"]
                }
            },
            {
                "name": "get_github_repos",
                "description": "List GitHub repositories via Token Vault.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "user_id": {"type": "string", "description": "User ID"}
                    },
                    "required": []
                }
            },
            {
                "name": "run_data_analysis",
                "description": "Run data analysis on internal datasets (requires XAA).",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "analysis_type": {"type": "string", "enum": ["sales_summary", "pipeline", "churn", "forecast", "yoy_comparison"]},
                        "quarter": {"type": "string", "description": "Quarter (Q1-Q4)"},
                        "include_projections": {"type": "boolean"}
                    },
                    "required": []
                }
            },
            {
                "name": "run_compliance_check",
                "description": "Run compliance check (SOX, GDPR, SOC2).",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "check_type": {"type": "string", "enum": ["all", "data_retention", "pii_handling", "access_logging", "agent_authorization"]},
                        "resource": {"type": "string"},
                        "include_recommendations": {"type": "boolean"}
                    },
                    "required": []
                }
            },
            {
                "name": "coordinate_agents",
                "description": "Coordinate multiple agents for complex tasks.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "task_description": {"type": "string", "description": "Task to accomplish"},
                        "required_capabilities": {"type": "array", "items": {"type": "string"}},
                        "coordination_type": {"type": "string", "enum": ["sequential", "parallel", "hierarchical"]}
                    },
                    "required": ["task_description"]
                }
            },
            {
                "name": "get_agent_registry",
                "description": "Get list of registered agents.",
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "get_delegation_chain",
                "description": "Get full delegation chain for audit (User→App→Agent→Resource).",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "transaction_id": {"type": "string"},
                        "user_id": {"type": "string"},
                        "time_range_hours": {"type": "integer"}
                    },
                    "required": []
                }
            }
        ]
    }

def handle_tools_call(params: dict) -> dict:
    """Handle MCP tools/call request"""
    tool_name = params.get("name")
    arguments = params.get("arguments", {})
    
    try:
        # Route to appropriate tool
        if tool_name == "get_customer":
            result = get_customer_data(arguments.get("name", ""))
        elif tool_name == "initiate_payment":
            result = initiate_payment_data(
                amount=arguments.get("amount", 0),
                recipient=arguments.get("recipient", ""),
                description=arguments.get("description", "")
            )
        elif tool_name == "search_documents":
            result = search_documents_data(
                query=arguments.get("query", ""),
                user_role=arguments.get("user_role", "employee")
            )
        elif tool_name == "get_calendar_events":
            result = get_calendar_events(
                user_id=arguments.get("user_id", "alice"),
                max_results=arguments.get("max_results", 10)
            )
        elif tool_name == "post_to_slack":
            result = post_to_slack(
                user_id=arguments.get("user_id", "alice"),
                channel=arguments.get("channel", "team"),
                message=arguments.get("message", "")
            )
        elif tool_name == "create_github_issue":
            result = create_github_issue(
                user_id=arguments.get("user_id", "alice"),
                repo=arguments.get("repo", "okta-ai-agent-demo"),
                title=arguments.get("title", ""),
                body=arguments.get("body", "")
            )
        elif tool_name == "get_github_repos":
            result = get_github_repos(user_id=arguments.get("user_id", "alice"))
        elif tool_name == "run_data_analysis":
            result = run_data_analysis(
                analysis_type=arguments.get("analysis_type", "sales_summary"),
                quarter=arguments.get("quarter"),
                include_projections=arguments.get("include_projections", False)
            )
        elif tool_name == "run_compliance_check":
            result = run_compliance_check(
                check_type=arguments.get("check_type", "all"),
                resource=arguments.get("resource"),
                include_recommendations=arguments.get("include_recommendations", True)
            )
        elif tool_name == "coordinate_agents":
            result = coordinate_agents(
                task_description=arguments.get("task_description", ""),
                required_capabilities=arguments.get("required_capabilities"),
                coordination_type=arguments.get("coordination_type", "sequential")
            )
        elif tool_name == "get_agent_registry":
            result = get_agent_registry()
        elif tool_name == "get_delegation_chain":
            result = get_delegation_chain(
                transaction_id=arguments.get("transaction_id"),
                user_id=arguments.get("user_id"),
                time_range_hours=arguments.get("time_range_hours", 24)
            )
        else:
            return {"content": [{"type": "text", "text": f"Unknown tool: {tool_name}"}], "isError": True}
        
        return {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps(result, indent=2)
                }
            ],
            "isError": False
        }
        
    except Exception as e:
        logger.error(f"Tool execution error: {str(e)}")
        return {
            "content": [{"type": "text", "text": f"Error: {str(e)}"}],
            "isError": True
        }

def process_mcp_message(message: dict) -> dict:
    """Process incoming MCP JSON-RPC message"""
    msg_id = message.get("id")
    method = message.get("method")
    params = message.get("params", {})
    
    if method == "initialize":
        return create_mcp_response(msg_id, handle_initialize(params))
    elif method == "tools/list":
        return create_mcp_response(msg_id, handle_tools_list())
    elif method == "tools/call":
        return create_mcp_response(msg_id, handle_tools_call(params))
    elif method == "notifications/initialized":
        return None  # No response needed for notifications
    else:
        return create_mcp_error(msg_id, -32601, f"Method not found: {method}")

# =============================================================================
# SSE Stream Generator
# =============================================================================

async def sse_stream(request: Request) -> AsyncGenerator[str, None]:
    """Generate SSE stream for MCP protocol"""
    
    # Send initial connection event
    yield f"event: open\ndata: {json.dumps({'status': 'connected'})}\n\n"
    
    try:
        async for message in receive_messages(request):
            response = process_mcp_message(message)
            if response:
                yield f"event: message\ndata: {json.dumps(response)}\n\n"
    except asyncio.CancelledError:
        logger.info("SSE connection closed")
        raise

async def receive_messages(request: Request) -> AsyncGenerator[dict, None]:
    """Receive messages from client (placeholder for bidirectional SSE)"""
    # In a full implementation, this would handle incoming messages
    # For now, we'll wait for disconnection
    while True:
        if await request.is_disconnected():
            break
        await asyncio.sleep(0.1)
        yield None  # Placeholder
