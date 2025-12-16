# Add token validation to main.py

with open('main.py', 'r') as f:
    content = f.read()

# Add import for token validator after other imports
old_import = "from mcp_protocol import process_mcp_message, MCP_VERSION, SERVER_NAME, SERVER_VERSION"
new_import = """from mcp_protocol import process_mcp_message, MCP_VERSION, SERVER_NAME, SERVER_VERSION
from token_validator import validate_request_token, validate_token, TokenValidationResult"""

content = content.replace(old_import, new_import)

# Find the tool call endpoint and add token validation
old_tool_call = '''@app.post("/tools/call", response_model=ToolCallResponse)
async def call_tool(
    request: ToolCallRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Execute a tool call.
    
    In Project C4, this will validate the Okta token from the Authorization header
    and enforce Cross-App Access (XAA) policies.
    """
    logger.info(f"Tool call: {request.tool_name} with params: {request.parameters}")
    
    # TODO (C4): Validate Okta token here
    # token = authorization.replace("Bearer ", "") if authorization else None
    # validate_okta_token(token)
    
    timestamp = datetime.utcnow().isoformat()'''

new_tool_call = '''@app.post("/tools/call", response_model=ToolCallResponse)
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
    
    timestamp = datetime.utcnow().isoformat()'''

content = content.replace(old_tool_call, new_tool_call)

# Add token validation endpoint
token_endpoint = '''

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
'''

# Add before the last line (import asyncio)
content = content.replace("import asyncio", token_endpoint + "\nimport asyncio")

with open('main.py', 'w') as f:
    f.write(content)

print("Token validation added to main.py")
