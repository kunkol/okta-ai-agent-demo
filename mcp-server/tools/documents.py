"""
Documents Tool - search_documents
Searches internal documents with Fine-Grained Authorization (FGA) filtering.

Demo Scenarios:
- Employee role: Access to public and team documents only
- Manager role: Access to public, team, and department documents
- Admin role: Full access to all documents including confidential

This demonstrates RAG (Retrieval Augmented Generation) with permission filtering.
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class DocumentSearchResponse(BaseModel):
    success: bool
    documents: List[Dict[str, Any]]
    total_found: int
    filtered_count: int
    user_role: str
    message: str

# =============================================================================
# Demo Document Database
# =============================================================================

DEMO_DOCUMENTS = [
    {
        "id": "DOC-001",
        "title": "Q4 2024 Sales Report",
        "type": "report",
        "classification": "public",
        "department": "Sales",
        "content_preview": "Q4 revenue reached $12.5M, exceeding targets by 15%. Key wins include Enterprise deals with Acme Corp and TechGiant Inc.",
        "author": "Sales Analytics Team",
        "created_at": "2024-12-01",
        "keywords": ["sales", "revenue", "Q4", "quarterly", "report"]
    },
    {
        "id": "DOC-002",
        "title": "Product Roadmap 2025",
        "type": "planning",
        "classification": "team",
        "department": "Product",
        "content_preview": "2025 roadmap includes AI agent integration, enhanced security features, and new API capabilities launching Q2.",
        "author": "Product Management",
        "created_at": "2024-11-15",
        "keywords": ["roadmap", "product", "2025", "planning", "AI", "features"]
    },
    {
        "id": "DOC-003",
        "title": "Employee Compensation Guidelines",
        "type": "policy",
        "classification": "department",
        "department": "HR",
        "content_preview": "Compensation bands for FY2025 have been updated. Merit increases range from 3-8% based on performance ratings.",
        "author": "HR Policy Team",
        "created_at": "2024-10-20",
        "keywords": ["compensation", "salary", "HR", "policy", "benefits"]
    },
    {
        "id": "DOC-004",
        "title": "M&A Target Analysis - Project Phoenix",
        "type": "confidential",
        "classification": "confidential",
        "department": "Strategy",
        "content_preview": "Analysis of potential acquisition targets in the AI security space. Top candidates include [REDACTED] with valuations ranging $50-150M.",
        "author": "Corporate Strategy",
        "created_at": "2024-12-05",
        "keywords": ["M&A", "acquisition", "strategy", "confidential", "phoenix"]
    },
    {
        "id": "DOC-005",
        "title": "API Integration Guide",
        "type": "technical",
        "classification": "public",
        "department": "Engineering",
        "content_preview": "Step-by-step guide for integrating with our REST API. Covers authentication, rate limits, and common endpoints.",
        "author": "Developer Relations",
        "created_at": "2024-09-10",
        "keywords": ["API", "integration", "technical", "documentation", "REST"]
    },
    {
        "id": "DOC-006",
        "title": "Customer Churn Analysis",
        "type": "analysis",
        "classification": "team",
        "department": "Customer Success",
        "content_preview": "Churn rate decreased to 4.2% in Q4. Key factors include improved onboarding and dedicated success managers for enterprise accounts.",
        "author": "Customer Analytics",
        "created_at": "2024-12-08",
        "keywords": ["churn", "retention", "customer", "analysis", "success"]
    },
    {
        "id": "DOC-007",
        "title": "Security Incident Response Plan",
        "type": "policy",
        "classification": "department",
        "department": "Security",
        "content_preview": "Updated incident response procedures including escalation paths, communication templates, and recovery timelines.",
        "author": "Security Operations",
        "created_at": "2024-11-01",
        "keywords": ["security", "incident", "response", "policy", "SOC"]
    },
    {
        "id": "DOC-008",
        "title": "Board Meeting Minutes - December 2024",
        "type": "confidential",
        "classification": "confidential",
        "department": "Executive",
        "content_preview": "Board approved 2025 budget allocation. Key decisions on market expansion and R&D investment ratios.",
        "author": "Executive Assistant",
        "created_at": "2024-12-10",
        "keywords": ["board", "meeting", "executive", "budget", "confidential"]
    }
]

# =============================================================================
# FGA Access Policies
# =============================================================================

ROLE_ACCESS_LEVELS = {
    "employee": ["public"],
    "manager": ["public", "team", "department"],
    "admin": ["public", "team", "department", "confidential"]
}

def check_document_access(doc_classification: str, user_role: str) -> bool:
    """
    Check if user role has access to document classification level.
    
    Simulates Fine-Grained Authorization (FGA) batch check.
    In production, this would call Auth0 FGA BatchCheck API.
    """
    allowed_levels = ROLE_ACCESS_LEVELS.get(user_role, ["public"])
    return doc_classification in allowed_levels

# =============================================================================
# Main Tool Function
# =============================================================================

def search_documents_data(query: str, user_role: str = "employee") -> dict:
    """
    Search documents with FGA-based filtering.
    
    Args:
        query: Search query string
        user_role: Role of requesting user (employee, manager, admin)
        
    Returns:
        dict with filtered document results
    """
    if not query:
        return {
            "success": False,
            "documents": [],
            "total_found": 0,
            "filtered_count": 0,
            "user_role": user_role,
            "message": "Search query is required"
        }
    
    # Normalize role
    user_role = user_role.lower() if user_role else "employee"
    if user_role not in ROLE_ACCESS_LEVELS:
        user_role = "employee"
    
    query_lower = query.lower()
    
    # Search all documents
    matching_docs = []
    filtered_count = 0
    
    for doc in DEMO_DOCUMENTS:
        # Check if query matches document
        matches = False
        
        # Search in title
        if query_lower in doc["title"].lower():
            matches = True
        
        # Search in content preview
        if query_lower in doc["content_preview"].lower():
            matches = True
            
        # Search in keywords
        if any(query_lower in kw.lower() for kw in doc["keywords"]):
            matches = True
        
        # Search in department
        if query_lower in doc["department"].lower():
            matches = True
        
        if matches:
            # Check FGA access
            if check_document_access(doc["classification"], user_role):
                # User has access - include document
                matching_docs.append({
                    "id": doc["id"],
                    "title": doc["title"],
                    "type": doc["type"],
                    "classification": doc["classification"],
                    "department": doc["department"],
                    "content_preview": doc["content_preview"],
                    "author": doc["author"],
                    "created_at": doc["created_at"],
                    "access_granted": True
                })
            else:
                # User does not have access - count but don't include
                filtered_count += 1
    
    # Build response message
    access_levels = ROLE_ACCESS_LEVELS.get(user_role, ["public"])
    
    if filtered_count > 0:
        message = f"Found {len(matching_docs)} accessible documents. {filtered_count} additional documents filtered due to access restrictions."
    elif len(matching_docs) > 0:
        message = f"Found {len(matching_docs)} documents matching '{query}'"
    else:
        message = f"No documents found matching '{query}' within your access level"
    
    return {
        "success": True,
        "documents": matching_docs,
        "total_found": len(matching_docs) + filtered_count,
        "filtered_count": filtered_count,
        "user_role": user_role,
        "access_levels": access_levels,
        "message": message
    }
