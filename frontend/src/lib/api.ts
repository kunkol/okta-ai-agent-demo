// lib/api.ts

import { ChatResponse } from '@/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://okta-ai-agent-backend.onrender.com';

export async function sendChatMessage(
  message: string,
  accessToken?: string,
  idToken?: string
): Promise<ChatResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  if (idToken) {
    headers['X-ID-Token'] = idToken;
  }

  const response = await fetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    response: data.response,
    mcp_info: data.mcp_info,
    security_flow: data.security_flow,
  };
}

export async function checkXAAStatus(): Promise<{ mode: string }> {
  const response = await fetch(`${BACKEND_URL}/api/chat/xaa/status`);
  if (!response.ok) {
    return { mode: 'unknown' };
  }
  return response.json();
}

export async function checkHealth(): Promise<{ status: string }> {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    if (!response.ok) {
      return { status: 'unhealthy' };
    }
    return response.json();
  } catch {
    return { status: 'offline' };
  }
}

export function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}
