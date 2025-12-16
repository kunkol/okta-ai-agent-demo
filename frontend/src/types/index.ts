// types/index.ts

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  mcpInfo?: MCPInfo;
  securityFlow?: SecurityFlow;
}

export interface MCPInfo {
  server: string;
  tools_called: string[];
  id_jag_token?: string;
  mcp_access_token?: string;
  expires_in?: number;
  scope?: string;
  query?: string;
}

export interface SecurityFlow {
  xaa?: {
    status: 'success' | 'error' | 'pending';
    steps: SecurityStep[];
  };
  fga?: {
    status: 'success' | 'error' | 'not_checked';
    checks: FGACheck[];
  };
  ciba?: {
    status: 'not_triggered' | 'pending' | 'approved' | 'denied' | 'timeout';
    reason?: string;
  };
}

export interface SecurityStep {
  step: number;
  name: string;
  description: string;
  status: 'success' | 'error' | 'pending' | 'active';
  timestamp?: string;
}

export interface FGACheck {
  query: string;
  allowed: boolean;
  reason?: string;
}

export interface DecodedToken {
  sub?: string;
  name?: string;
  email?: string;
  ver?: number;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export interface PromptItem {
  title: string;
  prompt: string;
  description: string;
}

export interface PromptCategory {
  category: string;
  prompts: PromptItem[];
}

export interface ChatResponse {
  response: string;
  mcp_info?: MCPInfo;
  security_flow?: SecurityFlow;
}
