"""
Google Calendar MCP Tools - Uses Token Vault for real Google Calendar API access

Add to backend-api/app/services/google_calendar_tools.py

These tools retrieve real calendar data using tokens stored in Auth0 Token Vault.
"""

import httpx
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"


async def call_google_calendar_api(
    endpoint: str,
    google_token: str,
    method: str = "GET",
    data: Optional[Dict] = None,
    params: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Make an authenticated call to Google Calendar API.
    
    Args:
        endpoint: API endpoint (e.g., '/calendars/primary/events')
        google_token: Access token from Token Vault
        method: HTTP method
        data: Request body for POST/PATCH
        params: Query parameters
        
    Returns:
        API response as dict
    """
    url = f"{GOOGLE_CALENDAR_API}{endpoint}"
    headers = {
        "Authorization": f"Bearer {google_token}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        if method == "GET":
            response = await client.get(url, headers=headers, params=params)
        elif method == "POST":
            response = await client.post(url, headers=headers, json=data, params=params)
        elif method == "PATCH":
            response = await client.patch(url, headers=headers, json=data, params=params)
        elif method == "DELETE":
            response = await client.delete(url, headers=headers, params=params)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        if response.status_code >= 400:
            logger.error(f"Google Calendar API error: {response.status_code} - {response.text}")
            return {"error": response.text, "status_code": response.status_code}
        
        return response.json() if response.text else {"success": True}


async def list_calendar_events(
    google_token: str,
    days_ahead: int = 7,
    search_query: Optional[str] = None
) -> Dict[str, Any]:
    """
    List upcoming calendar events.
    
    Args:
        google_token: Token from Token Vault
        days_ahead: Number of days to look ahead (default 7)
        search_query: Optional search query to filter events
        
    Returns:
        List of calendar events
    """
    now = datetime.utcnow()
    time_min = now.isoformat() + "Z"
    time_max = (now + timedelta(days=days_ahead)).isoformat() + "Z"
    
    params = {
        "timeMin": time_min,
        "timeMax": time_max,
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": 20
    }
    
    if search_query:
        params["q"] = search_query
    
    result = await call_google_calendar_api(
        "/calendars/primary/events",
        google_token,
        params=params
    )
    
    if "error" in result:
        return {
            "success": False,
            "error": result["error"]
        }
    
    events = []
    for item in result.get("items", []):
        start = item.get("start", {})
        end = item.get("end", {})
        
        events.append({
            "id": item.get("id"),
            "summary": item.get("summary", "No Title"),
            "description": item.get("description"),
            "start": start.get("dateTime") or start.get("date"),
            "end": end.get("dateTime") or end.get("date"),
            "location": item.get("location"),
            "attendees": [
                {"email": a.get("email"), "name": a.get("displayName")}
                for a in item.get("attendees", [])
            ],
            "status": item.get("status"),
            "html_link": item.get("htmlLink")
        })
    
    return {
        "success": True,
        "events": events,
        "count": len(events),
        "time_range": {
            "from": time_min,
            "to": time_max
        }
    }


async def get_meetings_with_contact(
    google_token: str,
    contact_name: str,
    days_ahead: int = 30
) -> Dict[str, Any]:
    """
    Find calendar events that mention a specific contact.
    
    Args:
        google_token: Token from Token Vault
        contact_name: Name to search for in event titles/descriptions
        days_ahead: Number of days to search ahead
        
    Returns:
        List of meetings mentioning the contact
    """
    result = await list_calendar_events(
        google_token,
        days_ahead=days_ahead,
        search_query=contact_name
    )
    
    if not result.get("success"):
        return result
    
    # Filter events that contain the contact name
    matching_events = []
    for event in result.get("events", []):
        summary = event.get("summary", "").lower()
        description = (event.get("description") or "").lower()
        attendees = [a.get("name", "").lower() + a.get("email", "").lower() 
                    for a in event.get("attendees", [])]
        
        contact_lower = contact_name.lower()
        if (contact_lower in summary or 
            contact_lower in description or
            any(contact_lower in att for att in attendees)):
            matching_events.append(event)
    
    return {
        "success": True,
        "contact": contact_name,
        "meetings": matching_events,
        "count": len(matching_events),
        "message": f"Found {len(matching_events)} meeting(s) with {contact_name}"
    }


async def create_calendar_event(
    google_token: str,
    summary: str,
    start_time: str,
    end_time: str,
    description: Optional[str] = None,
    location: Optional[str] = None,
    attendees: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Create a new calendar event.
    
    Args:
        google_token: Token from Token Vault
        summary: Event title
        start_time: Start time in ISO format (e.g., '2025-01-15T10:00:00')
        end_time: End time in ISO format
        description: Event description (optional)
        location: Event location (optional)
        attendees: List of attendee email addresses (optional)
        
    Returns:
        Created event details
    """
    event_data = {
        "summary": summary,
        "start": {
            "dateTime": start_time,
            "timeZone": "America/Los_Angeles"
        },
        "end": {
            "dateTime": end_time,
            "timeZone": "America/Los_Angeles"
        }
    }
    
    if description:
        event_data["description"] = description
    if location:
        event_data["location"] = location
    if attendees:
        event_data["attendees"] = [{"email": email} for email in attendees]
    
    result = await call_google_calendar_api(
        "/calendars/primary/events",
        google_token,
        method="POST",
        data=event_data
    )
    
    if "error" in result:
        return {
            "success": False,
            "error": result["error"]
        }
    
    return {
        "success": True,
        "event_id": result.get("id"),
        "summary": result.get("summary"),
        "start": result.get("start", {}).get("dateTime"),
        "end": result.get("end", {}).get("dateTime"),
        "html_link": result.get("htmlLink"),
        "message": f"Created event: {summary}"
    }


# MCP Tool Definitions (for Claude)
CALENDAR_TOOLS = [
    {
        "name": "list_calendar_events",
        "description": "List upcoming calendar events for the next N days. Can optionally search for specific terms.",
        "input_schema": {
            "type": "object",
            "properties": {
                "days_ahead": {
                    "type": "integer",
                    "description": "Number of days to look ahead (default 7)",
                    "default": 7
                },
                "search_query": {
                    "type": "string",
                    "description": "Optional search term to filter events"
                }
            },
            "required": []
        }
    },
    {
        "name": "get_meetings_with_contact",
        "description": "Find calendar meetings that involve a specific person/contact.",
        "input_schema": {
            "type": "object",
            "properties": {
                "contact_name": {
                    "type": "string",
                    "description": "Name of the contact to search for (e.g., 'Marcus Thompson')"
                },
                "days_ahead": {
                    "type": "integer",
                    "description": "Number of days to search ahead (default 30)",
                    "default": 30
                }
            },
            "required": ["contact_name"]
        }
    },
    {
        "name": "create_calendar_event",
        "description": "Create a new calendar event/meeting.",
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {
                    "type": "string",
                    "description": "Event title"
                },
                "start_time": {
                    "type": "string",
                    "description": "Start time in ISO format (e.g., '2025-01-15T10:00:00')"
                },
                "end_time": {
                    "type": "string",
                    "description": "End time in ISO format"
                },
                "description": {
                    "type": "string",
                    "description": "Event description (optional)"
                },
                "location": {
                    "type": "string",
                    "description": "Event location (optional)"
                },
                "attendees": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of attendee email addresses (optional)"
                }
            },
            "required": ["summary", "start_time", "end_time"]
        }
    }
]
