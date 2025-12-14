"""
MCP Server Tools Module
Contains the business logic for each tool available to AI agents.

Tool Categories:
1. Customer Tools - CRM access with FGA (Scenario 1)
2. Document Tools - RAG with role-based filtering (Scenario 3)
3. Payment Tools - Risk-based with CIBA triggers (Scenario 2)
4. Token Vault Tools - Third-party API access (Scenario 4)
5. Internal MCP Tools - XAA/ID-JAG protected resources (Scenario 5)
"""

# Scenario 1: Customer Support
from .customer import get_customer_data, CustomerResponse

# Scenario 3: RAG Document Search
from .documents import search_documents_data, DocumentSearchResponse

# Scenario 2: Financial Transactions
from .payments import initiate_payment_data, PaymentResponse

# Scenario 4: Token Vault (Third-Party APIs)
from .token_vault import (
    get_calendar_events,
    post_to_slack,
    create_github_issue,
    get_github_repos
)

# Scenario 5: Internal MCP Tools (XAA/ID-JAG)
from .internal_tools import (
    run_data_analysis,
    run_compliance_check,
    coordinate_agents,
    get_agent_registry,
    get_delegation_chain
)

__all__ = [
    # Customer (FGA)
    "get_customer_data",
    "CustomerResponse",
    # Documents (Role-based)
    "search_documents_data", 
    "DocumentSearchResponse",
    # Payments (Risk + CIBA)
    "initiate_payment_data",
    "PaymentResponse",
    # Token Vault (Third-Party)
    "get_calendar_events",
    "post_to_slack",
    "create_github_issue",
    "get_github_repos",
    # Internal MCP (XAA)
    "run_data_analysis",
    "run_compliance_check",
    "coordinate_agents",
    "get_agent_registry",
    "get_delegation_chain"
]
