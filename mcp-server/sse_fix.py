# This script fixes the SSE endpoint for Claude.ai compatibility

import re

# Read main.py
with open('main.py', 'r') as f:
    content = f.read()

# Find and replace the mcp_sse_endpoint function
old_sse = '''@app.get("/sse")
async def mcp_sse_endpoint(request: Request):
    """
    MCP Server-Sent Events endpoint.
    This is the standard MCP transport for Claude Desktop and other MCP clients.
    """
    async def event_stream():
        # Send endpoint info
        yield f"event: endpoint\\ndata: /messages\\n\\n"
        
        # Keep connection alive
        while True:
            if await request.is_disconnected():
                break
            yield ": keepalive\\n\\n"
            await asyncio.sleep(30)
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )'''

new_sse = '''@app.get("/sse")
async def mcp_sse_endpoint(request: Request):
    """
    MCP Server-Sent Events endpoint.
    This is the standard MCP transport for Claude Desktop and other MCP clients.
    """
    async def event_stream():
        # Send endpoint info
        yield f"event: endpoint\\ndata: /messages\\n\\n"
        
        # Keep connection alive
        while True:
            if await request.is_disconnected():
                break
            yield ": keepalive\\n\\n"
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
    )'''

content = content.replace(old_sse, new_sse)

# Write back
with open('main.py', 'w') as f:
    f.write(content)

print("SSE endpoint updated with CORS headers")
