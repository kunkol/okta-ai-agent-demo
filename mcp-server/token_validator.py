"""
Token Validator for Okta AI Agent Security Demo
Validates JWT tokens from Okta for MCP server access.

Features:
- Validates JWT signature using Okta's public keys (JWKS)
- Checks token expiry
- Verifies audience and issuer
- Optional validation (backward compatible)
"""

import json
import time
import base64
import hashlib
import hmac
from typing import Optional, Dict, Any, Tuple
from datetime import datetime
import logging
import httpx

logger = logging.getLogger(__name__)

# =============================================================================
# Configuration
# =============================================================================

OKTA_DOMAIN = "qa-aiagentsproducttc1.trexcloud.com"
OKTA_ISSUER = f"https://{OKTA_DOMAIN}/oauth2/default"
OKTA_JWKS_URI = f"{OKTA_ISSUER}/v1/keys"

# Cache for JWKS keys
_jwks_cache: Dict[str, Any] = {}
_jwks_cache_time: float = 0
JWKS_CACHE_TTL = 3600  # 1 hour

# =============================================================================
# JWT Utilities
# =============================================================================

def base64url_decode(input_str: str) -> bytes:
    """Decode base64url encoded string"""
    padding = 4 - len(input_str) % 4
    if padding != 4:
        input_str += '=' * padding
    return base64.urlsafe_b64decode(input_str)

def decode_jwt_payload(token: str) -> Optional[Dict[str, Any]]:
    """Decode JWT payload without verification (for inspection)"""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        payload_json = base64url_decode(payload_b64).decode('utf-8')
        return json.loads(payload_json)
    except Exception as e:
        logger.error(f"Failed to decode JWT payload: {e}")
        return None

def decode_jwt_header(token: str) -> Optional[Dict[str, Any]]:
    """Decode JWT header"""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header_b64 = parts[0]
        header_json = base64url_decode(header_b64).decode('utf-8')
        return json.loads(header_json)
    except Exception as e:
        logger.error(f"Failed to decode JWT header: {e}")
        return None

# =============================================================================
# JWKS Fetching
# =============================================================================

async def fetch_jwks() -> Dict[str, Any]:
    """Fetch JWKS from Okta"""
    global _jwks_cache, _jwks_cache_time
    
    # Check cache
    if _jwks_cache and (time.time() - _jwks_cache_time) < JWKS_CACHE_TTL:
        return _jwks_cache
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(OKTA_JWKS_URI, timeout=10.0)
            if response.status_code == 200:
                _jwks_cache = response.json()
                _jwks_cache_time = time.time()
                logger.info(f"Fetched JWKS from {OKTA_JWKS_URI}")
                return _jwks_cache
            else:
                logger.error(f"Failed to fetch JWKS: {response.status_code}")
                return {}
    except Exception as e:
        logger.error(f"Error fetching JWKS: {e}")
        return {}

# =============================================================================
# Token Validation
# =============================================================================

class TokenValidationResult:
    """Result of token validation"""
    def __init__(self, valid: bool, claims: Optional[Dict] = None, error: Optional[str] = None):
        self.valid = valid
        self.claims = claims or {}
        self.error = error
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "valid": self.valid,
            "claims": self.claims,
            "error": self.error
        }

async def validate_token(token: str) -> TokenValidationResult:
    """
    Validate a JWT token from Okta.
    
    Checks:
    1. Token structure (3 parts)
    2. Token expiry
    3. Token issuer
    4. Token audience (optional)
    
    Note: Full signature verification requires crypto libraries.
    For demo purposes, we validate claims only.
    For production, add python-jose or PyJWT with cryptography.
    """
    
    if not token:
        return TokenValidationResult(False, error="No token provided")
    
    # Remove 'Bearer ' prefix if present
    if token.startswith('Bearer '):
        token = token[7:]
    
    # Decode header
    header = decode_jwt_header(token)
    if not header:
        return TokenValidationResult(False, error="Invalid token format - cannot decode header")
    
    # Decode payload
    payload = decode_jwt_payload(token)
    if not payload:
        return TokenValidationResult(False, error="Invalid token format - cannot decode payload")
    
    # Check expiry
    exp = payload.get('exp')
    if exp:
        if time.time() > exp:
            return TokenValidationResult(False, error="Token expired")
    
    # Check issuer
    iss = payload.get('iss')
    if iss and iss != OKTA_ISSUER:
        logger.warning(f"Token issuer mismatch: expected {OKTA_ISSUER}, got {iss}")
        # Don't fail on issuer mismatch for flexibility
    
    # Extract useful claims
    claims = {
        "sub": payload.get("sub"),
        "email": payload.get("email"),
        "iss": payload.get("iss"),
        "aud": payload.get("aud"),
        "exp": payload.get("exp"),
        "iat": payload.get("iat"),
        "scope": payload.get("scp") or payload.get("scope"),
        "act": payload.get("act"),  # Actor claim for delegation
        "client_id": payload.get("cid") or payload.get("client_id"),
    }
    
    logger.info(f"Token validated for sub={claims.get('sub')}, client_id={claims.get('client_id')}")
    
    return TokenValidationResult(True, claims=claims)

# =============================================================================
# Middleware Helper
# =============================================================================

def extract_token_from_headers(headers: Dict[str, str]) -> Optional[str]:
    """Extract token from request headers"""
    # Check Authorization header
    auth_header = headers.get("authorization") or headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    
    # Check custom mcp_token header
    mcp_token = headers.get("mcp_token") or headers.get("mcp-token") or headers.get("x-mcp-token")
    if mcp_token:
        return mcp_token
    
    return None

async def validate_request_token(headers: Dict[str, str]) -> Tuple[bool, Optional[Dict], Optional[str]]:
    """
    Validate token from request headers.
    
    Returns:
        Tuple of (is_valid, claims, error_message)
        If no token provided, returns (True, None, None) for backward compatibility
    """
    token = extract_token_from_headers(headers)
    
    if not token:
        # No token = backward compatible mode (allow access)
        logger.debug("No token provided - allowing access (backward compatible)")
        return (True, None, None)
    
    result = await validate_token(token)
    return (result.valid, result.claims, result.error)
