"""
Audit Logging Service

Provides comprehensive audit trail for:
- All tool calls
- Security decisions (FGA, CIBA)
- Token exchanges
- Access denials
"""

import logging
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime
from collections import deque

from app.models.schemas import AuditEntry, RiskLevel
from app.config import settings

logger = logging.getLogger(__name__)


class AuditService:
    """Service for audit logging and retrieval."""
    
    def __init__(self, max_entries: int = 1000):
        # In-memory storage for demo (use database in production)
        self._entries: deque = deque(maxlen=max_entries)
        self._entries_by_user: Dict[str, List[AuditEntry]] = {}
        self._entries_by_conversation: Dict[str, List[AuditEntry]] = {}
    
    def log(
        self,
        action: str,
        result: str,
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        resource: Optional[str] = None,
        tool_name: Optional[str] = None,
        tool_input: Optional[Dict[str, Any]] = None,
        risk_level: RiskLevel = RiskLevel.LOW,
        security_context: Optional[Dict[str, Any]] = None,
        delegation_chain: List[str] = None,
        message: Optional[str] = None
    ) -> AuditEntry:
        """
        Log an audit entry.
        
        Args:
            action: Action performed (e.g., "tool_call", "token_exchange")
            result: Result of action ("success", "denied", "error")
            user_id: User's Okta sub
            agent_id: AI Agent ID
            conversation_id: Conversation ID
            resource: Resource accessed
            tool_name: Tool that was called
            tool_input: Input parameters to tool
            risk_level: Risk level of the action
            security_context: Security-related metadata
            delegation_chain: Token delegation chain
            message: Human-readable message
            
        Returns:
            Created AuditEntry
        """
        entry = AuditEntry(
            id=f"audit-{uuid.uuid4().hex[:12]}",
            timestamp=datetime.utcnow(),
            user_id=user_id,
            agent_id=agent_id or settings.OKTA_AGENT_ID,
            action=action,
            resource=resource,
            tool_name=tool_name,
            tool_input=tool_input,
            result=result,
            risk_level=risk_level,
            security_context=security_context or {},
            delegation_chain=delegation_chain or [],
            message=message
        )
        
        # Store in memory
        self._entries.append(entry)
        
        # Index by user
        if user_id:
            if user_id not in self._entries_by_user:
                self._entries_by_user[user_id] = []
            self._entries_by_user[user_id].append(entry)
        
        # Index by conversation
        if conversation_id:
            if conversation_id not in self._entries_by_conversation:
                self._entries_by_conversation[conversation_id] = []
            self._entries_by_conversation[conversation_id].append(entry)
        
        # Log to standard logger as well
        log_msg = f"AUDIT | {action} | {result} | user={user_id} | tool={tool_name}"
        if risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
            logger.warning(log_msg)
        else:
            logger.info(log_msg)
        
        return entry
    
    def log_tool_call(
        self,
        tool_name: str,
        tool_input: Dict[str, Any],
        result: str,
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        risk_level: RiskLevel = RiskLevel.LOW,
        execution_time_ms: Optional[int] = None,
        error_message: Optional[str] = None
    ) -> AuditEntry:
        """Log a tool call."""
        security_context = {
            "execution_time_ms": execution_time_ms
        }
        if error_message:
            security_context["error"] = error_message
        
        return self.log(
            action="tool_call",
            result=result,
            user_id=user_id,
            conversation_id=conversation_id,
            tool_name=tool_name,
            tool_input=tool_input,
            risk_level=risk_level,
            security_context=security_context,
            message=f"Tool {tool_name} called with result: {result}"
        )
    
    def log_token_exchange(
        self,
        user_id: str,
        target_audience: str,
        result: str,
        delegation_chain: List[str] = None
    ) -> AuditEntry:
        """Log a token exchange operation."""
        return self.log(
            action="token_exchange",
            result=result,
            user_id=user_id,
            resource=target_audience,
            security_context={
                "target_audience": target_audience,
                "delegation_chain": delegation_chain or []
            },
            delegation_chain=delegation_chain,
            message=f"Token exchanged for audience: {target_audience}"
        )
    
    def log_fga_check(
        self,
        user_id: str,
        resource: str,
        action: str,
        result: str,
        tuple_key: Optional[Dict[str, str]] = None
    ) -> AuditEntry:
        """Log a Fine-Grained Authorization check."""
        return self.log(
            action="fga_check",
            result=result,
            user_id=user_id,
            resource=resource,
            security_context={
                "fga_action": action,
                "tuple_key": tuple_key
            },
            message=f"FGA check for {action} on {resource}: {result}"
        )
    
    def log_ciba_request(
        self,
        user_id: str,
        binding_message: str,
        result: str,
        auth_req_id: Optional[str] = None
    ) -> AuditEntry:
        """Log a CIBA (Client Initiated Backchannel Authentication) request."""
        return self.log(
            action="ciba_request",
            result=result,
            user_id=user_id,
            risk_level=RiskLevel.HIGH,
            security_context={
                "binding_message": binding_message,
                "auth_req_id": auth_req_id
            },
            message=f"CIBA approval request: {result}"
        )
    
    def log_access_denied(
        self,
        user_id: str,
        resource: str,
        reason: str,
        risk_level: RiskLevel = RiskLevel.MEDIUM
    ) -> AuditEntry:
        """Log an access denial."""
        return self.log(
            action="access_denied",
            result="denied",
            user_id=user_id,
            resource=resource,
            risk_level=risk_level,
            message=f"Access denied to {resource}: {reason}"
        )
    
    def get_entries(
        self,
        user_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> tuple[List[AuditEntry], int]:
        """
        Retrieve audit entries with filtering.
        
        Returns:
            Tuple of (entries, total_count)
        """
        # Get base entries
        if user_id and user_id in self._entries_by_user:
            entries = self._entries_by_user[user_id]
        elif conversation_id and conversation_id in self._entries_by_conversation:
            entries = self._entries_by_conversation[conversation_id]
        else:
            entries = list(self._entries)
        
        # Filter by action if specified
        if action:
            entries = [e for e in entries if e.action == action]
        
        # Sort by timestamp descending
        entries = sorted(entries, key=lambda e: e.timestamp, reverse=True)
        
        total_count = len(entries)
        
        # Apply pagination
        entries = entries[offset:offset + limit]
        
        return entries, total_count
    
    def get_conversation_trail(self, conversation_id: str) -> List[AuditEntry]:
        """Get complete audit trail for a conversation."""
        entries = self._entries_by_conversation.get(conversation_id, [])
        return sorted(entries, key=lambda e: e.timestamp)
    
    def get_security_summary(self, user_id: str) -> Dict[str, Any]:
        """Get security summary for a user."""
        entries = self._entries_by_user.get(user_id, [])
        
        summary = {
            "total_actions": len(entries),
            "tool_calls": 0,
            "token_exchanges": 0,
            "access_denials": 0,
            "high_risk_actions": 0,
            "ciba_requests": 0
        }
        
        for entry in entries:
            if entry.action == "tool_call":
                summary["tool_calls"] += 1
            elif entry.action == "token_exchange":
                summary["token_exchanges"] += 1
            elif entry.action == "access_denied":
                summary["access_denials"] += 1
            elif entry.action == "ciba_request":
                summary["ciba_requests"] += 1
            
            if entry.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
                summary["high_risk_actions"] += 1
        
        return summary


# Global audit service instance
audit_service = AuditService()
