"""
Authentication endpoints for Okta integration.
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import secrets

from app.models.schemas import (
    TokenRequest, TokenResponse, UserInfo,
    TokenExchangeRequest, TokenExchangeResponse
)
from app.services.okta_service import okta_service
from app.services.audit_service import audit_service
from app.config import settings

router = APIRouter()
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[UserInfo]:
    """
    Dependency to get current user from Okta token.
    
    Returns None if no token or invalid token.
    """
    if not credentials:
        return None
    
    claims = await okta_service.validate_token(credentials.credentials)
    if not claims:
        return None
    
    return UserInfo(
        sub=claims["sub"],
        email=claims.get("email"),
        name=claims.get("name"),
        preferred_username=claims.get("preferred_username"),
        groups=claims.get("groups", [])
    )


async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UserInfo:
    """
    Dependency that requires valid authentication.
    
    Raises 401 if not authenticated.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    claims = await okta_service.validate_token(credentials.credentials)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return UserInfo(
        sub=claims["sub"],
        email=claims.get("email"),
        name=claims.get("name"),
        preferred_username=claims.get("preferred_username"),
        groups=claims.get("groups", [])
    )


@router.get("/config")
async def get_auth_config():
    """
    Get Okta configuration for frontend.
    
    Returns public configuration needed for OAuth flow.
    """
    return {
        "issuer": settings.OKTA_ISSUER,
        "client_id": settings.OKTA_CLIENT_ID,
        "scopes": ["openid", "profile", "email"],
        "response_type": "code",
        "pkce_required": True
    }


@router.get("/login")
async def get_login_url(redirect_uri: str):
    """
    Generate Okta login URL.
    
    Args:
        redirect_uri: Where to redirect after login
        
    Returns:
        Authorization URL and state parameter
    """
    state = secrets.token_urlsafe(32)
    auth_url = okta_service.get_auth_url(
        redirect_uri=redirect_uri,
        state=state,
        scopes=["openid", "profile", "email"]
    )
    
    return {
        "auth_url": auth_url,
        "state": state
    }


@router.post("/callback", response_model=TokenResponse)
async def handle_callback(request: TokenRequest):
    """
    Handle OAuth callback and exchange code for tokens.
    
    Args:
        request: Contains authorization code and redirect URI
        
    Returns:
        Access token and other token information
    """
    tokens = await okta_service.exchange_code(
        code=request.code,
        redirect_uri=request.redirect_uri,
        code_verifier=request.code_verifier
    )
    
    if not tokens:
        raise HTTPException(status_code=400, detail="Failed to exchange authorization code")
    
    return TokenResponse(
        access_token=tokens["access_token"],
        token_type=tokens.get("token_type", "Bearer"),
        expires_in=tokens.get("expires_in", 3600),
        id_token=tokens.get("id_token"),
        refresh_token=tokens.get("refresh_token"),
        scope=tokens.get("scope")
    )


@router.get("/me", response_model=UserInfo)
async def get_current_user_info(user: UserInfo = Depends(require_auth)):
    """
    Get current user information.
    
    Requires valid authentication.
    """
    return user


@router.post("/token/exchange", response_model=TokenExchangeResponse)
async def exchange_token(
    request: TokenExchangeRequest,
    user: UserInfo = Depends(require_auth),
    authorization: str = Header(...)
):
    """
    Exchange token for Cross-App Access (ID-JAG flow).
    
    This endpoint implements RFC 8693 token exchange, allowing
    the agent to access downstream services on behalf of the user.
    
    Args:
        request: Token exchange parameters
        user: Current authenticated user
        
    Returns:
        New access token for target audience
    """
    # Extract bearer token
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=400, detail="Invalid authorization header")
    
    subject_token = authorization[7:]
    
    # Perform token exchange
    result = await okta_service.exchange_token(
        subject_token=subject_token,
        target_audience=request.target_audience,
        requested_scopes=request.requested_scopes
    )
    
    if not result:
        # Log the failure
        audit_service.log_token_exchange(
            user_id=user.sub,
            target_audience=request.target_audience,
            result="failed"
        )
        raise HTTPException(status_code=400, detail="Token exchange failed")
    
    # Log successful exchange
    audit_service.log_token_exchange(
        user_id=user.sub,
        target_audience=request.target_audience,
        result="success",
        delegation_chain=result.delegation_chain
    )
    
    return result


@router.post("/token/validate")
async def validate_token(
    authorization: str = Header(...)
):
    """
    Validate a token and return its claims.
    
    Useful for debugging and testing.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=400, detail="Invalid authorization header")
    
    token = authorization[7:]
    claims = await okta_service.validate_token(token)
    
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return {
        "valid": True,
        "claims": claims
    }


@router.post("/logout")
async def logout(user: UserInfo = Depends(require_auth)):
    """
    Handle logout.
    
    In a real implementation, this would revoke tokens.
    For now, just acknowledge the logout.
    """
    return {
        "message": "Logged out successfully",
        "note": "Client should clear local tokens"
    }
