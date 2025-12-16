# Apex Customer 360 - Frontend

AI-powered customer support platform with enterprise security.

## Features

- **Okta SSO Authentication** via NextAuth.js
- **Chat Interface** with Atlas AI assistant
- **Security Panel** showing:
  - ID Token Details (decoded + raw)
  - MCP Flow with ID-JAG Secure Flow visualization
  - System Status indicators
- **Prompt Library** with demo prompts for XAA, FGA, and CIBA scenarios

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- NextAuth.js with Okta Provider

## Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:
- `NEXT_PUBLIC_OKTA_DOMAIN` - Your Okta domain
- `NEXT_PUBLIC_OKTA_CLIENT_ID` - Okta app client ID
- `OKTA_CLIENT_SECRET` - Okta app client secret
- `NEXT_PUBLIC_BACKEND_URL` - Backend API URL
- `NEXTAUTH_SECRET` - Random secret for NextAuth (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL` - Your app URL (http://localhost:3000 for dev)

### 3. Configure Okta Redirect URIs

In Okta Admin Console, add these redirect URIs:

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

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Update `NEXTAUTH_URL` to your Vercel URL
5. Add production redirect URI to Okta

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── api/auth/[...nextauth]/route.ts  # NextAuth API
│   │   ├── globals.css                       # Global styles
│   │   ├── layout.tsx                        # Root layout
│   │   └── page.tsx                          # Main page (login + chat)
│   ├── components/
│   │   ├── Header.tsx                        # App header
│   │   ├── MessageBubble.tsx                 # Chat message component
│   │   ├── IDTokenDetails.tsx                # Token display panel
│   │   ├── MCPFlow.tsx                       # MCP + ID-JAG flow panel
│   │   ├── SystemStatus.tsx                  # Status indicators
│   │   ├── PromptLibrary.tsx                 # Demo prompts modal
│   │   └── SessionProvider.tsx               # NextAuth provider
│   ├── lib/
│   │   ├── api.ts                            # Backend API calls
│   │   └── auth.ts                           # NextAuth config
│   └── types/
│       ├── index.ts                          # App types
│       └── next-auth.d.ts                    # NextAuth type extensions
├── .env.example                              # Environment template
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## UI Design

The UI follows Indranil's Streamward AI Assistant design:
- White/light background
- Clean, minimal, professional styling
- Two-column layout (chat left, security panel right)
- Green status indicators
- Collapsible panels with copy buttons
- ID-JAG Secure Flow with numbered steps (1-4)

## Backend Integration

The frontend calls these backend endpoints:
- `POST /api/chat` - Send chat message
- `GET /api/chat/xaa/status` - Check XAA mode
- `GET /health` - Health check

Headers sent:
- `Authorization: Bearer {accessToken}` - For authentication
- `X-ID-Token: {idToken}` - For XAA token exchange
