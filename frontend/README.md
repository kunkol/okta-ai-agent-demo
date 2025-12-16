# Apex Customer 360 - Frontend

AI-powered customer support platform with enterprise Okta security.

## Features

- **Okta SSO Authentication** via NextAuth.js
- **Real-time XAA Flow** visualization with animated steps
- **Security Panels** showing ID tokens, MCP flow, and FGA results
- **Audit Trail** logging all security decisions
- **Prompt Library** with XAA, FGA, and CIBA demo scenarios
- **Dark Executive Theme** with Okta brand colors

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your values:

```env
# Okta (from C0 config)
OKTA_CLIENT_ID=0oa8xatd11PBe622F0g7
OKTA_CLIENT_SECRET=your_secret_here
OKTA_ISSUER=https://qa-aiagentsproducttc1.trexcloud.com/oauth2/default

# NextAuth
NEXTAUTH_SECRET=your_secret_here  # Generate: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# Backend
NEXT_PUBLIC_BACKEND_URL=https://okta-ai-agent-backend.onrender.com
```

### 3. Configure Okta Redirect URIs

In Okta Admin Console, add:

**Development:**
- `http://localhost:3000/api/auth/callback/okta`

**Production:**
- `https://your-app.vercel.app/api/auth/callback/okta`

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables in Vercel dashboard
4. Update `NEXTAUTH_URL` to your Vercel URL
5. Add production redirect URI to Okta

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── api/auth/[...nextauth]/route.ts  # NextAuth API
│   │   ├── globals.css                       # Dark theme styles
│   │   ├── layout.tsx                        # Root layout
│   │   └── page.tsx                          # Main app (login + chat)
│   ├── components/
│   │   ├── PromptLibrary.tsx                 # Demo prompts modal
│   │   └── SessionProvider.tsx               # NextAuth provider
│   ├── lib/
│   │   ├── api.ts                            # Backend API calls
│   │   └── auth.ts                           # NextAuth config
│   └── types/
│       ├── index.ts                          # App types
│       └── next-auth.d.ts                    # NextAuth extensions
├── .env.example
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## Security Features

| Feature | Description |
|---------|-------------|
| **XAA** | Cross-App Access with ID-JAG token exchange |
| **FGA** | Fine-Grained Authorization checks |
| **CIBA** | Step-up auth for high-value transactions |

## Demo Scenarios

1. **Alice/Bob Lookup** - Full XAA flow with token exchange
2. **Charlie Lookup** - FGA blocks unauthorized access
3. **$5K Payment** - Normal payment processing
4. **$15K Payment** - CIBA step-up authentication triggered
