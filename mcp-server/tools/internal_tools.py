"""
Internal MCP Tools - XAA/ID-JAG Protected Resources
Demonstrates internal tool access via Cross-App Access (XAA).

Scenarios Covered:
- Scenario 5: MCP Tool Server Access (ID-JAG flow)
- Data analysis tools
- Compliance and audit tools
- Multi-agent coordination

These tools simulate internal enterprise resources that require:
1. Valid ID-JAG token exchange
2. Proper audience validation
3. Scope-based authorization
4. Full audit trail with user + agent context

Security Concepts Demonstrated:
- ID-JAG (Identity Assertion JWT Authorization Grant)
- RFC 9728 Protected Resource Metadata
- Audience-restricted tokens
- Delegation chain preservation
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import uuid
import random

# =============================================================================
# Data Analysis Tool
# =============================================================================

DEMO_SALES_DATA = {
    "Q1": {"revenue": 2850000, "deals_closed": 45, "pipeline": 4200000, "churn_rate": 4.2},
    "Q2": {"revenue": 3120000, "deals_closed": 52, "pipeline": 4800000, "churn_rate": 3.8},
    "Q3": {"revenue": 3450000, "deals_closed": 61, "pipeline": 5500000, "churn_rate": 3.5},
    "Q4": {"revenue": 3890000, "deals_closed": 68, "pipeline": 6200000, "churn_rate": 3.2}
}

def run_data_analysis(
    analysis_type: str = "sales_summary",
    quarter: str = None,
    metrics: List[str] = None,
    include_projections: bool = False
) -> dict:
    """
    Run data analysis on internal datasets.
    
    This tool requires ID-JAG authentication:
    - Agent must present valid ID-JAG token
    - Token must have correct audience (mcp-analytics.company.com)
    - User context preserved for audit
    
    Args:
        analysis_type: Type of analysis (sales_summary, pipeline, churn, forecast)
        quarter: Specific quarter (Q1, Q2, Q3, Q4) or None for all
        metrics: Specific metrics to include
        include_projections: Include AI-generated projections
        
    Returns:
        dict with analysis results
    """
    analysis_id = f"ANALYSIS-{uuid.uuid4().hex[:8].upper()}"
    
    # Validate analysis type
    valid_types = ["sales_summary", "pipeline", "churn", "forecast", "yoy_comparison"]
    if analysis_type not in valid_types:
        return {
            "success": False,
            "error": "invalid_analysis_type",
            "message": f"Analysis type must be one of: {', '.join(valid_types)}",
            "valid_types": valid_types
        }
    
    # Get relevant data
    if quarter and quarter.upper() in DEMO_SALES_DATA:
        data = {quarter.upper(): DEMO_SALES_DATA[quarter.upper()]}
    else:
        data = DEMO_SALES_DATA
    
    # Build analysis result
    result = {
        "success": True,
        "analysis_id": analysis_id,
        "analysis_type": analysis_type,
        "timestamp": datetime.utcnow().isoformat(),
        "mcp_info": {
            "tool": "run_data_analysis",
            "resource_server": "mcp-analytics.company.com",
            "required_scope": "analytics:read",
            "xaa_validated": True
        }
    }
    
    if analysis_type == "sales_summary":
        total_revenue = sum(q["revenue"] for q in data.values())
        total_deals = sum(q["deals_closed"] for q in data.values())
        result["summary"] = {
            "total_revenue": total_revenue,
            "total_deals": total_deals,
            "average_deal_size": total_revenue / total_deals if total_deals > 0 else 0,
            "quarters_analyzed": list(data.keys()),
            "quarterly_breakdown": data
        }
        
    elif analysis_type == "pipeline":
        result["pipeline"] = {
            "current_pipeline": data.get("Q4", DEMO_SALES_DATA["Q4"])["pipeline"],
            "pipeline_by_quarter": {q: d["pipeline"] for q, d in data.items()},
            "pipeline_growth": "15.2% QoQ"
        }
        
    elif analysis_type == "churn":
        avg_churn = sum(q["churn_rate"] for q in data.values()) / len(data)
        result["churn_analysis"] = {
            "average_churn_rate": round(avg_churn, 2),
            "churn_by_quarter": {q: d["churn_rate"] for q, d in data.items()},
            "trend": "improving" if data.get("Q4", {}).get("churn_rate", 5) < avg_churn else "stable"
        }
        
    elif analysis_type == "forecast":
        q4_revenue = DEMO_SALES_DATA["Q4"]["revenue"]
        result["forecast"] = {
            "next_quarter_projection": int(q4_revenue * 1.12),
            "confidence_interval": "85%",
            "growth_assumption": "12% based on pipeline and historical trends",
            "risk_factors": ["Market conditions", "Competitive pressure", "Seasonal variation"]
        }
        
    elif analysis_type == "yoy_comparison":
        result["yoy_comparison"] = {
            "current_year_revenue": sum(q["revenue"] for q in DEMO_SALES_DATA.values()),
            "previous_year_revenue": 11200000,  # Simulated
            "yoy_growth": "19.4%",
            "outperforming_target": True
        }
    
    if include_projections:
        result["ai_projections"] = {
            "generated_by": "internal-llm-service",
            "confidence": "medium",
            "key_insights": [
                "Q4 momentum suggests strong Q1 start",
                "Enterprise segment driving growth",
                "Churn reduction initiatives showing results"
            ]
        }
    
    return result


# =============================================================================
# Compliance Check Tool
# =============================================================================

COMPLIANCE_RULES = {
    "data_retention": {
        "rule_id": "COMP-001",
        "description": "Data must be retained for minimum 7 years",
        "regulation": "SOX"
    },
    "pii_handling": {
        "rule_id": "COMP-002", 
        "description": "PII must be encrypted at rest and in transit",
        "regulation": "GDPR"
    },
    "access_logging": {
        "rule_id": "COMP-003",
        "description": "All data access must be logged with user context",
        "regulation": "SOC2"
    },
    "agent_authorization": {
        "rule_id": "COMP-004",
        "description": "AI agents must have explicit authorization for data access",
        "regulation": "Internal Policy"
    }
}

def run_compliance_check(
    check_type: str = "all",
    resource: str = None,
    include_recommendations: bool = True
) -> dict:
    """
    Run compliance check on resources or operations.
    
    This tool validates that operations comply with:
    - SOX, GDPR, SOC2 requirements
    - Internal AI agent policies
    - Data handling regulations
    
    Args:
        check_type: Type of check (all, data_retention, pii_handling, access_logging, agent_authorization)
        resource: Specific resource to check
        include_recommendations: Include remediation recommendations
        
    Returns:
        dict with compliance status and findings
    """
    check_id = f"COMPLY-{uuid.uuid4().hex[:8].upper()}"
    
    # Determine which rules to check
    if check_type == "all":
        rules_to_check = COMPLIANCE_RULES
    elif check_type in COMPLIANCE_RULES:
        rules_to_check = {check_type: COMPLIANCE_RULES[check_type]}
    else:
        return {
            "success": False,
            "error": "invalid_check_type",
            "message": f"Check type must be 'all' or one of: {', '.join(COMPLIANCE_RULES.keys())}"
        }
    
    # Simulate compliance check results
    findings = []
    for rule_key, rule in rules_to_check.items():
        # Simulate random compliance status (mostly compliant)
        is_compliant = random.random() > 0.2
        
        finding = {
            "rule_id": rule["rule_id"],
            "rule_name": rule_key,
            "regulation": rule["regulation"],
            "status": "compliant" if is_compliant else "non_compliant",
            "description": rule["description"]
        }
        
        if not is_compliant and include_recommendations:
            finding["recommendation"] = f"Review {rule_key} configuration and update to meet {rule['regulation']} requirements"
            finding["priority"] = "high" if rule["regulation"] in ["SOX", "GDPR"] else "medium"
        
        findings.append(finding)
    
    compliant_count = sum(1 for f in findings if f["status"] == "compliant")
    
    return {
        "success": True,
        "check_id": check_id,
        "timestamp": datetime.utcnow().isoformat(),
        "resource": resource or "all_resources",
        "mcp_info": {
            "tool": "run_compliance_check",
            "resource_server": "mcp-compliance.company.com",
            "required_scope": "compliance:read",
            "xaa_validated": True
        },
        "summary": {
            "total_checks": len(findings),
            "compliant": compliant_count,
            "non_compliant": len(findings) - compliant_count,
            "compliance_score": f"{(compliant_count / len(findings)) * 100:.0f}%"
        },
        "findings": findings
    }


# =============================================================================
# Multi-Agent Coordination Tool
# =============================================================================

REGISTERED_AGENTS = {
    "customer-support-agent": {
        "id": "agent-001",
        "name": "Customer Support Agent",
        "capabilities": ["crm_access", "ticket_creation", "response_drafting"],
        "status": "active",
        "last_active": "2024-12-14T10:30:00Z"
    },
    "financial-agent": {
        "id": "agent-002",
        "name": "Financial Transaction Agent",
        "capabilities": ["payment_initiation", "invoice_processing", "approval_routing"],
        "status": "active",
        "last_active": "2024-12-14T10:25:00Z"
    },
    "rag-agent": {
        "id": "agent-003",
        "name": "RAG Document Agent",
        "capabilities": ["document_search", "content_summarization", "knowledge_retrieval"],
        "status": "active",
        "last_active": "2024-12-14T10:28:00Z"
    },
    "analytics-agent": {
        "id": "agent-004",
        "name": "Analytics Agent",
        "capabilities": ["data_analysis", "report_generation", "forecasting"],
        "status": "active",
        "last_active": "2024-12-14T10:15:00Z"
    }
}

def coordinate_agents(
    task_description: str,
    required_capabilities: List[str] = None,
    coordination_type: str = "sequential"
) -> dict:
    """
    Coordinate multiple agents for complex tasks.
    
    Demonstrates multi-agent orchestration with:
    - Agent discovery and capability matching
    - Task delegation with context preservation
    - Cross-agent authorization (each agent needs own XAA token)
    
    Args:
        task_description: Description of the task to accomplish
        required_capabilities: List of capabilities needed
        coordination_type: How to coordinate (sequential, parallel, hierarchical)
        
    Returns:
        dict with coordination plan and agent assignments
    """
    coordination_id = f"COORD-{uuid.uuid4().hex[:8].upper()}"
    
    if not task_description:
        return {
            "success": False,
            "error": "task_required",
            "message": "Task description is required"
        }
    
    # Find agents with matching capabilities
    matched_agents = []
    if required_capabilities:
        for agent_key, agent in REGISTERED_AGENTS.items():
            matching_caps = set(agent["capabilities"]) & set(required_capabilities)
            if matching_caps:
                matched_agents.append({
                    "agent_id": agent["id"],
                    "agent_name": agent["name"],
                    "matching_capabilities": list(matching_caps),
                    "all_capabilities": agent["capabilities"],
                    "status": agent["status"]
                })
    else:
        # Return all active agents if no specific capabilities requested
        matched_agents = [
            {
                "agent_id": a["id"],
                "agent_name": a["name"],
                "all_capabilities": a["capabilities"],
                "status": a["status"]
            }
            for a in REGISTERED_AGENTS.values()
            if a["status"] == "active"
        ]
    
    # Build coordination plan
    coordination_plan = {
        "coordination_id": coordination_id,
        "task": task_description,
        "coordination_type": coordination_type,
        "agents_involved": len(matched_agents),
        "steps": []
    }
    
    if coordination_type == "sequential":
        for i, agent in enumerate(matched_agents):
            coordination_plan["steps"].append({
                "step": i + 1,
                "agent": agent["agent_name"],
                "action": f"Execute using {agent.get('matching_capabilities', agent['all_capabilities'])}",
                "depends_on": f"Step {i}" if i > 0 else None,
                "xaa_required": True
            })
    elif coordination_type == "parallel":
        for i, agent in enumerate(matched_agents):
            coordination_plan["steps"].append({
                "step": i + 1,
                "agent": agent["agent_name"],
                "action": f"Execute in parallel using {agent.get('matching_capabilities', agent['all_capabilities'])}",
                "depends_on": None,
                "xaa_required": True
            })
    
    return {
        "success": True,
        "coordination_id": coordination_id,
        "timestamp": datetime.utcnow().isoformat(),
        "mcp_info": {
            "tool": "coordinate_agents",
            "resource_server": "mcp-orchestration.company.com",
            "required_scope": "agents:coordinate",
            "xaa_validated": True,
            "note": "Each delegated agent will need its own XAA token exchange"
        },
        "matched_agents": matched_agents,
        "coordination_plan": coordination_plan,
        "security_note": "Cross-agent calls preserve user context via delegation chain (act claim)"
    }


def get_agent_registry() -> dict:
    """
    Get list of registered agents in the system.
    
    Returns:
        dict with registered agents and their capabilities
    """
    return {
        "success": True,
        "timestamp": datetime.utcnow().isoformat(),
        "mcp_info": {
            "tool": "get_agent_registry",
            "resource_server": "mcp-registry.company.com",
            "required_scope": "agents:read"
        },
        "agents": list(REGISTERED_AGENTS.values()),
        "total": len(REGISTERED_AGENTS),
        "active": sum(1 for a in REGISTERED_AGENTS.values() if a["status"] == "active")
    }


# =============================================================================
# Audit Trail Tool
# =============================================================================

def get_delegation_chain(
    transaction_id: str = None,
    user_id: str = None,
    time_range_hours: int = 24
) -> dict:
    """
    Retrieve delegation chain for audit purposes.
    
    Shows the full chain: User → App → Agent → Resource
    with all token exchanges and authorizations.
    
    Args:
        transaction_id: Specific transaction to trace
        user_id: Filter by user
        time_range_hours: How far back to look
        
    Returns:
        dict with delegation chain details
    """
    # Simulate delegation chain
    chain = {
        "chain_id": transaction_id or f"CHAIN-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": datetime.utcnow().isoformat(),
        "user": {
            "sub": user_id or "user-alice-123",
            "email": f"{user_id or 'alice'}@company.com",
            "authenticated_via": "Okta SSO"
        },
        "delegation_steps": [
            {
                "step": 1,
                "from": "User",
                "to": "Web Application",
                "token_type": "ID Token",
                "claims": ["sub", "email", "groups"],
                "timestamp": (datetime.utcnow() - timedelta(minutes=5)).isoformat()
            },
            {
                "step": 2,
                "from": "Web Application", 
                "to": "AI Agent",
                "token_type": "ID-JAG (Identity Assertion)",
                "claims": ["sub", "azp", "aud", "act"],
                "act_claim": {"sub": "agent-customer-support"},
                "timestamp": (datetime.utcnow() - timedelta(minutes=4)).isoformat()
            },
            {
                "step": 3,
                "from": "AI Agent",
                "to": "MCP Server",
                "token_type": "Access Token (XAA exchanged)",
                "claims": ["sub", "aud", "scope", "act"],
                "audience": "mcp-server.company.com",
                "scopes": ["read_data", "execute_tools"],
                "timestamp": (datetime.utcnow() - timedelta(minutes=3)).isoformat()
            }
        ],
        "verification": {
            "chain_intact": True,
            "all_signatures_valid": True,
            "no_token_reuse": True,
            "audit_complete": True
        }
    }
    
    return {
        "success": True,
        "mcp_info": {
            "tool": "get_delegation_chain",
            "resource_server": "mcp-audit.company.com",
            "required_scope": "audit:read"
        },
        "delegation_chain": chain,
        "message": "Full delegation chain retrieved with cryptographic proof of authorization at each step"
    }
