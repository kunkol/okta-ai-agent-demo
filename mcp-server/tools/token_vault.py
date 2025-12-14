"""
Token Vault Tools - Third-Party API Access
Demonstrates secure access to external services via Token Vault.

Scenarios Covered:
- Scenario 4: Third-Party API Access (Google Calendar, Slack, GitHub)

These tools simulate the Token Vault flow where:
1. Agent requests token from vault for external service
2. If user hasn't linked account, returns OAuth consent URL
3. If linked, returns simulated data (in production, would call real APIs)

Security Concepts Demonstrated:
- Short-lived, scoped tokens (never raw OAuth tokens)
- User consent and account linking
- Audit trail for external service access
"""

from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import uuid

# =============================================================================
# Simulated Token Vault State
# =============================================================================

# Simulates which users have linked which services
USER_LINKED_SERVICES = {
    "alice": ["google", "slack", "github"],
    "bob": ["google", "slack"],  # Bob hasn't linked GitHub
    "charlie": [],  # Charlie hasn't linked anything
}

# =============================================================================
# Google Calendar Tool
# =============================================================================

DEMO_CALENDAR_EVENTS = [
    {
        "id": "evt-001",
        "title": "Q4 Planning Meeting",
        "start": "2024-12-16T09:00:00",
        "end": "2024-12-16T10:00:00",
        "attendees": ["alice@company.com", "bob@company.com", "cfo@company.com"],
        "location": "Conference Room A",
        "description": "Quarterly planning and budget review"
    },
    {
        "id": "evt-002",
        "title": "1:1 with Manager",
        "start": "2024-12-16T11:00:00",
        "end": "2024-12-16T11:30:00",
        "attendees": ["alice@company.com", "manager@company.com"],
        "location": "Virtual - Zoom",
        "description": "Weekly sync"
    },
    {
        "id": "evt-003",
        "title": "AI Security Demo Prep",
        "start": "2024-12-16T14:00:00",
        "end": "2024-12-16T15:00:00",
        "attendees": ["alice@company.com", "security-team@company.com"],
        "location": "Demo Lab",
        "description": "Prepare Okta AI Agent Security demo"
    },
    {
        "id": "evt-004",
        "title": "Customer Call - Acme Corp",
        "start": "2024-12-16T16:00:00",
        "end": "2024-12-16T17:00:00",
        "attendees": ["alice@company.com", "sales@company.com", "contact@acme.com"],
        "location": "Virtual - Teams",
        "description": "Enterprise deal discussion"
    }
]

def get_calendar_events(
    user_id: str = "alice",
    date: str = None,
    max_results: int = 10
) -> dict:
    """
    Retrieve calendar events via Token Vault.
    
    Simulates the Token Vault flow:
    1. Check if user has linked Google account
    2. If not, return OAuth consent URL
    3. If yes, return calendar events
    
    Args:
        user_id: User requesting calendar access
        date: Date to fetch events for (YYYY-MM-DD)
        max_results: Maximum events to return
        
    Returns:
        dict with calendar events or OAuth redirect
    """
    user_key = user_id.lower().strip()
    linked_services = USER_LINKED_SERVICES.get(user_key, [])
    
    # Check if user has linked Google
    if "google" not in linked_services:
        return {
            "success": False,
            "requires_oauth": True,
            "provider": "google",
            "oauth_url": f"https://auth.company.com/authorize?provider=google&user={user_id}&scope=calendar.readonly",
            "message": f"User '{user_id}' has not linked their Google account. OAuth consent required.",
            "token_vault_action": "redirect_to_oauth"
        }
    
    # Simulate successful Token Vault exchange
    return {
        "success": True,
        "provider": "google",
        "service": "calendar",
        "token_info": {
            "type": "short_lived",
            "ttl_minutes": 15,
            "scope": "calendar.readonly",
            "note": "Agent received scoped token, not raw OAuth credentials"
        },
        "events": DEMO_CALENDAR_EVENTS[:max_results],
        "total_events": len(DEMO_CALENDAR_EVENTS),
        "message": f"Retrieved {min(max_results, len(DEMO_CALENDAR_EVENTS))} calendar events for {user_id}"
    }


# =============================================================================
# Slack Tool
# =============================================================================

DEMO_SLACK_CHANNELS = {
    "team": {"id": "C001", "name": "#team", "members": 12},
    "engineering": {"id": "C002", "name": "#engineering", "members": 45},
    "sales": {"id": "C003", "name": "#sales", "members": 23},
    "general": {"id": "C004", "name": "#general", "members": 150}
}

def post_to_slack(
    user_id: str = "alice",
    channel: str = "team",
    message: str = "",
    as_user: bool = True
) -> dict:
    """
    Post message to Slack via Token Vault.
    
    Simulates the Token Vault flow for Slack:
    1. Check if user has linked Slack account
    2. If not, return OAuth consent URL
    3. If yes, simulate posting message
    
    Args:
        user_id: User on whose behalf to post
        channel: Slack channel name (without #)
        message: Message content to post
        as_user: Post as user (True) or as bot (False)
        
    Returns:
        dict with post result or OAuth redirect
    """
    user_key = user_id.lower().strip()
    linked_services = USER_LINKED_SERVICES.get(user_key, [])
    
    if not message:
        return {
            "success": False,
            "error": "message_required",
            "message": "Message content is required"
        }
    
    # Check if user has linked Slack
    if "slack" not in linked_services:
        return {
            "success": False,
            "requires_oauth": True,
            "provider": "slack",
            "oauth_url": f"https://auth.company.com/authorize?provider=slack&user={user_id}&scope=chat:write,channels:read",
            "message": f"User '{user_id}' has not linked their Slack account. OAuth consent required.",
            "token_vault_action": "redirect_to_oauth"
        }
    
    channel_info = DEMO_SLACK_CHANNELS.get(channel.lower().replace("#", ""), {
        "id": "C999",
        "name": f"#{channel}",
        "members": 0
    })
    
    # Simulate successful post
    message_id = f"msg-{uuid.uuid4().hex[:8]}"
    
    return {
        "success": True,
        "provider": "slack",
        "service": "chat",
        "token_info": {
            "type": "short_lived",
            "ttl_minutes": 15,
            "scope": "chat:write",
            "note": "Agent received scoped token, not raw OAuth credentials"
        },
        "post_result": {
            "message_id": message_id,
            "channel": channel_info["name"],
            "channel_id": channel_info["id"],
            "timestamp": datetime.utcnow().isoformat(),
            "posted_as": user_id if as_user else "AI Assistant Bot",
            "message_preview": message[:100] + "..." if len(message) > 100 else message
        },
        "message": f"Message posted to {channel_info['name']} successfully"
    }


# =============================================================================
# GitHub Tool
# =============================================================================

DEMO_GITHUB_REPOS = {
    "okta-ai-agent-demo": {
        "id": "repo-001",
        "full_name": "company/okta-ai-agent-demo",
        "default_branch": "main",
        "open_issues": 5
    },
    "internal-tools": {
        "id": "repo-002",
        "full_name": "company/internal-tools",
        "default_branch": "main",
        "open_issues": 12
    }
}

def create_github_issue(
    user_id: str = "alice",
    repo: str = "okta-ai-agent-demo",
    title: str = "",
    body: str = "",
    labels: List[str] = None
) -> dict:
    """
    Create GitHub issue via Token Vault.
    
    Simulates the Token Vault flow for GitHub:
    1. Check if user has linked GitHub account
    2. If not, return OAuth consent URL
    3. If yes, simulate creating issue
    
    Args:
        user_id: User on whose behalf to create issue
        repo: Repository name
        title: Issue title
        body: Issue body/description
        labels: List of labels to apply
        
    Returns:
        dict with issue creation result or OAuth redirect
    """
    user_key = user_id.lower().strip()
    linked_services = USER_LINKED_SERVICES.get(user_key, [])
    
    if not title:
        return {
            "success": False,
            "error": "title_required",
            "message": "Issue title is required"
        }
    
    # Check if user has linked GitHub
    if "github" not in linked_services:
        return {
            "success": False,
            "requires_oauth": True,
            "provider": "github",
            "oauth_url": f"https://auth.company.com/authorize?provider=github&user={user_id}&scope=repo,issues:write",
            "message": f"User '{user_id}' has not linked their GitHub account. OAuth consent required.",
            "token_vault_action": "redirect_to_oauth"
        }
    
    repo_info = DEMO_GITHUB_REPOS.get(repo, {
        "id": "repo-unknown",
        "full_name": f"company/{repo}",
        "default_branch": "main",
        "open_issues": 0
    })
    
    # Simulate issue creation
    issue_number = repo_info["open_issues"] + 1
    
    return {
        "success": True,
        "provider": "github",
        "service": "issues",
        "token_info": {
            "type": "short_lived",
            "ttl_minutes": 15,
            "scope": "repo,issues:write",
            "note": "Agent received scoped token, not raw OAuth credentials"
        },
        "issue": {
            "number": issue_number,
            "id": f"issue-{uuid.uuid4().hex[:8]}",
            "url": f"https://github.com/{repo_info['full_name']}/issues/{issue_number}",
            "title": title,
            "body": body,
            "labels": labels or [],
            "state": "open",
            "created_by": user_id,
            "created_at": datetime.utcnow().isoformat()
        },
        "message": f"Issue #{issue_number} created in {repo_info['full_name']}"
    }


def get_github_repos(user_id: str = "alice") -> dict:
    """
    List GitHub repositories via Token Vault.
    
    Args:
        user_id: User requesting repo list
        
    Returns:
        dict with repositories or OAuth redirect
    """
    user_key = user_id.lower().strip()
    linked_services = USER_LINKED_SERVICES.get(user_key, [])
    
    if "github" not in linked_services:
        return {
            "success": False,
            "requires_oauth": True,
            "provider": "github",
            "oauth_url": f"https://auth.company.com/authorize?provider=github&user={user_id}&scope=repo:read",
            "message": f"User '{user_id}' has not linked their GitHub account.",
            "token_vault_action": "redirect_to_oauth"
        }
    
    return {
        "success": True,
        "provider": "github",
        "service": "repos",
        "repositories": list(DEMO_GITHUB_REPOS.values()),
        "total": len(DEMO_GITHUB_REPOS),
        "message": f"Retrieved {len(DEMO_GITHUB_REPOS)} repositories"
    }
