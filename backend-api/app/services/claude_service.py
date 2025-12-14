"""
Claude AI Service

Integrates with Anthropic's Claude API for:
- Intelligent tool orchestration
- Natural language understanding
- Security-aware responses
"""

import anthropic
import logging
from typing import Dict, Any, List, Optional
import json

from app.config import settings
from app.models.schemas import ToolCall, ToolCallStatus, RiskLevel
from app.services.mcp_client import mcp_client

logger = logging.getLogger(__name__)


class ClaudeService:
    """Service for interacting with Claude AI."""
    
    def __init__(self):
        self.client = None
        self.model = settings.CLAUDE_MODEL
        self.max_tokens = settings.CLAUDE_MAX_TOKENS
        
        # System prompt for the AI agent
        self.system_prompt = """You are a helpful AI assistant integrated with an enterprise system secured by Okta.

You have access to the following tools:
1. get_customer(name) - Retrieve customer information by name
2. search_documents(query) - Search internal documents
3. initiate_payment(amount, recipient, description) - Process payments (requires approval for amounts over $10,000)

IMPORTANT SECURITY GUIDELINES:
- Always respect access controls. Some customers (like Charlie Wong) may be restricted.
- For high-value payments (>$10K), inform the user that approval is required.
- Never expose sensitive internal system details.
- Log all actions for audit purposes.

When using tools:
- Be specific about what information you're retrieving
- Explain the results clearly to the user
- If access is denied, explain that the user doesn't have permission"""
    
    def _ensure_client(self):
        """Ensure the Anthropic client is initialized."""
        if self.client is None:
            if not settings.ANTHROPIC_API_KEY:
                raise ValueError("ANTHROPIC_API_KEY not configured")
            self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    
    def _build_tools(self, mcp_tools: List[Dict]) -> List[Dict]:
        """Build Claude tool definitions from MCP tools."""
        tools = []
        for tool in mcp_tools:
            tools.append({
                "name": tool.name if hasattr(tool, "name") else tool["name"],
                "description": tool.description if hasattr(tool, "description") else tool["description"],
                "input_schema": tool.input_schema if hasattr(tool, "input_schema") else tool.get("inputSchema", {})
            })
        return tools
    
    async def process_message(
        self,
        message: str,
        conversation_history: List[Dict[str, str]] = None,
        user_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process a user message and return response with tool calls.
        
        Args:
            message: User's message
            conversation_history: Previous messages in the conversation
            user_context: User information from Okta token
            
        Returns:
            Dict containing response, tool_calls, and metadata
        """
        self._ensure_client()
        
        # Get available tools from MCP Server
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
                    
                    # Check if approval is required
                    requires_approval, approval_reason = mcp_client.requires_approval(
                        tool_name, tool_input
                    )
                    
                    tool_call = ToolCall(
                        tool_name=tool_name,
                        tool_input=tool_input,
                        risk_level=mcp_client.get_tool_risk_level(tool_name),
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
                    else:
                        # Execute the tool via MCP Server
                        mcp_response = await mcp_client.call_tool(tool_name, tool_input)
                        
                        if mcp_response.success:
                            tool_call.status = ToolCallStatus.COMPLETED
                            tool_call.tool_output = mcp_response.result
                            tool_result = mcp_response.result
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
