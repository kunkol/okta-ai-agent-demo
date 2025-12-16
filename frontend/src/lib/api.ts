const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://okta-ai-agent-backend.onrender.com';

export interface ChatRequest {
  message: string;
  user_id?: string;
}

export interface ChatResponse {
  response: string;
  security_context?: {
    mcp_server?: string;
    tools_called?: string[];
    id_jag_token?: string;
    mcp_access_token?: string;
    expires_in?: number;
    scope?: string;
    xaa_steps?: Array<{
      step: number;
      name: string;
      description: string;
      status: string;
      timestamp?: string;
      duration_ms?: number;
    }>;
    fga_result?: {
      allowed: boolean;
      user: string;
      relation: string;
      object: string;
      reason?: string;
    };
    ciba_status?: {
      triggered: boolean;
      status: string;
      reason?: string;
      amount?: number;
    };
  };
}

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

export async function sendChatMessage(
  message: string,
  idToken?: string,
  userId?: string
): Promise<ChatResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
    headers['X-ID-Token'] = idToken;
  }

  const response = await fetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      user_id: userId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`);
  }

  return response.json();
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${BACKEND_URL}/health`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`);
  }

  return response.json();
}

export async function getXAAStatus(): Promise<{ enabled: boolean; mode: string }> {
  const response = await fetch(`${BACKEND_URL}/api/chat/xaa/status`, {
    method: 'GET',
  });

  if (!response.ok) {
    return { enabled: false, mode: 'simulated' };
  }

  return response.json();
}
