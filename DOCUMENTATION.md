# Okta AI Agent Security Demo

## Apex Customer 360 - Enterprise Customer Intelligence Platform

A comprehensive demonstration of AI Agent security using Okta for AI Agents, showcasing Cross-App Access (XAA), Fine-Grained Authorization (FGA), and CIBA step-up authentication.

**Live Demo:** https://okta-ai-agent-demo.vercel.app

**Demo by:** Kundan Kolhe | Product Marketing, Okta

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Deployed Components](#deployed-components)
3. [Chapter Summary](#chapter-summary)
4. [Security Scenarios](#security-scenarios)
5. [API Reference](#api-reference)
6. [Local Development](#local-development)
7. [Deployment Guide](#deployment-guide)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    APEX CUSTOMER 360                            │
│              Enterprise Customer Intelligence                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Support Rep                                 │
│                    (Customer Service)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Customer Service App                            │
│                       (Next.js)                                  │
│              https://okta-ai-agent-demo.vercel.app              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Atlas                                    │
│                      (AI Agent)                                  │
│            https://okta-ai-agent-backend.onrender.com           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Okta                                    │
│                    Identity / XAA                                │
│             qa-aiagentsproducttc1.trexcloud.com                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│      Internal MCP         │   │     External SaaS         │
│    (Enterprise Tools)     │   │     (Coming Soon)         │
│                           │   │                           │
│  ┌─────┐ ┌─────┐ ┌─────┐ │   │  ┌──────┐ ┌─────┐        │
│  │ CRM │ │Docs │ │Pay  │ │   │  │GitHub│ │Slack│        │
│  └─────┘ └─────┘ └─────┘ │   │  └──────┘ └─────┘        │
└───────────────────────────┘   └───────────────────────────┘
https://okta-ai-agent-demo.onrender.com
```

---

## Deployed Components

| Component | URL | Technology | Status |
|-----------|-----|------------|--------|
| **Frontend** | https://okta-ai-agent-demo.vercel.app | Next.js 14, Tailwind CSS | ✅ Live |
| **Backend API** | https://okta-ai-agent-backend.onrender.com | FastAPI, Claude AI | ✅ Live |
| **MCP Server** | https://okta-ai-agent-demo.onrender.com | FastAPI, Python | ✅ Live |
| **Okta Tenant** | qa-aiagentsproducttc1.trexcloud.com | Okta Identity | ✅ Configured |

---

## Chapter Summary

### C0: Okta Setup

**Purpose:** Configure Okta tenant for AI Agent security demonstration.

**Configuration:**

| Item | Value |
|------|-------|
| Tenant | `qa-aiagentsproducttc1.trexcloud.com` |
| OAuth App (Test_KK) | Client ID: `0oa8x8i98ebUMhrhw0g7` |
| AI Agent (KK Demo Agent UI) | Agent ID: `wlp8x98zcxMOXEPHJ0g7` |
| Auth Server | `default` |
| Scope | `read_data` |
| Private Key (kid) | `0a26ff81-0eb6-43a4-9eb6-1829576211c9` |

---

### C1: MCP Server Build

**Purpose:** Build Model Context Protocol server with tools that AI agents can call.

**Repository:** `okta-ai-agent-demo/mcp-server/`

**Deployed URL:** https://okta-ai-agent-demo.onrender.com

**Tools Implemented:**

| Tool | Description | Risk Level |
|------|-------------|------------|
| `get_customer` | Retrieves customer information with FGA | Low |
| `search_documents` | Searches documents with permission filtering | Low |
| `initiate_payment` | Processes payments with CIBA for high amounts | Medium/High |

**Customer Access Control:**

| Customer | Access Level | Result |
|----------|--------------|--------|
| Alice | Full | All data including sensitive fields |
| Bob | Full | Professional tier customer data |
| Charlie | Denied | Blocked - compliance review |

**Payment Thresholds:**

| Amount | Risk Level | Authorization |
|--------|------------|---------------|
| < $1,000 | Low | Auto-approved |
| $1,001 - $10,000 | Medium | Approved with enhanced logging |
| > $10,000 | High | CIBA required (pending approval) |

**Key Files:**
```
mcp-server/
├── main.py                 # FastAPI entry point
├── tools/
│   ├── customers.py        # get_customer implementation
│   ├── documents.py        # search_documents implementation
│   └── payments.py         # initiate_payment implementation
├── requirements.txt
└── render.yaml             # Render deployment config
```

**Test Endpoints:**
- Health: https://okta-ai-agent-demo.onrender.com/health
- Tools List: https://okta-ai-agent-demo.onrender.com/tools/list
- Swagger Docs: https://okta-ai-agent-demo.onrender.com/docs

---

### C2: Backend API Build

**Purpose:** Integrate Claude AI with MCP Server, handle authentication and orchestration.

**Repository:** `okta-ai-agent-demo/backend-api/`

**Deployed URL:** https://okta-ai-agent-backend.onrender.com

**Key Features:**
- Claude AI integration for natural language processing
- MCP Client for tool execution
- Security flow tracking (token exchange, FGA, CIBA)
- Audit logging for all operations

**API Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with service status |
| `/api/chat` | POST | Main chat endpoint for AI interactions |
| `/api/chat/tools` | GET | List available tools |
| `/api/chat/audit` | GET | Retrieve audit logs |
| `/api/auth/config` | GET | Okta configuration |

**Chat Request/Response:**

```bash
# Request
curl -X POST https://okta-ai-agent-backend.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Get customer information for Alice"}'

# Response Structure
{
  "response": "Customer details...",
  "conversation_id": "conv-abc123",
  "tool_calls": [{
    "tool_name": "get_customer",
    "tool_input": {"name": "Alice"},
    "tool_output": {...},
    "status": "completed",
    "risk_level": "low"
  }],
  "security_flow": {
    "token_exchanged": true,
    "target_audience": "mcp-server",
    "fga_check_result": "ALLOWED",
    "ciba_approval_required": false,
    "ciba_approval_status": null
  },
  "audit_id": "audit-xyz789"
}
```

**Environment Variables:**

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude AI API key |
| `MCP_SERVER_URL` | https://okta-ai-agent-demo.onrender.com |

**Key Files:**
```
backend-api/
├── app/
│   ├── main.py              # FastAPI entry point
│   ├── config.py            # Settings and CORS
│   ├── routers/
│   │   ├── auth.py          # /api/auth/*
│   │   ├── chat.py          # /api/chat
│   │   └── health.py        # /health
│   └── services/
│       ├── claude_service.py
│       ├── mcp_client.py
│       ├── okta_service.py
│       └── audit_service.py
├── requirements.txt
└── render.yaml
```

---

### C3: Frontend Build

**Purpose:** Build executive-level UI for demonstrating AI Agent security.

**Repository:** `okta-ai-agent-demo/frontend/`

**Deployed URL:** https://okta-ai-agent-demo.vercel.app

**Application Name:** Apex Customer 360

**AI Agent Name:** Atlas

**Key Features:**
- Professional dark theme with Okta brand colors
- Animated security architecture diagram
- Real-time security events panel
- Live metrics (Requests, Tokens, Blocked)
- Audit trail view
- 6 pre-configured demo scenarios

**Demo Scenarios:**

| # | Label | Query | Demonstrates |
|---|-------|-------|--------------|
| 1 | Help customer on a call | `Get customer information for Alice` | Full access (FGA allowed) |
| 2 | Process standard refund | `Initiate a payment of $5000 to Bob Smith` | Medium risk, approved with logging |
| 3 | Process large refund | `Initiate a payment of $15000 to Bob Smith` | **CIBA step-up required** |
| 4 | Search product documentation | `Search for documents about security policies` | FGA filtering (no results at access level) |
| 5 | Access restricted record | `Get customer information for Charlie` | **Access denied** (compliance hold) |
| 6 | View partner account | `Get customer information for Bob` | Full access (Professional tier) |

**Architecture Components Shown:**
- Support Rep (Customer Service)
- Customer Service App (Next.js)
- Atlas (AI Agent)
- Okta (Identity / XAA)
- Internal MCP (CRM, Docs, Payments)
- External SaaS (Coming Soon - GitHub, Slack)

**Key Files:**
```
frontend/
├── src/
│   └── app/
│       ├── page.tsx         # Main application
│       ├── layout.tsx       # Root layout
│       └── globals.css      # Styling
├── package.json
├── tailwind.config.js
├── next.config.js
└── vercel.json
```

**Environment Variables:**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_BACKEND_URL` | https://okta-ai-agent-backend.onrender.com |

---

## Security Scenarios

### Scenario 1: Normal Customer Lookup (Alice)

```
User: "Get customer information for Alice"
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Frontend sends message to Backend API                    │
│ 2. Backend sends to Claude AI with available tools          │
│ 3. Claude decides: call get_customer(name="Alice")          │
│ 4. Backend calls MCP Server                                 │
│ 5. MCP Server returns full customer data                    │
│ 6. Claude formats response                                  │
│ 7. Audit log created                                        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
Result: Full customer data (Enterprise tier, $50K credit limit)
Security: Token Exchanged ✓, FGA: ALLOWED ✓
```

### Scenario 2: Restricted Customer (Charlie)

```
User: "Get customer information for Charlie"
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Claude calls get_customer(name="Charlie")                │
│ 2. MCP Server enforces policy: DENIED                       │
│ 3. Returns: "Access denied - compliance review"             │
│ 4. Claude explains denial to user                           │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
Result: Access denied message
Security: Token Exchanged ✓, FGA: DENIED ✗
```

### Scenario 3: High-Value Payment (CIBA)

```
User: "Initiate a payment of $15000 to Bob Smith"
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Claude calls initiate_payment(15000, "Bob Smith")        │
│ 2. MCP Server checks: $15K > $10K threshold                 │
│ 3. Risk level: HIGH                                         │
│ 4. CIBA approval required: YES                              │
│ 5. Returns: pending_approval status                         │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
Result: Payment pending manager approval
Security: Token Exchanged ✓, FGA: ALLOWED ✓, CIBA: PENDING ⏳
```

---

## API Reference

### MCP Server Tools

#### get_customer

```python
# Input
{"name": "Alice"}

# Output (success)
{
  "success": true,
  "customer": {
    "id": "CUST-001",
    "name": "Alice Johnson",
    "email": "alice.johnson@example.com",
    "tier": "Enterprise",
    "credit_limit": 50000,
    ...
  },
  "access_level": "full",
  "policy_decision": "customer:read:full"
}

# Output (denied)
{
  "success": false,
  "customer": null,
  "message": "Access denied - Record under compliance review",
  "access_level": "denied",
  "policy_decision": "customer:read:denied"
}
```

#### initiate_payment

```python
# Input
{"amount": 15000, "recipient": "Bob Smith"}

# Output (CIBA required)
{
  "success": false,
  "transaction_id": "TXN-ABC123",
  "status": "pending_approval",
  "risk_level": "high",
  "requires_approval": true,
  "approval_details": {
    "approval_type": "CIBA",
    "approval_method": "push_notification",
    "approvers": ["finance_manager", "compliance_officer"],
    "timeout_minutes": 30
  },
  "message": "HIGH RISK: Payment requires out-of-band approval"
}
```

#### search_documents

```python
# Input
{"query": "security policies"}

# Output (filtered)
{
  "success": true,
  "documents": [],
  "total_found": 0,
  "filtered_count": 0,
  "user_role": "employee",
  "access_levels": ["public"],
  "message": "No documents found matching query within your access level"
}
```

---

## Local Development

### Prerequisites

- Node.js 18+
- Python 3.11+
- Git

### Clone Repository

```bash
git clone https://github.com/kunkol/okta-ai-agent-demo.git
cd okta-ai-agent-demo
```

### Run MCP Server (C1)

```bash
cd mcp-server
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### Run Backend API (C2)

```bash
cd backend-api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env file
echo "ANTHROPIC_API_KEY=your-key-here" > .env
echo "MCP_SERVER_URL=http://localhost:8001" >> .env

uvicorn app.main:app --reload --port 8000
```

### Run Frontend (C3)

```bash
cd frontend
npm install

# Create .env.local file
echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:8000" > .env.local

npm run dev
```

### Test Commands

```bash
# Test Alice (allowed)
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Get customer information for Alice"}'

# Test Charlie (denied)
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Get customer information for Charlie"}'

# Test $15K payment (CIBA)
curl -s -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Initiate a payment of $15000 to Bob Smith"}'
```

---

## Deployment Guide

### Frontend (Vercel)

1. Import repo at vercel.com
2. Set Root Directory: `frontend`
3. Add env var: `NEXT_PUBLIC_BACKEND_URL=https://okta-ai-agent-backend.onrender.com`
4. Deploy

### Backend API (Render)

1. Create new Web Service at render.com
2. Connect GitHub repo
3. Set Root Directory: `backend-api`
4. Add env vars:
   - `ANTHROPIC_API_KEY`
   - `MCP_SERVER_URL=https://okta-ai-agent-demo.onrender.com`
5. Deploy

### MCP Server (Render)

1. Create new Web Service at render.com
2. Connect GitHub repo
3. Set Root Directory: `mcp-server`
4. Deploy

---

## Security Concepts Demonstrated

| Concept | Description | Demo Scenario |
|---------|-------------|---------------|
| **Cross-App Access (XAA)** | Token exchange between services | All scenarios show "Token Exchanged" |
| **Fine-Grained Authorization (FGA)** | Attribute-based access control | Charlie denied, Document filtering |
| **CIBA** | Out-of-band step-up authentication | $15K payment requires approval |
| **Audit Logging** | Comprehensive activity tracking | Audit Trail tab |

---

## Footer Branding

**Okta for AI Agents** | Securing machine-speed operations at 5,000+ actions/min

Cross-App Access (XAA) | Fine-Grained Authorization (FGA) | Step-Up Auth (CIBA) | Token Vault

---

## Next Steps (C4)

- Wire up real Okta authentication
- Configure XAA token exchange
- Implement FGA policies
- Set up CIBA workflows

---

*Last Updated: December 14, 2024*
