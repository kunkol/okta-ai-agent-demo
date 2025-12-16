export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  securityContext?: SecurityContext;
}

export interface SecurityContext {
  mcp_server?: string;
  tools_called?: string[];
  id_jag_token?: string;
  mcp_access_token?: string;
  expires_in?: number;
  scope?: string;
  xaa_steps?: XAAStep[];
  fga_result?: FGAResult;
  ciba_status?: CIBAStatus;
}

export interface XAAStep {
  step: number;
  name: string;
  description: string;
  status: 'pending' | 'active' | 'success' | 'error';
  timestamp?: string;
  duration_ms?: number;
}

export interface FGAResult {
  allowed: boolean;
  user: string;
  relation: string;
  object: string;
  reason?: string;
}

export interface CIBAStatus {
  triggered: boolean;
  status: 'not_triggered' | 'pending' | 'approved' | 'denied' | 'timeout';
  reason?: string;
  amount?: number;
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: string;
  user: string;
  resource: string;
  result: 'allowed' | 'denied' | 'pending';
  details?: string;
}

export interface DecodedToken {
  sub?: string;
  email?: string;
  name?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  aud?: string | string[];
  [key: string]: unknown;
}
