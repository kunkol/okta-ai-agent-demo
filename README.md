# Okta AI Agent Security Demo

A comprehensive demonstration of securing AI agents with Okta, showcasing:

- **Cross-App Access (XAA / ID-JAG)**: Secure agent-to-tool communication
- **Fine-Grained Authorization (FGA)**: Permission-based data filtering
- **CIBA**: Out-of-band approval for high-risk operations
- **Audit Trail**: Complete logging of agent actions and decisions

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OKTA AI AGENT SECURITY DEMO                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │   FRONTEND      │    │    BACKEND      │    │   MCP SERVER    │        │
│  │   (Next.js)     │───▶│   (FastAPI)     │───▶│   (FastAPI)     │        │
│  │                 │    │                 │    │                 │        │
│  │  • Chat UI      │    │  • Claude AI    │    │  • get_customer │        │
│  │  • Security     │    │  • Auth Layer   │    │  • search_docs  │        │
│  │    Flow Panel   │    │  • Token Exch   │    │  • payments     │        │
│  │  • Audit Log    │    │                 │    │                 │        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
│         │                       │                      │                   │
│         └───────────────────────┴──────────────────────┘                   │
│                                 │                                          │
│                                 ▼                                          │
│                    ┌─────────────────────────┐                             │
│                    │         OKTA            │                             │
│                    │  • User SSO             │                             │
│                    │  • Agent Registry       │                             │
│                    │  • Cross-App Access     │                             │
│                    │  • ID-JAG Token Flow    │                             │
│                    └─────────────────────────┘                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Projects

| Code | Project | Description | Status |
|------|---------|-------------|--------|
| C0 | Okta Setup | Baseline configuration | ✅ Done |
| C1 | [MCP Server](./mcp-server/) | Tools for AI agents | ✅ Ready |
| C2 | Backend API | Claude AI integration | 🚧 Next |
| C3 | Frontend | Next.js chat UI | ⏳ Pending |
| C4 | Okta Security | XAA configuration | ⏳ Pending |

## Demo Scenarios

### 1. Customer Lookup with FGA
```
User: "Pull all info on customer Alice"
Agent: Calls get_customer → FGA allows → Returns full data ✅

User: "Show me Charlie's details"  
Agent: Calls get_customer → FGA denies → Access blocked ❌
```

### 2. Document Search with Role-Based Access
```
Employee searches "sales" → Sees 2 public documents
Manager searches "sales" → Sees 6 documents (including team/dept)
Admin searches "sales" → Sees all 8 documents
```

### 3. High-Risk Payment with CIBA
```
User: "Transfer $50,000 to Acme Corp"
Agent: Calls initiate_payment → HIGH RISK detected
       → CIBA approval triggered
       → Push notification sent to approvers
       → Transaction pending until approved
```

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+ (for frontend)
- Okta tenant with AI Agents enabled

### Deploy MCP Server
```bash
cd mcp-server
pip install -r requirements.txt
uvicorn main:app --reload
```

### Full Deployment
See individual project READMEs for deployment instructions.

## Okta Configuration

| Item | Value |
|------|-------|
| Tenant | `qa-aiagentsproducttc1.trexcloud.com` |
| OAuth App | `0oa8x8i98ebUMhrhw0g7` |
| Agent | `wlp8x98zcxMOXEPHJ0g7` |
| Auth Server | `default` |

## Learn More

- [Okta for AI Agents](https://developer.okta.com/docs/guides/ai-agents/)
- [Cross-App Access (XAA)](https://developer.okta.com/docs/concepts/cross-app-access/)
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)

---

Built by Kundan | Product Marketing @ Okta
