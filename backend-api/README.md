# Okta AI Agent Demo - Backend API (C2)

Backend API service that integrates Claude AI with the MCP Server for the Okta AI Agent Security Demo.

## Project Structure

This is **Chapter 2 (C2)** of the 4-part demo:

| Chapter | Description | Status |
|---------|-------------|--------|
| C0 | Initial Outline / Okta Setup | ✅ Complete |
| C1 | MCP Server Build | ✅ Deployed |
| **C2** | Backend API Build | **This project** |
| C3 | Frontend Build | Next |
| C4 | Okta Security Config | Final |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND API (C2)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🤖 CLAUDE AI INTEGRATION                                       │
│  ├── /api/chat          → Process messages with Claude         │
│  └── Tool orchestration → Claude decides which tools to call   │
│                                                                 │
│  🔐 OKTA AUTH LAYER                                             │
│  ├── /api/auth/config   → Get Okta config for frontend         │
│  ├── /api/auth/callback → OAuth code exchange                  │
│  ├── /api/auth/me       → Get current user info                │
│  └── Token exchange     → Cross-App Access (ID-JAG)            │
│                                                                 │
│  🔗 MCP SERVER CONNECTOR (C1)                                   │
│  └── Calls tools: get_customer, search_documents, payment      │
│                                                                 │
│  📝 AUDIT LOGGING                                               │
│  └── Complete audit trail of all operations                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Clone and Setup

```bash
cd backend-api
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values
```

Required environment variables:
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `OKTA_CLIENT_SECRET` - Your Okta OAuth app client secret

### 3. Run Locally

```bash
uvicorn app.main:app --reload --port 8000
```

API will be available at: http://localhost:8000

### 4. Test the API

```bash
# Health check
curl http://localhost:8000/health

# Get available tools
curl http://localhost:8000/api/chat/tools

# Send a chat message (no auth)
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Get customer information for Alice Johnson"}'
```

## API Endpoints

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Overall health check |
| GET | `/health/mcp` | MCP Server health |
| GET | `/health/okta` | Okta connectivity |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message to Claude |
| POST | `/api/chat/authenticated` | Send message (requires auth) |
| GET | `/api/chat/tools` | List available MCP tools |
| POST | `/api/chat/tools/call` | Call tool directly |
| GET | `/api/chat/audit` | Get audit log |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/config` | Get Okta config |
| GET | `/api/auth/login` | Generate login URL |
| POST | `/api/auth/callback` | Exchange code for tokens |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/token/exchange` | Token exchange (ID-JAG) |

## Chat Response Structure

```json
{
  "response": "Claude's response text",
  "conversation_id": "conv-abc123",
  "tool_calls": [
    {
      "tool_name": "get_customer",
      "tool_input": {"name": "Alice Johnson"},
      "status": "completed",
      "risk_level": "low"
    }
  ],
  "security_flow": {
    "token_exchanged": true,
    "target_audience": "mcp-server",
    "fga_check_result": "ALLOWED",
    "ciba_approval_required": false
  },
  "audit_id": "audit-xyz789"
}
```

## Deployment to Render

### Option 1: Manual Deploy

1. Create new Web Service on Render
2. Connect your GitHub repo
3. Set root directory to `backend-api`
4. Set build command: `pip install -r requirements.txt`
5. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables in Render dashboard

### Option 2: Blueprint Deploy

Use the included `render.yaml`:

1. Go to Render Dashboard
2. New > Blueprint
3. Connect repo and select `render.yaml`
4. Add secret environment variables manually

## Connected Services

### MCP Server (C1)
- URL: https://okta-ai-agent-demo.onrender.com
- Tools: `get_customer`, `search_documents`, `initiate_payment`

### Okta (C0)
- Tenant: `qa-aiagentsproducttc1.trexcloud.com`
- OAuth App: `0oa8x8i98ebUMhrhw0g7`
- Agent ID: `wlp8x98zcxMOXEPHJ0g7`

## Security Features

### Token Exchange (ID-JAG)
The API supports RFC 8693 token exchange for Cross-App Access:
- Agent exchanges user's token for MCP Server access
- Maintains delegation chain for audit
- Supports constrained scopes

### Audit Logging
Every operation is logged:
- Tool calls with input/output
- Token exchanges
- Access decisions
- Security context

### Risk Levels
Tools are classified by risk:
- **Low**: `get_customer`, `search_documents`
- **High**: `initiate_payment` (requires approval > $10K)

## Development

### Project Structure

```
backend-api/
├── app/
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Settings and configuration
│   ├── routers/
│   │   ├── auth.py          # Authentication endpoints
│   │   ├── chat.py          # Chat endpoints
│   │   └── health.py        # Health checks
│   ├── services/
│   │   ├── claude_service.py    # Claude AI integration
│   │   ├── mcp_client.py        # MCP Server connector
│   │   ├── okta_service.py      # Okta authentication
│   │   └── audit_service.py     # Audit logging
│   └── models/
│       └── schemas.py       # Pydantic models
├── requirements.txt
├── render.yaml
└── README.md
```

### Running Tests

```bash
pytest tests/ -v
```

## Next Steps

After deploying the Backend API:

1. **C3 (Frontend)**: Build the Next.js UI that calls this API
2. **C4 (Okta Config)**: Configure Cross-App Access policies

## Related Chats

- C0: Initial Outline / Okta Setup
- C1: MCP Server Build
- C3: Frontend Build
- C4: Okta Security Config
