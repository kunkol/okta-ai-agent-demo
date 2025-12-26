"""
Token Vault Service - Auth0 Token Vault Integration

This service handles:
1. Exchanging Okta tokens for Auth0 tokens (Custom Token Exchange)
2. Retrieving vaulted tokens (Salesforce, Google) from Auth0 Token Vault

Add to backend-api/app/services/token_vault_service.py

Configuration needed in .env (and Render dashboard):
- AUTH0_DOMAIN=aisecuritydemo.us.auth0.com
- AUTH0_VAULT_CLIENT_ID=rFBTfpIvNHGNM1gtYTNFGAeO8oScaYl9
- AUTH0_VAULT_CLIENT_SECRET=Fv3_eNVGkIrzjHbu9FDARTGwmMH6ik0yMsDALzjRFe53fjWVTXPArfuv-aF544Fj
- AUTH0_VAULT_AUDIENCE=https://vault.apex.aisecuritydemo.com
- AUTH0_SUBJECT_TOKEN_TYPE=urn:apex:okta-token
- OKTA_CONNECTION_NAME=okta-kk-demos
"""

import os
import httpx
from typing import Optional, Dict, Any
from datetime import datetime
import logging
import jwt

logger = logging.getLogger(__name__)


class TokenVaultService:
    """Service for Auth0 Token Vault operations"""
    
    def __init__(self):
        self.auth0_domain = os.getenv("AUTH0_DOMAIN", "aisecuritydemo.us.auth0.com")
        self.vault_client_id = os.getenv("AUTH0_VAULT_CLIENT_ID", "rFBTfpIvNHGNM1gtYTNFGAeO8oScaYl9")
        self.vault_client_secret = os.getenv("AUTH0_VAULT_CLIENT_SECRET", "Fv3_eNVGkIrzjHbu9FDARTGwmMH6ik0yMsDALzjRFe53fjWVTXPArfuv-aF544Fj")
        self.vault_audience = os.getenv("AUTH0_VAULT_AUDIENCE", "https://vault.apex.aisecuritydemo.com")
        self.subject_token_type = os.getenv("AUTH0_SUBJECT_TOKEN_TYPE", "urn:apex:okta-token")
        self.okta_connection_name = os.getenv("OKTA_CONNECTION_NAME", "okta-kk-demos")
        
        self.token_endpoint = f"https://{self.auth0_domain}/oauth/token"
        
        # Cache for Auth0 tokens (per user)
        self._auth0_token_cache: Dict[str, Dict[str, Any]] = {}
    
    async def exchange_okta_token_for_auth0(self, okta_token: str) -> Dict[str, Any]:
        """
        Exchange an Okta token for an Auth0 token via Custom Token Exchange.
        
        The Okta token must contain a 'uid' claim (user ID) for the exchange to work.
        This is typically present in ID tokens from user login, not client_credentials tokens.
        
        Args:
            okta_token: The Okta access token or ID token
            
        Returns:
            Dict containing access_token, token_type, expires_in
            
        Raises:
            TokenExchangeError: If the exchange fails
        """
        logger.info("Exchanging Okta token for Auth0 token")
        
        payload = {
            "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
            "client_id": self.vault_client_id,
            "client_secret": self.vault_client_secret,
            "subject_token": okta_token,
            "subject_token_type": self.subject_token_type,
            "audience": self.vault_audience
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_endpoint,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                error_data = response.json()
                logger.error(f"Token exchange failed: {error_data}")
                raise TokenExchangeError(
                    error=error_data.get("error", "unknown_error"),
                    description=error_data.get("error_description", "Token exchange failed")
                )
            
            result = response.json()
            logger.info("Successfully exchanged Okta token for Auth0 token")
            return result
    
    async def get_vaulted_token(
        self, 
        auth0_token: str, 
        connection: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Retrieve a vaulted token (e.g., Salesforce, Google) from Auth0 Token Vault.
        
        Args:
            auth0_token: The Auth0 access token (from exchange_okta_token_for_auth0)
            connection: The connection name (e.g., 'salesforce', 'google-oauth2')
            user_id: The Auth0 user ID (e.g., 'okta|okta-kk-demos|00u123...')
            
        Returns:
            Dict containing the external provider's access_token
        """
        logger.info(f"Retrieving vaulted token for connection: {connection}")
        
        # Token Vault uses federated connection access token grant
        payload = {
            "grant_type": "urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token",
            "client_id": self.vault_client_id,
            "client_secret": self.vault_client_secret,
            "subject_token": auth0_token,
            "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
            "connection": connection
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_endpoint,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                error_data = response.json()
                logger.error(f"Vault token retrieval failed: {error_data}")
                
                # Check if user needs to link their account
                if error_data.get("error") == "access_denied":
                    raise AccountNotLinkedError(
                        connection=connection,
                        message="User has not linked their account for this connection"
                    )
                
                raise TokenVaultError(
                    error=error_data.get("error", "unknown_error"),
                    description=error_data.get("error_description", "Failed to retrieve vaulted token")
                )
            
            result = response.json()
            logger.info(f"Successfully retrieved vaulted token for {connection}")
            return result
    
    async def get_salesforce_token(self, okta_token: str, user_id: str) -> str:
        """
        Convenience method to get a Salesforce access token.
        
        Args:
            okta_token: The Okta token from user login
            user_id: The Okta user ID (uid claim from token)
            
        Returns:
            Salesforce access token string
        """
        # Step 1: Exchange Okta token for Auth0 token
        auth0_result = await self.exchange_okta_token_for_auth0(okta_token)
        auth0_token = auth0_result["access_token"]
        
        # Build Auth0 user ID from Okta user ID
        auth0_user_id = f"okta|{self.okta_connection_name}|{user_id}"
        
        # Step 2: Get Salesforce token from vault
        vault_result = await self.get_vaulted_token(
            auth0_token=auth0_token,
            connection="salesforce",
            user_id=auth0_user_id
        )
        
        return vault_result["access_token"]
    
    async def get_google_token(self, okta_token: str, user_id: str) -> str:
        """
        Convenience method to get a Google access token (for Calendar, etc.).
        
        Args:
            okta_token: The Okta token from user login
            user_id: The Okta user ID (uid claim from token)
            
        Returns:
            Google access token string
        """
        # Step 1: Exchange Okta token for Auth0 token
        auth0_result = await self.exchange_okta_token_for_auth0(okta_token)
        auth0_token = auth0_result["access_token"]
        
        # Build Auth0 user ID from Okta user ID
        auth0_user_id = f"okta|{self.okta_connection_name}|{user_id}"
        
        # Step 2: Get Google token from vault
        vault_result = await self.get_vaulted_token(
            auth0_token=auth0_token,
            connection="google-oauth2",
            user_id=auth0_user_id
        )
        
        return vault_result["access_token"]


class TokenExchangeError(Exception):
    """Raised when Okta → Auth0 token exchange fails"""
    def __init__(self, error: str, description: str):
        self.error = error
        self.description = description
        super().__init__(f"{error}: {description}")


class TokenVaultError(Exception):
    """Raised when Token Vault retrieval fails"""
    def __init__(self, error: str, description: str):
        self.error = error
        self.description = description
        super().__init__(f"{error}: {description}")


class AccountNotLinkedError(Exception):
    """Raised when user hasn't linked their external account"""
    def __init__(self, connection: str, message: str):
        self.connection = connection
        self.message = message
        super().__init__(f"Account not linked for {connection}: {message}")


# Singleton instance
token_vault_service = TokenVaultService()
