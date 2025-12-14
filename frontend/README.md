# Okta AI Agent Frontend (C3)

Next.js frontend for the AI Agent Security Demo, showcasing Okta's Cross-App Access (XAA) and Fine-Grained Authorization capabilities.

## Features

- **Chat Interface**: Real-time AI agent interaction
- **Security Flow Panel**: Live visualization of token exchange, FGA checks, and CIBA approvals
- **Audit Trail**: Complete log of all security decisions
- **Demo Scenarios**: Pre-built scenarios to demonstrate security capabilities

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS with custom Okta theme
- **Animation**: Framer Motion
- **Icons**: Lucide React
- **Deployment**: Vercel

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vercel)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│   │   Chat Panel    │  │  Security Flow   │  │   Audit Trail   │  │
│   │                 │  │     Panel        │  │     Panel       │  │
│   │  - Messages     │  │  - Token Exch    │  │  - Action Log   │  │
│   │  - Input        │  │  - FGA Checks    │  │  - Decisions    │  │
│   │  - Scenarios    │  │  - CIBA Status   │  │  - Timestamps   │  │
│   └─────────────────┘  └──────────────────┘  └─────────────────┘  │
│                                                                     │
│                              │                                      │
│                              ▼                                      │
│                    Backend API (Render)                             │
│                              │                                      │
│                              ▼                                      │
│                    MCP Server (Render)                              │
│                              │                                      │
│                              ▼                                      │
│                         Okta (Cloud)                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Demo Scenarios

| Scenario | Description | Expected Result |
|----------|-------------|-----------------|
| **Alice (Allowed)** | Get customer info for Alice | ✅ Authorized |
| **Charlie (Denied)** | Get customer info for Charlie | ❌ Denied |
| **$5K Payment** | Small payment under threshold | ✅ Auto-approved |
| **$15K Payment** | Large payment requires CIBA | ⏳ CIBA approval |
| **Doc Search** | Search documents | ✅ Filtered by permissions |

## Local Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Backend API running (see C2)

### Setup

1. Clone and navigate to frontend:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env.local
   ```

4. Update `.env.local` with your backend URL:
   ```
   NEXT_PUBLIC_BACKEND_URL=https://okta-ai-agent-backend.onrender.com
   ```

5. Run development server:
   ```bash
   npm run dev
   ```

6. Open http://localhost:3000

## Deployment to Vercel

### Option 1: Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Set environment variable in Vercel dashboard:
   - `NEXT_PUBLIC_BACKEND_URL`: Your Render backend URL

### Option 2: GitHub Integration

1. Push to GitHub
2. Import project in Vercel dashboard
3. Set environment variables
4. Deploy

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Root layout
│   │   ├── page.tsx        # Main page with chat/security
│   │   └── globals.css     # Global styles
│   ├── components/         # Reusable components (future)
│   └── lib/               # Utilities (future)
├── public/                # Static assets
├── package.json
├── tailwind.config.js     # Tailwind with Okta theme
├── tsconfig.json
└── next.config.js
```

## Connected Services

| Service | URL | Purpose |
|---------|-----|---------|
| Backend API | https://okta-ai-agent-backend.onrender.com | Claude AI + Security |
| MCP Server | https://okta-ai-agent-demo.onrender.com | Tools (CRM, Docs, Payments) |
| Okta | qa-aiagentsproducttc1.trexcloud.com | Identity & Auth |

## Troubleshooting

### Backend Connection Issues

If you see "Backend Offline":

1. Wake up Render services (free tier sleeps):
   ```bash
   curl https://okta-ai-agent-demo.onrender.com/
   curl https://okta-ai-agent-backend.onrender.com/
   ```

2. Wait 10-20 seconds

3. Refresh the page

### CORS Issues

The backend is configured to allow all origins. If you still see CORS errors:

1. Check browser console for specific error
2. Verify `NEXT_PUBLIC_BACKEND_URL` is correct
3. Ensure backend is running

## Related Chapters

- [C0: Okta Setup](https://claude.ai/chat/c9aff738-4356-4d5e-a1d2-b66351231d33)
- [C1: MCP Server](https://claude.ai/chat/a445f157-26f8-4fc2-86cf-048aa0e83500)
- [C2: Backend API](https://claude.ai/chat/0919a354-2230-4312-a220-e8b8659dc3e3)
- **C3: Frontend** (This project)
- [C4: Okta Security](https://claude.ai/chat/0b427b63-a708-4641-9d84-0b92e01e9c6b)

## License

MIT
