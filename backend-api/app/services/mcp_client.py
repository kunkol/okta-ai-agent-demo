"""
MCP Server Client Service

Connects to the MCP Server deployed in C1:
https://okta-ai-agent-demo.onrender.com

Tools available:
- get_customer(name) - Returns customer data
- search_documents(query) - Document search
- initiate_payment(amount, recipient) - Payment processing
"""

import httpx
import logging
import time
from typing import Dict, Any, List, Optional

from app.config import settings
from app.models.schemas import MCPTool, MCPToolCallResponse, RiskLevel

logger = logging.getLogger(__name__)


class MCPClient:
    """Client for communicating with the MCP Server."""
    
    def __init__(self, base_url: str = None):
        self.base_url = base_url or settings.MCP_SERVER_URL
        self.timeout = 30.0
        
        # Define tool risk levels
        self.tool_risk_levels = {
            "get_customer": RiskLevel.LOW,
            "search_documents": RiskLevel.LOW,
            "initiate_payment": RiskLevel.HIGH,  # High risk for payments
        }
        
        # Define tools that require approval above threshold
        self.approval_thresholds = {
            "initiate_payment": 10000,  # Require approval for amounts > $10K
        }
    
    async def get_tools(self) -> List[MCPTool]:
        """Fetch available tools from MCP Server."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.base_url}/tools/list")
                response.raise_for_status()
                data = response.json()
                
                tools = []
                for tool in data.get("tools", []):
                    tools.append(MCPTool(
                        name=tool["name"],
                        description=tool["description"],
                        input_schema=tool.get("inputSchema", {})
                    ))
                
                logger.info(f"Fetched {len(tools)} tools from MCP Server")
                return tools
                
        except Exception as e:
            logger.error(f"Failed to fetch MCP tools: {e}")
            # Return fallback tool definitions
            return self._get_fallback_tools()
    
    def _get_fallback_tools(self) -> List[MCPTool]:
        """Fallback tool definitions if MCP Server is unavailable."""
        return [
            MCPTool(
                name="get_customer",
                description="Get customer information by name. Returns customer details including ID, email, account status, and tier.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Customer name to look up"
                        }
                    },
                    "required": ["name"]
                }
            ),
            MCPTool(
                name="search_documents",
                description="Search internal documents by query. Returns matching documents with titles, summaries, and access levels.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query"
                        }
                    },
                    "required": ["query"]
                }
            ),
            MCPTool(
                name="initiate_payment",
                description="Initiate a payment transfer. Requires approval for amounts over $10,000.",
                input_schema={
                    "type": "object",
                    "properties": {
                        "amount": {
                            "type": "number",
                            "description": "Payment amount in USD"
                        },
                        "recipient": {
                            "type": "string",
                            "description": "Recipient name or ID"
                        },
                        "description": {
                            "type": "string",
                            "description": "Payment description"
                        }
                    },
                    "required": ["amount", "recipient"]
                }
            )
        ]
    
    async def call_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        access_token: Optional[str] = None
    ) -> MCPToolCallResponse:
        """
        Call a tool on the MCP Server.
        
        Args:
            tool_name: Name of the tool to call
            arguments: Tool arguments
            access_token: Optional access token for authorization
            
        Returns:
            MCPToolCallResponse with result or error
        """
        start_time = time.time()
        
        try:
            headers = {"Content-Type": "application/json"}
            if access_token:
                headers["Authorization"] = f"Bearer {access_token}"
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/tools/call",
                    json={
                        "name": tool_name,
                        "arguments": arguments
                    },
                    headers=headers
                )
                
                execution_time = int((time.time() - start_time) * 1000)
                
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Tool {tool_name} executed successfully in {execution_time}ms")
                    return MCPToolCallResponse(
                        success=True,
                        result=data.get("result"),
                        execution_time_ms=execution_time
                    )
                elif response.status_code == 403:
                    logger.warning(f"Tool {tool_name} access denied")
                    return MCPToolCallResponse(
                        success=False,
                        error="Access denied - insufficient permissions",
                        execution_time_ms=execution_time
                    )
                else:
                    error_data = response.json()
                    logger.error(f"Tool {tool_name} failed: {error_data}")
                    return MCPToolCallResponse(
                        success=False,
                        error=error_data.get("error", "Unknown error"),
                        execution_time_ms=execution_time
                    )
                    
        except httpx.TimeoutException:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"Tool {tool_name} timed out")
            return MCPToolCallResponse(
                success=False,
                error="Request timed out",
                execution_time_ms=execution_time
            )
        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            logger.error(f"Tool {tool_name} error: {e}")
            return MCPToolCallResponse(
                success=False,
                error=str(e),
                execution_time_ms=execution_time
            )
    
    def get_tool_risk_level(self, tool_name: str) -> RiskLevel:
        """Get the risk level for a tool."""
        return self.tool_risk_levels.get(tool_name, RiskLevel.MEDIUM)
    
    def requires_approval(self, tool_name: str, arguments: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """
        Check if a tool call requires human approval.
        
        Returns:
            Tuple of (requires_approval, reason)
        """
        if tool_name == "initiate_payment":
            amount = arguments.get("amount", 0)
            threshold = self.approval_thresholds.get(tool_name, float("inf"))
            if amount > threshold:
                return True, f"Payment amount ${amount:,.2f} exceeds approval threshold of ${threshold:,.2f}"
        
        return False, None
    
    async def health_check(self) -> Dict[str, Any]:
        """Check MCP Server health."""
        try:
            start_time = time.time()
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/")
                latency = int((time.time() - start_time) * 1000)
                
                if response.status_code == 200:
                    return {
                        "status": "healthy",
                        "latency_ms": latency,
                        "message": "MCP Server is responding"
                    }
                else:
                    return {
                        "status": "degraded",
                        "latency_ms": latency,
                        "message": f"MCP Server returned status {response.status_code}"
                    }
        except Exception as e:
            return {
                "status": "unhealthy",
                "latency_ms": None,
                "message": str(e)
            }


# Global MCP client instance
mcp_client = MCPClient()
