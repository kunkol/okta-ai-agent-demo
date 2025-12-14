"""
MCP Server Client Service

Connects to the MCP Server deployed in C1:
https://okta-ai-agent-demo.onrender.com
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
        
        self.tool_risk_levels = {
            "get_customer": RiskLevel.LOW,
            "search_documents": RiskLevel.LOW,
            "initiate_payment": RiskLevel.HIGH,
        }
        
        self.approval_thresholds = {
            "initiate_payment": 10000,
        }
    
    async def get_tools(self) -> List[MCPTool]:
        """Fetch available tools from MCP Server."""
        # Always use well-defined fallback tools to ensure Claude compatibility
        return self._get_fallback_tools()
    
    def _get_fallback_tools(self) -> List[MCPTool]:
        """Tool definitions compatible with Claude API."""
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
                description="Search internal documents by query. Returns matching documents with titles and summaries.",
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
        """Call a tool on the MCP Server."""
        start_time = time.time()
        
        try:
            headers = {"Content-Type": "application/json"}
            if access_token:
                headers["Authorization"] = f"Bearer {access_token}"
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/tools/call",
                    json={
                        "tool_name": tool_name,
                        "parameters": arguments
                    },
                    headers=headers
                )
                
                execution_time = int((time.time() - start_time) * 1000)
                
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Tool {tool_name} executed successfully in {execution_time}ms")
                    return MCPToolCallResponse(
                        success=True,
                        result=data.get("result", data),
                        execution_time_ms=execution_time
                    )
                elif response.status_code == 403:
                    logger.warning(f"Tool {tool_name} access denied")
                    return MCPToolCallResponse(
                        success=False,
                        error="Access denied",
                        execution_time_ms=execution_time
                    )
                else:
                    error_data = response.json()
                    logger.error(f"Tool {tool_name} failed: {error_data}")
                    return MCPToolCallResponse(
                        success=False,
                        error=str(error_data.get("detail", error_data)),
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
        """Check if a tool call requires human approval."""
        if tool_name == "initiate_payment":
            amount = arguments.get("amount", 0)
            threshold = self.approval_thresholds.get(tool_name, float("inf"))
            if amount > threshold:
                return True, f"Payment amount ${amount:,.2f} exceeds threshold"
        return False, None
    
    async def health_check(self) -> Dict[str, Any]:
        """Check MCP Server health."""
        try:
            start_time = time.time()
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/")
                latency = int((time.time() - start_time) * 1000)
                
                if response.status_code == 200:
                    return {"status": "healthy", "latency_ms": latency, "message": "MCP Server is responding"}
                else:
                    return {"status": "degraded", "latency_ms": latency, "message": f"Status {response.status_code}"}
        except Exception as e:
            return {"status": "unhealthy", "latency_ms": None, "message": str(e)}


mcp_client = MCPClient()
