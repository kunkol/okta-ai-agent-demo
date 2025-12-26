"""
Claude AI Service

Integrates with Anthropic's Claude API for:
- Intelligent tool orchestration
- Natural language understanding
- Security-aware responses

Supports Cross-App Access (XAA) by passing user tokens to MCP client.
Supports Token Vault for external APIs (Salesforce, Google Calendar).
"""

import anthropic
import logging
from typing import Dict, Any, List, Optional
import json
import jwt

from app.config import settings
from app.models.schemas import ToolCall, ToolCallStatus, RiskLevel
from app.services.mcp_client import mcp_client

# Token Vault imports
from app.services.token_vault_service import (
    token_vault_service, 
    AccountNotLinkedError, 
    TokenExchangeError
)
from app.services.salesforce_tools import (
    SALESFORCE_TOOLS,
    get_salesforce_contact,
    get_salesforce_opportunities,
    get_salesforce_accounts
)
from app.services.google_calendar_tools import (
    CALENDAR_TOOLS,
    list_calendar_events,
    get_meetings_with_contact,
    create_calendar_event
)

logger = logging.getLogger(__name__)

# Token Vault tool names (for routing)
TOKEN_VAULT_TOOLS = {
    "get_salesforce_contact",
    "get_salesforce_opportunities",
    "get_salesforce_accounts",
    "list_calendar_events",
    "get_meetings_with_contact",
    "create_calendar_event"
}


class ClaudeService:
    """Service for interacting with Claude AI."""
    
    def __init__(self):
        self.client = None
        self.model = settings.CLAUDE_MODEL
        self.max_tokens = settings.CLAUDE_MAX_TOKENS
        
        # System prompt for the AI agent
        self.system_prompt = """You are Sarah Green, a Senior Financial Advisor AI assistant at Apex Financial Services. You help manage client portfolios and relationships.

You have access to the following tools:

INTERNAL TOOLS (via MCP Server):
1. get_customer(name) - Retrieve customer information from internal CRM
2. search_documents(query) - Search internal documents
3. initiate_payment(amount, recipient, description) - Process payments (requires approval for amounts over $10,000)

SALESFORCE TOOLS (via Token Vault):
4. get_salesforce_contact(name) - Get contact details from Salesforce CRM
5. get_salesforce_opportunities(account_name, stage) - Get sales opportunities
6. get_salesforce_accounts(industry) - Get accounts by industry

GOOGLE CALENDAR TOOLS (via Token Vault):
7. list_calendar_events(days_ahead, search_query) - List upcoming calendar events
8. get_meetings_with_contact(contact_name, days_ahead) - Find meetings with a specific person
9. create_calendar_event(summary, start_time, end_time, description, location, attendees) - Schedule a meeting

IMPORTANT SECURITY GUIDELINES:
- Always respect access controls. Some customers may be restricted.
- For high-value payments (>$10K), inform the user that approval is required.
- External tools (Salesforce, Google) use Token Vault for secure token exchange.
- Never expose sensitive internal system details.
- Log all actions for audit purposes.

When using tools:
- Be specific about what information you're retrieving
- Explain the results clearly to the user
- If access is denied, explain that the user doesn't have permission
- For Token Vault tools, if account is not linked, tell the user to link their account"""
    
    def _ensure_client(self):
        """Ensure the Anthropic client is initialized."""
        if self.client is None:
            if not settings.ANTHROPIC_API_KEY:
                raise ValueError("ANTHROPIC_API_KEY not configured")
            self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    
    def _build_tools(self, mcp_tools: List[Dict]) -> List[Dict]:
        """Build Claude tool definitions from MCP tools + Token Vault tools."""
        tools = []
        
        # Add existing MCP tools
        for tool in mcp_tools:
            tools.append({
                "name": tool.name if hasattr(tool, "name") else tool["name"],
                "description": tool.description if hasattr(tool, "description") else tool["description"],
                "input_schema": tool.input_schema if hasattr(tool, "input_schema") else tool.get("inputSchema", {})
            })
        
        # Add Salesforce tools (from Token Vault)
        tools.extend(SALESFORCE_TOOLS)
        
        # Add Google Calendar tools (from Token Vault)
        tools.extend(CALENDAR_TOOLS)
        
        return tools
    
    def _get_tool_risk_level(self, tool_name: str) -> RiskLevel:
        """Get risk level for a tool (MCP or Token Vault)."""
        if tool_name in TOKEN_VAULT_TOOLS:
            if tool_name == "create_calendar_event":
                return RiskLevel.MEDIUM
            return RiskLevel.LOW
        return mcp_client.get_tool_risk_level(tool_name)
    
    async def _execute_token_vault_tool(
        self, 
        tool_name: str, 
        tool_input: dict, 
        okta_token: str
    ) -> dict:
        """
        Execute a Token Vault tool (Salesforce or Google Calendar).
        """
        try:
            # Extract user ID from Okta token
            decoded = jwt.decode(okta_token, options={"verify_signature": False})
            user_id = decoded.get("uid") or decoded.get("sub")
            
            # Salesforce tools
            if tool_name == "get_salesforce_contact":
                sf_token = await token_vault_service.get_salesforce_token(okta_token, user_id)
                return await get_salesforce_contact(sf_token, tool_input["name"])
            
            elif tool_name == "get_salesforce_opportunities":
                sf_token = await token_vault_service.get_salesforce_token(okta_token, user_id)
                return await get_salesforce_opportunities(
                    sf_token,
                    account_name=tool_input.get("account_name"),
                    stage=tool_input.get("stage")
                )
            
            elif tool_name == "get_salesforce_accounts":
                sf_token = await token_vault_service.get_salesforce_token(okta_token, user_id)
                return await get_salesforce_accounts(
                    sf_token,
                    industry=tool_input.get("industry")
                )
            
            # Google Calendar tools
            elif tool_name == "list_calendar_events":
                google_token = await token_vault_service.get_google_token(okta_token, user_id)
                return await list_calendar_events(
                    google_token,
                    days_ahead=tool_input.get("days_ahead", 7),
                    search_query=tool_input.get("search_query")
                )
            
            elif tool_name == "get_meetings_with_contact":
                google_token = await token_vault_service.get_google_token(okta_token, user_id)
                return await get_meetings_with_contact(
                    google_token,
                    contact_name=tool_input["contact_name"],
                    days_ahead=tool_input.get("days_ahead", 30)
                )
            
            elif tool_name == "create_calendar_event":
                google_token = await token_vault_service.get_google_token(okta_token, user_id)
                return await create_calendar_event(
                    google_token,
                    summary=tool_input["summary"],
                    start_time=tool_input["start_time"],
                    end_time=tool_input["end_time"],
                    description=tool_input.get("description"),
                    location=tool_input.get("location"),
                    attendees=tool_input.get("attendees")
                )
            
            return {"success": False, "error": f"Unknown Token Vault tool: {tool_name}"}
            
        except AccountNotLinkedError as e:
            logger.warning(f"Account not linked for {tool_name}: {e}")
            return {
                "success": False,
                "error": "account_not_linked",
                "connection": e.connection,
                "message": f"Please link your {e.connection} account to continue. Visit account settings to connect."
            }
        except TokenExchangeError as e:
            logger.error(f"Token exchange failed for {tool_name}: {e}")
            return {
                "success": False,
                "error": "token_exchange_failed",
                "message": "Unable to authenticate with external service. Please try again."
            }
        except Exception as e:
            logger.error(f"Token Vault tool error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def process_message(
        self,
        message: str,
        conversation_history: List[Dict[str, str]] = None,
        user_context: Optional[Dict[str, Any]] = None,
        user_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process a user message and return response with tool calls.
        
        Args:
            message: User's message
            conversation_history: Previous messages in the conversation
            user_context: User information from Okta token
            user_token: User's access token for XAA token exchange
            
        Returns:
            Dict containing response, tool_calls, and metadata
        """
        self._ensure_client()
        
        # Get available tools from MCP Server + Token Vault
        mcp_tools = await mcp_client.get_tools()
        tools = self._build_tools(mcp_tools)
        
        # Build messages array
        messages = []
        if conversation_history:
            messages.extend(conversation_history)
        messages.append({"role": "user", "content": message})
        
        # Add user context to system prompt if available
        system = self.system_prompt
        if user_context:
            system += f"\n\nCurrent user: {user_context.get('name', 'Unknown')} ({user_context.get('email', 'N/A')})"
            if user_context.get("groups"):
                system += f"\nUser groups: {', '.join(user_context['groups'])}"
        
        tool_calls = []
        final_response = ""
        xaa_performed = False
        token_vault_used = False
        
        try:
            # Initial Claude call
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system,
                tools=tools,
                messages=messages
            )
            
            # Process response - handle tool use
            while response.stop_reason == "tool_use":
                # Extract tool use from response
                tool_use_blocks = [
                    block for block in response.content 
                    if block.type == "tool_use"
                ]
                
                # Process each tool call
                tool_results = []
                for tool_use in tool_use_blocks:
                    tool_name = tool_use.name
                    tool_input = tool_use.input
                    
                    logger.info(f"Claude requesting tool: {tool_name} with input: {tool_input}")
                    
                    # Check if approval is required (for MCP tools)
                    requires_approval = False
                    approval_reason = None
                    if tool_name not in TOKEN_VAULT_TOOLS:
                        requires_approval, approval_reason = mcp_client.requires_approval(
                            tool_name, tool_input
                        )
                    
                    tool_call = ToolCall(
                        tool_name=tool_name,
                        tool_input=tool_input,
                        risk_level=self._get_tool_risk_level(tool_name),
                        requires_approval=requires_approval,
                        approval_reason=approval_reason
                    )
                    
                    if requires_approval:
                        # For demo, we'll proceed but mark as requiring approval
                        tool_call.status = ToolCallStatus.REQUIRES_APPROVAL
                        tool_result = {
                            "status": "pending_approval",
                            "message": approval_reason,
                            "note": "In production, this would trigger CIBA approval flow"
                        }
                    elif tool_name in TOKEN_VAULT_TOOLS:
                        # Execute via Token Vault
                        logger.info(f"Executing Token Vault tool: {tool_name}")
                        
                        if not user_token:
                            tool_result = {
                                "success": False,
                                "error": "No user token available for Token Vault"
                            }
                            tool_call.status = ToolCallStatus.FAILED
                        else:
                            tool_result = await self._execute_token_vault_tool(
                                tool_name, tool_input, user_token
                            )
                            
                            if isinstance(tool_result, dict) and tool_result.get("success") == False:
                                tool_call.status = ToolCallStatus.FAILED
                                tool_call.error = tool_result.get("error")
                            else:
                                tool_call.status = ToolCallStatus.COMPLETED
                                tool_call.tool_output = tool_result
                                token_vault_used = True
                    else:
                        # Execute the tool via MCP Server with XAA token exchange
                        mcp_response = await mcp_client.call_tool(
                            tool_name, 
                            tool_input,
                            user_token=user_token  # Pass user token for XAA
                        )
                        
                        if mcp_response.success:
                            tool_call.status = ToolCallStatus.COMPLETED
                            tool_call.tool_output = mcp_response.result
                            tool_result = mcp_response.result
                            
                            # Track if XAA was performed
                            if hasattr(mcp_response, 'xaa_token_used') and mcp_response.xaa_token_used:
                                xaa_performed = True
                        else:
                            tool_call.status = ToolCallStatus.FAILED
                            tool_result = {"error": mcp_response.error}
                        
                        tool_call.execution_time_ms = mcp_response.execution_time_ms
                    
                    tool_calls.append(tool_call)
                    
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_use.id,
                        "content": json.dumps(tool_result) if isinstance(tool_result, dict) else str(tool_result)
                    })
                
                # Continue conversation with tool results
                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": tool_results})
                
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=self.max_tokens,
                    system=system,
                    tools=tools,
                    messages=messages
                )
            
            # Extract final text response
            for block in response.content:
                if hasattr(block, "text"):
                    final_response += block.text
            
            return {
                "response": final_response,
                "tool_calls": tool_calls,
                "xaa_performed": xaa_performed,
                "token_vault_used": token_vault_used,
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens
                }
            }
            
        except anthropic.APIError as e:
            logger.error(f"Claude API error: {e}")
            raise
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            raise
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Claude API health."""
        try:
            self._ensure_client()
            # Simple test call
            response = self.client.messages.create(
                model=self.model,
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}]
            )
            return {
                "status": "healthy",
                "message": "Claude API is responding"
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "message": str(e)
            }


# Global Claude service instance
claude_service = ClaudeService()
