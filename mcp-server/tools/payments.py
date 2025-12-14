"""
Payments Tool - initiate_payment
Initiates payment transfers with risk-based controls.

Demo Scenarios:
- Amount <= $1,000: Low risk, auto-approved
- Amount $1,001 - $10,000: Medium risk, logged with extra verification
- Amount > $10,000: High risk, requires CIBA (out-of-band) approval

This demonstrates:
1. Risk-based authorization decisions
2. CIBA (Client Initiated Backchannel Authentication) flow trigger
3. Step-up authentication for sensitive operations
"""

from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
import uuid

class PaymentResponse(BaseModel):
    success: bool
    transaction_id: Optional[str] = None
    status: str
    risk_level: str
    requires_approval: bool
    approval_details: Optional[Dict[str, Any]] = None
    message: str

# =============================================================================
# Risk Thresholds
# =============================================================================

LOW_RISK_THRESHOLD = 1000      # Up to $1,000
MEDIUM_RISK_THRESHOLD = 10000  # Up to $10,000
# Above $10,000 = High risk

# =============================================================================
# Demo Recipients Database
# =============================================================================

KNOWN_RECIPIENTS = {
    "acme corp": {
        "id": "RCP-001",
        "name": "Acme Corporation",
        "account": "****4521",
        "verified": True,
        "risk_score": "low"
    },
    "techgiant inc": {
        "id": "RCP-002",
        "name": "TechGiant Inc",
        "account": "****7832",
        "verified": True,
        "risk_score": "low"
    },
    "offshore holdings": {
        "id": "RCP-003",
        "name": "Offshore Holdings Ltd",
        "account": "****9999",
        "verified": False,
        "risk_score": "high"
    },
    "vendor services": {
        "id": "RCP-004",
        "name": "Vendor Services LLC",
        "account": "****2341",
        "verified": True,
        "risk_score": "medium"
    }
}

# =============================================================================
# Risk Assessment Functions
# =============================================================================

def assess_payment_risk(amount: float, recipient: str) -> dict:
    """
    Assess risk level of payment transaction.
    
    Returns risk assessment with recommended actions.
    """
    recipient_lower = recipient.lower().strip()
    recipient_info = KNOWN_RECIPIENTS.get(recipient_lower, {
        "id": "RCP-UNKNOWN",
        "name": recipient,
        "account": "Unknown",
        "verified": False,
        "risk_score": "unknown"
    })
    
    # Base risk from amount
    if amount <= LOW_RISK_THRESHOLD:
        amount_risk = "low"
    elif amount <= MEDIUM_RISK_THRESHOLD:
        amount_risk = "medium"
    else:
        amount_risk = "high"
    
    # Recipient risk factors
    recipient_risk = recipient_info.get("risk_score", "unknown")
    is_verified = recipient_info.get("verified", False)
    
    # Combined risk assessment
    risk_factors = []
    
    if amount > MEDIUM_RISK_THRESHOLD:
        risk_factors.append(f"Amount ${amount:,.2f} exceeds high-risk threshold")
    elif amount > LOW_RISK_THRESHOLD:
        risk_factors.append(f"Amount ${amount:,.2f} requires additional logging")
    
    if not is_verified:
        risk_factors.append("Recipient not verified in system")
    
    if recipient_risk == "high":
        risk_factors.append("Recipient flagged as high-risk")
    
    # Determine overall risk level
    if amount > MEDIUM_RISK_THRESHOLD or recipient_risk == "high":
        overall_risk = "high"
    elif amount > LOW_RISK_THRESHOLD or recipient_risk == "medium" or not is_verified:
        overall_risk = "medium"
    else:
        overall_risk = "low"
    
    return {
        "overall_risk": overall_risk,
        "amount_risk": amount_risk,
        "recipient_risk": recipient_risk,
        "recipient_verified": is_verified,
        "recipient_info": recipient_info,
        "risk_factors": risk_factors,
        "requires_ciba": overall_risk == "high"
    }

# =============================================================================
# Main Tool Function
# =============================================================================

def initiate_payment_data(
    amount: float,
    recipient: str,
    description: str = ""
) -> dict:
    """
    Initiate a payment transfer with risk-based controls.
    
    Args:
        amount: Payment amount in USD
        recipient: Recipient name or account
        description: Optional payment description
        
    Returns:
        dict with transaction status and risk assessment
    """
    # Validate inputs
    if amount <= 0:
        return {
            "success": False,
            "transaction_id": None,
            "status": "rejected",
            "risk_level": "error",
            "requires_approval": False,
            "approval_details": None,
            "message": "Invalid amount: must be greater than 0"
        }
    
    if not recipient:
        return {
            "success": False,
            "transaction_id": None,
            "status": "rejected",
            "risk_level": "error",
            "requires_approval": False,
            "approval_details": None,
            "message": "Recipient is required"
        }
    
    # Generate transaction ID
    transaction_id = f"TXN-{uuid.uuid4().hex[:8].upper()}"
    
    # Assess risk
    risk = assess_payment_risk(amount, recipient)
    
    # Process based on risk level
    if risk["overall_risk"] == "low":
        # Auto-approve low-risk transactions
        return {
            "success": True,
            "transaction_id": transaction_id,
            "status": "approved",
            "risk_level": "low",
            "requires_approval": False,
            "approval_details": None,
            "amount": amount,
            "recipient": risk["recipient_info"]["name"],
            "description": description or "Payment transfer",
            "message": f"Payment of ${amount:,.2f} to {risk['recipient_info']['name']} approved and queued for processing"
        }
    
    elif risk["overall_risk"] == "medium":
        # Approve with additional logging
        return {
            "success": True,
            "transaction_id": transaction_id,
            "status": "approved_with_logging",
            "risk_level": "medium",
            "requires_approval": False,
            "approval_details": {
                "extra_verification": True,
                "audit_flag": True,
                "risk_factors": risk["risk_factors"]
            },
            "amount": amount,
            "recipient": risk["recipient_info"]["name"],
            "description": description or "Payment transfer",
            "message": f"Payment of ${amount:,.2f} approved with enhanced monitoring. Risk factors: {', '.join(risk['risk_factors'])}"
        }
    
    else:  # high risk
        # Require CIBA approval
        return {
            "success": False,
            "transaction_id": transaction_id,
            "status": "pending_approval",
            "risk_level": "high",
            "requires_approval": True,
            "approval_details": {
                "approval_type": "CIBA",
                "approval_method": "push_notification",
                "approvers": ["finance_manager", "compliance_officer"],
                "timeout_minutes": 30,
                "risk_factors": risk["risk_factors"],
                "ciba_auth_request_id": f"CIBA-{uuid.uuid4().hex[:12].upper()}"
            },
            "amount": amount,
            "recipient": risk["recipient_info"]["name"],
            "description": description or "Payment transfer",
            "message": f"HIGH RISK: Payment of ${amount:,.2f} requires out-of-band approval. CIBA authentication initiated. Awaiting approval from authorized personnel."
        }
