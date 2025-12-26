"""
Salesforce MCP Tools - Uses Token Vault for real Salesforce API access

Add to backend-api/app/services/salesforce_tools.py

These tools retrieve real data from Salesforce using tokens stored in Auth0 Token Vault.
"""

import os
import httpx
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)

# Salesforce instance URL (from env or default)
SALESFORCE_INSTANCE_URL = os.getenv(
    "SALESFORCE_INSTANCE_URL", 
    "https://orgfarm-2771b5c595-dev-ed.develop.my.salesforce.com"
)


async def call_salesforce_api(
    endpoint: str,
    salesforce_token: str,
    method: str = "GET",
    data: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Make an authenticated call to Salesforce REST API.
    
    Args:
        endpoint: API endpoint (e.g., '/services/data/v59.0/sobjects/Contact')
        salesforce_token: Access token from Token Vault
        method: HTTP method
        data: Request body for POST/PATCH
        
    Returns:
        API response as dict
    """
    url = f"{SALESFORCE_INSTANCE_URL}{endpoint}"
    headers = {
        "Authorization": f"Bearer {salesforce_token}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        if method == "GET":
            response = await client.get(url, headers=headers)
        elif method == "POST":
            response = await client.post(url, headers=headers, json=data)
        elif method == "PATCH":
            response = await client.patch(url, headers=headers, json=data)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        if response.status_code >= 400:
            logger.error(f"Salesforce API error: {response.status_code} - {response.text}")
            return {"error": response.text, "status_code": response.status_code}
        
        return response.json() if response.text else {"success": True}


async def get_salesforce_contact(
    salesforce_token: str,
    name: str
) -> Dict[str, Any]:
    """
    Get a Salesforce contact by name.
    
    Args:
        salesforce_token: Token from Token Vault
        name: Contact name to search for
        
    Returns:
        Contact details or error
    """
    # SOQL query to find contact by name
    query = f"SELECT Id, Name, Email, Phone, Title, Account.Name, Account.AnnualRevenue FROM Contact WHERE Name LIKE '%{name}%' LIMIT 5"
    endpoint = f"/services/data/v59.0/query?q={query}"
    
    result = await call_salesforce_api(endpoint, salesforce_token)
    
    if "error" in result:
        return {
            "success": False,
            "error": result["error"],
            "message": f"Failed to find contact: {name}"
        }
    
    records = result.get("records", [])
    if not records:
        return {
            "success": False,
            "message": f"No contact found matching: {name}"
        }
    
    # Format the results
    contacts = []
    for record in records:
        contacts.append({
            "id": record.get("Id"),
            "name": record.get("Name"),
            "email": record.get("Email"),
            "phone": record.get("Phone"),
            "title": record.get("Title"),
            "account_name": record.get("Account", {}).get("Name") if record.get("Account") else None,
            "account_revenue": record.get("Account", {}).get("AnnualRevenue") if record.get("Account") else None
        })
    
    return {
        "success": True,
        "contacts": contacts,
        "count": len(contacts)
    }


async def get_salesforce_opportunities(
    salesforce_token: str,
    account_name: Optional[str] = None,
    stage: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get Salesforce opportunities, optionally filtered by account or stage.
    
    Args:
        salesforce_token: Token from Token Vault
        account_name: Filter by account name (optional)
        stage: Filter by stage (optional)
        
    Returns:
        List of opportunities
    """
    # Build SOQL query
    query = "SELECT Id, Name, Amount, StageName, CloseDate, Account.Name, Probability FROM Opportunity"
    
    conditions = []
    if account_name:
        conditions.append(f"Account.Name LIKE '%{account_name}%'")
    if stage:
        conditions.append(f"StageName = '{stage}'")
    
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    query += " ORDER BY CloseDate ASC LIMIT 10"
    
    endpoint = f"/services/data/v59.0/query?q={query}"
    result = await call_salesforce_api(endpoint, salesforce_token)
    
    if "error" in result:
        return {
            "success": False,
            "error": result["error"]
        }
    
    records = result.get("records", [])
    opportunities = []
    total_pipeline = 0
    
    for record in records:
        amount = record.get("Amount") or 0
        total_pipeline += amount
        opportunities.append({
            "id": record.get("Id"),
            "name": record.get("Name"),
            "amount": amount,
            "stage": record.get("StageName"),
            "close_date": record.get("CloseDate"),
            "account_name": record.get("Account", {}).get("Name") if record.get("Account") else None,
            "probability": record.get("Probability")
        })
    
    return {
        "success": True,
        "opportunities": opportunities,
        "count": len(opportunities),
        "total_pipeline": total_pipeline
    }


async def get_salesforce_accounts(
    salesforce_token: str,
    industry: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get Salesforce accounts, optionally filtered by industry.
    
    Args:
        salesforce_token: Token from Token Vault
        industry: Filter by industry (optional)
        
    Returns:
        List of accounts
    """
    query = "SELECT Id, Name, Industry, AnnualRevenue, Phone, Website FROM Account"
    
    if industry:
        query += f" WHERE Industry = '{industry}'"
    
    query += " ORDER BY AnnualRevenue DESC NULLS LAST LIMIT 10"
    
    endpoint = f"/services/data/v59.0/query?q={query}"
    result = await call_salesforce_api(endpoint, salesforce_token)
    
    if "error" in result:
        return {
            "success": False,
            "error": result["error"]
        }
    
    records = result.get("records", [])
    accounts = []
    
    for record in records:
        accounts.append({
            "id": record.get("Id"),
            "name": record.get("Name"),
            "industry": record.get("Industry"),
            "annual_revenue": record.get("AnnualRevenue"),
            "phone": record.get("Phone"),
            "website": record.get("Website")
        })
    
    return {
        "success": True,
        "accounts": accounts,
        "count": len(accounts)
    }


# MCP Tool Definitions (for Claude)
SALESFORCE_TOOLS = [
    {
        "name": "get_salesforce_contact",
        "description": "Search for a contact in Salesforce CRM by name. Returns contact details including email, phone, title, and associated account.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "The name of the contact to search for (e.g., 'Marcus Thompson')"
                }
            },
            "required": ["name"]
        }
    },
    {
        "name": "get_salesforce_opportunities",
        "description": "Get sales opportunities from Salesforce. Can filter by account name or deal stage.",
        "input_schema": {
            "type": "object",
            "properties": {
                "account_name": {
                    "type": "string",
                    "description": "Filter opportunities by account name (optional)"
                },
                "stage": {
                    "type": "string",
                    "description": "Filter by stage: 'Prospecting', 'Qualification', 'Needs Analysis', 'Proposal/Price Quote', 'Negotiation/Review', 'Closed Won', 'Closed Lost'"
                }
            },
            "required": []
        }
    },
    {
        "name": "get_salesforce_accounts",
        "description": "Get accounts from Salesforce CRM. Can filter by industry.",
        "input_schema": {
            "type": "object",
            "properties": {
                "industry": {
                    "type": "string",
                    "description": "Filter accounts by industry (e.g., 'Financial Services', 'Technology', 'Manufacturing')"
                }
            },
            "required": []
        }
    }
]
