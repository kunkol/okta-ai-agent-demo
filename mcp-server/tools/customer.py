"""
Customer Tool - get_customer
Retrieves customer information with permission-based access control.

Demo Scenarios:
- Alice: Full access allowed (demonstrates successful data retrieval)
- Bob: Partial access (demonstrates filtered response)
- Charlie: Access denied (demonstrates FGA policy enforcement)
"""

from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class CustomerResponse(BaseModel):
    success: bool
    customer: Optional[Dict[str, Any]] = None
    message: str
    access_level: str
    policy_decision: str

# =============================================================================
# Demo Customer Database
# =============================================================================

DEMO_CUSTOMERS = {
    "alice": {
        "id": "CUST-001",
        "name": "Alice Johnson",
        "email": "alice.johnson@example.com",
        "phone": "+1-555-0101",
        "tier": "Enterprise",
        "account_status": "Active",
        "credit_limit": 50000,
        "total_orders": 127,
        "lifetime_value": 284500,
        "created_at": "2021-03-15",
        "last_activity": "2024-12-13",
        "notes": "Key strategic account. VIP support enabled.",
        "sensitive_data": {
            "ssn_last4": "4532",
            "payment_methods": ["Corporate Card ****4521", "Wire Transfer"]
        }
    },
    "bob": {
        "id": "CUST-002",
        "name": "Bob Smith",
        "email": "bob.smith@techcorp.com",
        "phone": "+1-555-0102",
        "tier": "Professional",
        "account_status": "Active",
        "credit_limit": 25000,
        "total_orders": 43,
        "lifetime_value": 67800,
        "created_at": "2022-07-20",
        "last_activity": "2024-12-10",
        "notes": "Growing account. Upsell opportunity identified.",
        "sensitive_data": {
            "ssn_last4": "7891",
            "payment_methods": ["Business Card ****8823"]
        }
    },
    "charlie": {
        "id": "CUST-003",
        "name": "Charlie Davis",
        "email": "charlie.davis@restricted.org",
        "phone": "+1-555-0103",
        "tier": "Restricted",
        "account_status": "Under Review",
        "credit_limit": 0,
        "total_orders": 5,
        "lifetime_value": 12500,
        "created_at": "2023-11-01",
        "last_activity": "2024-11-28",
        "notes": "RESTRICTED ACCESS - Compliance review pending.",
        "sensitive_data": {
            "ssn_last4": "REDACTED",
            "payment_methods": ["RESTRICTED"]
        },
        "access_restricted": True,
        "restriction_reason": "Compliance review - Legal hold"
    }
}

# =============================================================================
# Permission Policies (simulating FGA)
# =============================================================================

def check_customer_access(customer_name: str, requesting_role: str = "agent") -> dict:
    """
    Simulate Fine-Grained Authorization (FGA) policy check.
    
    In production, this would call Auth0 FGA or Okta FGA.
    For demo, we use simple rules:
    - Alice: Always allowed (demonstrates happy path)
    - Bob: Allowed with partial data (demonstrates filtering)
    - Charlie: Denied (demonstrates policy enforcement)
    """
    customer_key = customer_name.lower().strip()
    
    if customer_key == "alice":
        return {
            "allowed": True,
            "access_level": "full",
            "include_sensitive": True,
            "policy": "customer:read:full",
            "decision_reason": "Enterprise tier - Full access granted"
        }
    elif customer_key == "bob":
        return {
            "allowed": True,
            "access_level": "partial",
            "include_sensitive": False,
            "policy": "customer:read:basic",
            "decision_reason": "Professional tier - Sensitive data filtered"
        }
    elif customer_key == "charlie":
        return {
            "allowed": False,
            "access_level": "denied",
            "include_sensitive": False,
            "policy": "customer:read:denied",
            "decision_reason": "Access denied - Record under compliance review"
        }
    else:
        return {
            "allowed": False,
            "access_level": "not_found",
            "include_sensitive": False,
            "policy": "customer:not_found",
            "decision_reason": f"Customer '{customer_name}' not found in system"
        }

# =============================================================================
# Main Tool Function
# =============================================================================

def get_customer_data(name: str) -> dict:
    """
    Retrieve customer data with permission-based filtering.
    
    Args:
        name: Customer name to look up
        
    Returns:
        dict with customer data or access denial message
    """
    if not name:
        return {
            "success": False,
            "customer": None,
            "message": "Customer name is required",
            "access_level": "error",
            "policy_decision": "invalid_request"
        }
    
    # Check permissions (simulating FGA)
    access = check_customer_access(name)
    customer_key = name.lower().strip()
    
    # Access denied case
    if not access["allowed"]:
        return {
            "success": False,
            "customer": None,
            "message": access["decision_reason"],
            "access_level": access["access_level"],
            "policy_decision": access["policy"]
        }
    
    # Get customer data
    customer = DEMO_CUSTOMERS.get(customer_key)
    
    if not customer:
        return {
            "success": False,
            "customer": None,
            "message": f"Customer '{name}' not found",
            "access_level": "not_found",
            "policy_decision": "customer:not_found"
        }
    
    # Filter sensitive data based on access level
    customer_response = customer.copy()
    
    if not access["include_sensitive"]:
        # Remove sensitive fields for partial access
        customer_response.pop("sensitive_data", None)
        customer_response["data_filtered"] = True
        customer_response["filter_reason"] = "Sensitive data excluded per access policy"
    
    return {
        "success": True,
        "customer": customer_response,
        "message": f"Customer data retrieved successfully",
        "access_level": access["access_level"],
        "policy_decision": access["policy"]
    }
