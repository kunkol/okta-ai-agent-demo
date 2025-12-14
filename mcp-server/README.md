# MCP Server - Okta AI Agent Security Demo

**Project C1** - Part of the [okta-ai-agent-demo](https://github.com/kunkol/okta-ai-agent-demo)

This MCP (Model Context Protocol) Server exposes **12 tools** across **5 security scenarios** that AI agents can call. It demonstrates comprehensive security concepts including:

- Fine-Grained Authorization (FGA) for data access
- Risk-based controls with CIBA (human-in-the-loop)
- Token Vault for third-party API access
- XAA/ID-JAG for internal MCP tool access
- Multi-agent coordination with delegation chains
- Complete audit trail visibility

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MCP SERVER (12 Tools)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SCENARIO 1: Customer Support (FGA)                                         │
│  └── get_customer          Alice=allow, Bob=partial, Charlie=deny          │
│                                                                             │
│  SCENARIO 2: Financial Transactions (Risk + CIBA)                           │
│  └── initiate_payment      Risk tiers + CIBA approval triggers             │
│                                                                             │
│  SCENARIO 3: RAG Document Search (Role-Based)                               │
│  └── search_documents      Employee/Manager/Admin filtering                │
│                                                                             │
│  SCENARIO 4: Token Vault (Third-Party APIs)                                 │
│  ├── get_calendar_events   Google Calendar via Token Vault                 │
│  ├── post_to_slack         Slack via Token Vault                           │
│  ├── create_github_issue   GitHub via Token Vault                          │
│  └── get_github_repos      GitHub read access                              │
│                                                                             │
│  SCENARIO 5: Internal MCP Tools (XAA/ID-JAG)                                │
│  ├── run_data_analysis     Internal analytics with XAA                     │
│  ├── run_compliance_check  SOX/GDPR/SOC2 compliance                        │
│  ├── coordinate_agents     Multi-agent orchestration                       │
│  ├── get_agent_registry    Agent discovery                                 │
│  └── get_delegation_chain  Full audit trail                                │
│                                                                             │
│  🔐 SECURITY (configured in Project C4)                                     │
│  ├── Okta Token Validation                                                 │
│  ├── Cross-App Access (XAA / ID-JAG)                                       │
│  └── Scope-based Authorization                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Demo Scenarios

### Scenario 1: Customer Data Access (FGA Demo)

| Customer | Access Result | Demonstrates |
|----------|--------------|--------------|
| Alice | ✅ Full access | Happy path, enterprise customer |
| Bob | ⚠️ Partial access | Data filtering, sensitive fields removed |
| Charlie | ❌ Denied | Policy enforcement, compliance hold |

```bash
# Try it
curl http://localhost:8000/tools/get_customer/alice   # Full access
curl http://localhost:8000/tools/get_customer/bob     # Partial access
curl http://localhost:8000/tools/get_customer/charlie # Denied
```

### Scenario 2: Financial Transactions (Risk + CIBA)

| Amount | Risk Level | Action |
|--------|-----------|--------|
| ≤ $1,000 | Low | Auto-approved |
| $1,001 - $10,000 | Medium | Approved with logging |
| > $10,000 | High | Requires CIBA approval |

```bash
# Low risk - auto approved
curl -X POST "http://localhost:8000/tools/initiate_payment?amount=500&recipient=Acme%20Corp"

# High risk - CIBA triggered
curl -X POST "http://localhost:8000/tools/initiate_payment?amount=50000&recipient=Acme%20Corp"
```

### Scenario 3: Document Search (Role-Based Access)

| Role | Access Levels | Documents Visible |
|------|--------------|-------------------|
| Employee | Public | 2 documents |
| Manager | Public, Team, Department | 6 documents |
| Admin | All including Confidential | 8 documents |

```bash
curl "http://localhost:8000/tools/search_documents?query=sales&user_role=employee"
curl "http://localhost:8000/tools/search_documents?query=sales&user_role=manager"
curl "http://localhost:8000/tools/search_documents?query=sales&user_role=admin"
```

### Scenario 4: Token Vault (Third-Party APIs)

Demonstrates OAuth token exchange where agent never sees raw credentials.

| User | Linked Services | Demo |
|------|----------------|------|
| Alice | Google, Slack, GitHub | Full access |
| Bob | Google, Slack | GitHub returns OAuth redirect |
| Charlie | None | All services return OAuth redirect |

```bash
# Calendar - Alice has linked Google
curl "http://localhost:8000/tools/calendar/events?user_id=alice"

# Slack - Post message
curl -X POST "http://localhost:8000/tools/slack/post?channel=team&message=Hello%20from%20agent&user_id=alice"

# GitHub - Bob hasn't linked (returns OAuth redirect)
curl -X POST "http://localhost:8000/tools/github/issues?title=Bug%20fix&user_id=bob"
```

### Scenario 5: Internal MCP Tools (XAA/ID-JAG)

```bash
# Data analysis (requires XAA in production)
curl "http://localhost:8000/tools/analysis/run?analysis_type=sales_summary"

# Compliance check
curl "http://localhost:8000/tools/compliance/check?check_type=all"

# Multi-agent coordination
curl -X POST "http://localhost:8000/tools/agents/coordinate?task_description=Process%20customer%20refund"

# Agent registry
curl "http://localhost:8000/tools/agents/registry"

# Audit trail
curl "http://localhost:8000/tools/audit/delegation-chain"
```

## Quick Start

### Local Development

```bash
# Clone the repo
git clone https://github.com/kunkol/okta-ai-agent-demo.git
cd okta-ai-agent-demo/mcp-server

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload --port 8000
```

### Test the API

Visit Swagger UI: http://localhost:8000/docs

### Using the Generic Tool Call Endpoint

```bash
# Call any tool via POST /tools/call
curl -X POST http://localhost:8000/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "get_customer",
    "parameters": {"name": "Alice"}
  }'
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/tools/list` | GET | List all 12 tools with schemas |
| `/tools/call` | POST | Execute any tool |
| `/tools/get_customer/{name}` | GET | Customer lookup |
| `/tools/initiate_payment` | POST | Payment processing |
| `/tools/search_documents` | GET | Document search |
| `/tools/calendar/events` | GET | Calendar via Token Vault |
| `/tools/slack/post` | POST | Slack via Token Vault |
| `/tools/github/issues` | POST | GitHub via Token Vault |
| `/tools/github/repos` | GET | GitHub repos |
| `/tools/analysis/run` | GET | Data analysis |
| `/tools/compliance/check` | GET | Compliance check |
| `/tools/agents/coordinate` | POST | Multi-agent coordination |
| `/tools/agents/registry` | GET | Agent registry |
| `/tools/audit/delegation-chain` | GET | Audit trail |

## Deploy to Render.com

1. Fork/push this repo to your GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click **New > Web Service**
4. Connect your GitHub repo
5. Select the `mcp-server` directory
6. Render will auto-detect settings from `render.yaml`
7. Click **Create Web Service**

Your MCP server will be available at: `https://okta-mcp-server.onrender.com`

## Project Structure

```
mcp-server/
├── main.py                    # FastAPI application (12 tools)
├── tools/
│   ├── __init__.py
│   ├── customer.py            # Scenario 1: FGA demo
│   ├── documents.py           # Scenario 3: Role-based RAG
│   ├── payments.py            # Scenario 2: Risk + CIBA
│   ├── token_vault.py         # Scenario 4: Third-party APIs
│   └── internal_tools.py      # Scenario 5: XAA/ID-JAG tools
├── requirements.txt
├── render.yaml
└── README.md
```

## Related Projects

| Project | Description | Chat |
|---------|-------------|------|
| **C0** | Okta Setup (baseline) | Foundation |
| **C1** | MCP Server (this) | You are here |
| **C2** | Backend API | Claude AI integration |
| **C3** | Frontend | Next.js UI |
| **C4** | Okta Security Config | XAA, policies |

## Okta Integration (Project C4)

In Project C4, we will add real token validation:

```python
# Token validation middleware (to be added)
async def validate_okta_token(authorization: str):
    # Validate JWT from Okta
    # Check scopes: read_data, write_data, payments
    # Enforce XAA (Cross-App Access) policies
    pass
```

Configuration values (from your Okta tenant):
- **Tenant**: `qa-aiagentsproducttc1.trexcloud.com`
- **Auth Server**: `default`
- **Expected Scopes**: `read_data`, `write_data`, `payments`, `analytics`, `compliance`

---

Built for the Okta AI Agent Security Demo by Kundan
