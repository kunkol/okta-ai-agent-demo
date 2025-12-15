'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  securityContext?: SecurityContext;
}

interface SecurityContext {
  tokenExchange: boolean;
  targetAudience: string;
  fgaCheck: string;
  cibaRequired: boolean;
  cibaStatus: string | null;
  toolsExecuted: string[];
  riskLevel: string;
}

interface SecurityStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'warning';
  detail: string;
  timestamp: Date;
}

interface AuditEntry {
  id: string;
  timestamp: Date;
  action: string;
  user: string;
  resource: string;
  decision: 'allowed' | 'denied' | 'pending';
  riskLevel: string;
  auditId: string;
}

interface Metrics {
  requestsSecured: number;
  tokensExchanged: number;
  threatsBlocked: number;
  cibaApprovals: number;
}

// SVG Icons
const IconShield = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const IconLock = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const IconKey = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
  </svg>
);

const IconCheck = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const IconX = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconAlert = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const IconUser = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const IconCpu = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
  </svg>
);

const IconActivity = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

const IconSend = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
  </svg>
);

const IconRefresh = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const IconDatabase = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
  </svg>
);

const IconCloud = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
  </svg>
);

// Demo scenarios
const DEMO_SCENARIOS = [
  { 
    label: 'Help customer on a call', 
    description: 'Pull up account, contract, and payment history',
    query: 'Get customer information for Alice', 
    risk: 'low' 
  },
  { 
    label: 'Process standard refund', 
    description: '$5,000 - approved with enhanced monitoring',
    query: 'Initiate a payment of $5000 to Bob Smith', 
    risk: 'medium' 
  },
  { 
    label: 'Process large refund', 
    description: '$15,000 - requires manager approval (CIBA)',
    query: 'Initiate a payment of $15000 to Bob Smith', 
    risk: 'critical' 
  },
  { 
    label: 'Search product documentation', 
    description: 'Results filtered by access level',
    query: 'Search for documents about security policies', 
    risk: 'low' 
  },
  { 
    label: 'Access restricted record', 
    description: 'Account under compliance review',
    query: 'Get customer information for Charlie', 
    risk: 'high' 
  },
  { 
    label: 'View partner account', 
    description: 'Full access - Professional tier customer',
    query: 'Get customer information for Bob', 
    risk: 'low' 
  },
];

// Architecture Node Component
const ArchNode = ({ 
  label, 
  sublabel, 
  status,
  size = 'normal',
  disabled = false,
}: { 
  label: string; 
  sublabel: string; 
  status: 'idle' | 'processing' | 'success' | 'error';
  size?: 'small' | 'normal';
  disabled?: boolean;
}) => {
  const statusColors = {
    idle: disabled ? 'border-white/5 bg-[#14141c]/50' : 'border-white/10 bg-[#14141c]',
    processing: 'border-[#007DC1]/50 bg-[#007DC1]/10',
    success: 'border-emerald-500/50 bg-emerald-500/10',
    error: 'border-red-500/50 bg-red-500/10',
  };

  const glowColors = {
    idle: '',
    processing: 'shadow-[0_0_30px_rgba(0,125,193,0.4)]',
    success: 'shadow-[0_0_30px_rgba(16,185,129,0.4)]',
    error: 'shadow-[0_0_30px_rgba(239,68,68,0.4)]',
  };

  const sizeClasses = size === 'small' ? 'px-2 py-1' : 'px-4 py-2';

  return (
    <motion.div
      className={`relative ${sizeClasses} rounded-lg border transition-all duration-500 ${statusColors[status]} ${glowColors[status]} ${disabled ? 'opacity-40' : ''}`}
      animate={status === 'processing' ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 0.8, repeat: status === 'processing' ? Infinity : 0 }}
    >
      <div className="text-center">
        <p className={`font-medium text-white ${size === 'small' ? 'text-[10px]' : 'text-xs'}`}>{label}</p>
        <p className={`text-gray-500 ${size === 'small' ? 'text-[8px]' : 'text-[10px]'}`}>{sublabel}</p>
      </div>
      {status === 'success' && !disabled && (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center"
        >
          <IconCheck className="w-2 h-2 text-white" />
        </motion.div>
      )}
      {status === 'error' && !disabled && (
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 flex items-center justify-center"
        >
          <IconX className="w-2 h-2 text-white" />
        </motion.div>
      )}
    </motion.div>
  );
};

// Connection Line
const ConnLine = ({ 
  active, 
  direction = 'down',
  status = 'idle'
}: { 
  active: boolean; 
  direction?: 'down' | 'right';
  status?: 'idle' | 'processing' | 'success' | 'error';
}) => {
  const colors = {
    idle: 'from-white/5 via-white/10 to-white/5',
    processing: 'from-[#007DC1]/30 via-[#007DC1]/80 to-[#007DC1]/30',
    success: 'from-emerald-500/30 via-emerald-500/80 to-emerald-500/30',
    error: 'from-red-500/30 via-red-500/80 to-red-500/30',
  };

  if (direction === 'down') {
    return (
      <div className="flex justify-center py-0.5">
        <div className={`w-px h-4 bg-gradient-to-b ${colors[status]} relative overflow-hidden`}>
          {active && (
            <motion.div
              className="absolute w-full h-2 bg-gradient-to-b from-transparent via-white/80 to-transparent"
              animate={{ top: ['-8px', '16px'] }}
              transition={{ duration: 0.4, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center px-0.5">
      <div className={`h-px w-4 bg-gradient-to-r ${colors[status]} relative overflow-hidden`}>
        {active && (
          <motion.div
            className="absolute h-full w-2 bg-gradient-to-r from-transparent via-white/80 to-transparent"
            animate={{ left: ['-8px', '16px'] }}
            transition={{ duration: 0.3, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </div>
    </div>
  );
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [securitySteps, setSecuritySteps] = useState<SecurityStep[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'audit'>('chat');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'healthy' | 'degraded' | 'error'>('checking');
  const [metrics, setMetrics] = useState<Metrics>({ requestsSecured: 0, tokensExchanged: 0, threatsBlocked: 0, cibaApprovals: 0 });
  const [archState, setArchState] = useState({ 
    user: 'idle', 
    app: 'idle', 
    agent: 'idle', 
    okta: 'idle', 
    mcp: 'idle',
    external: 'idle'
  } as Record<string, 'idle' | 'processing' | 'success' | 'error'>);
  const [flowActive, setFlowActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://okta-ai-agent-backend.onrender.com';

  useEffect(() => {
    checkBackendHealth();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkBackendHealth = async () => {
    setBackendStatus('checking');
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      const data = await response.json();
      setBackendStatus(data.status === 'healthy' ? 'healthy' : 'degraded');
    } catch {
      setBackendStatus('error');
    }
  };

  const addSecurityStep = (step: Omit<SecurityStep, 'id' | 'timestamp'>) => {
    const newStep: SecurityStep = {
      ...step,
      id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setSecuritySteps(prev => [...prev, newStep]);
    return newStep.id;
  };

  const updateSecurityStep = (id: string, updates: Partial<SecurityStep>) => {
    setSecuritySteps(prev => 
      prev.map(step => step.id === id ? { ...step, ...updates } : step)
    );
  };

  const animateArchitecture = async (success: boolean) => {
    setFlowActive(true);
    
    // User initiates
    setArchState(s => ({ ...s, user: 'processing' }));
    await new Promise(r => setTimeout(r, 200));
    
    // App receives
    setArchState(s => ({ ...s, user: 'success', app: 'processing' }));
    await new Promise(r => setTimeout(r, 300));
    
    // Agent processes
    setArchState(s => ({ ...s, app: 'success', agent: 'processing' }));
    await new Promise(r => setTimeout(r, 400));
    
    // Okta auth
    setArchState(s => ({ ...s, okta: 'processing' }));
    await new Promise(r => setTimeout(r, 400));
    setArchState(s => ({ ...s, okta: 'success' }));
    
    // MCP call
    setArchState(s => ({ ...s, agent: 'success', mcp: 'processing' }));
    await new Promise(r => setTimeout(r, 400));
    
    // Final state
    setArchState(s => ({ ...s, mcp: success ? 'success' : 'error' }));
    await new Promise(r => setTimeout(r, 500));
    
    setFlowActive(false);
    setTimeout(() => {
      setArchState({ user: 'idle', app: 'idle', agent: 'idle', okta: 'idle', mcp: 'idle', external: 'idle' });
    }, 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);
    setSecuritySteps([]);

    const tokenStepId = addSecurityStep({
      name: 'Token Exchange (XAA)',
      status: 'running',
      detail: 'Initiating Cross-App Access token exchange',
    });

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });

      const data = await response.json();
      const fgaResult = data.security_flow?.fga_check_result || 'ALLOWED';
      const isSuccess = fgaResult === 'ALLOWED';
      const hasCiba = data.security_flow?.ciba_approval_required || false;

      // Check if access was actually denied in the response
      const responseText = data.response?.toLowerCase() || '';
      const wasActuallyDenied = responseText.includes('denied') || 
                                responseText.includes('unable to retrieve') ||
                                responseText.includes('access is denied') ||
                                responseText.includes('don\'t have permission');
      
      const finalSuccess = isSuccess && !wasActuallyDenied;

      animateArchitecture(finalSuccess);

      setMetrics(m => ({
        requestsSecured: m.requestsSecured + 1,
        tokensExchanged: m.tokensExchanged + 1,
        threatsBlocked: m.threatsBlocked + (finalSuccess ? 0 : 1),
        cibaApprovals: m.cibaApprovals + (hasCiba ? 1 : 0),
      }));

      updateSecurityStep(tokenStepId, { 
        status: 'success', 
        detail: `Audience: ${data.security_flow?.target_audience || 'mcp-server'}` 
      });

      addSecurityStep({
        name: 'Policy Evaluation (FGA)',
        status: finalSuccess ? 'success' : 'error',
        detail: finalSuccess ? 'Access Granted' : 'Access Denied',
      });

      if (data.tool_executions) {
        data.tool_executions.forEach((tool: any) => {
          const toolDenied = tool.status === 'denied' || 
                            (tool.result?.access_level === 'denied');
          addSecurityStep({
            name: `Tool: ${tool.name}`,
            status: toolDenied ? 'error' : 
                   tool.status === 'completed' ? 'success' : 'warning',
            detail: toolDenied ? 'Access Denied' : `Risk: ${tool.risk_level?.toUpperCase() || 'LOW'}`,
          });
        });
      }

      if (hasCiba) {
        addSecurityStep({
          name: 'Step-Up Auth (CIBA)',
          status: data.security_flow.ciba_approval_status === 'approved' ? 'success' : 'warning',
          detail: `Status: ${data.security_flow.ciba_approval_status || 'Pending Approval'}`,
        });
      }

      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        securityContext: {
          tokenExchange: data.security_flow?.token_exchanged || false,
          targetAudience: data.security_flow?.target_audience || 'mcp-server',
          fgaCheck: finalSuccess ? 'ALLOWED' : 'DENIED',
          cibaRequired: hasCiba,
          cibaStatus: data.security_flow?.ciba_approval_status,
          toolsExecuted: data.tool_executions?.map((t: any) => t.name) || [],
          riskLevel: data.tool_executions?.[0]?.risk_level || 'low',
        },
      };

      setMessages(prev => [...prev, assistantMessage]);

      setAuditLog(prev => [{
        id: `audit-${Date.now()}`,
        timestamp: new Date(),
        action: input,
        user: 'demo-user',
        resource: data.tool_executions?.[0]?.name || 'chat',
        decision: finalSuccess ? 'allowed' : 'denied',
        riskLevel: data.tool_executions?.[0]?.risk_level || 'low',
        auditId: data.audit_id || 'N/A',
      }, ...prev]);

    } catch {
      updateSecurityStep(tokenStepId, { 
        status: 'error', 
        detail: 'Connection failed' 
      });

      setArchState({ user: 'error', app: 'error', agent: 'idle', okta: 'idle', mcp: 'idle', external: 'idle' });

      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Unable to connect to the backend service. Please ensure the services are running.',
        timestamp: new Date(),
      }]);
    }

    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#08080c]">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#00297A] via-[#007DC1] to-[#00D4AA] flex items-center justify-center">
                <IconShield className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-[#00D4AA]/20 to-[#007DC1]/20 blur-lg -z-10" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white tracking-tight">
                Apex Customer 360
              </h1>
              <p className="text-xs text-gray-500 tracking-wide">Enterprise Customer Intelligence Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Live Metrics */}
            <div className="hidden lg:flex items-center gap-6 pr-6 border-r border-white/5">
              <div className="text-center">
                <p className="text-2xl font-semibold text-white tabular-nums">{metrics.requestsSecured}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Requests</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-[#00D4AA] tabular-nums">{metrics.tokensExchanged}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Tokens</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold text-red-400 tabular-nums">{metrics.threatsBlocked}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Blocked</p>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#14141c] border border-white/5">
                <div className={`w-2 h-2 rounded-full ${
                  backendStatus === 'healthy' ? 'bg-emerald-400' :
                  backendStatus === 'degraded' ? 'bg-amber-400' :
                  backendStatus === 'error' ? 'bg-red-400' : 'bg-gray-400 animate-pulse'
                }`} />
                <span className="text-xs text-gray-400">
                  {backendStatus === 'healthy' ? 'All Systems Operational' :
                   backendStatus === 'degraded' ? 'Degraded Performance' :
                   backendStatus === 'error' ? 'Service Unavailable' : 'Connecting'}
                </span>
              </div>
              <button 
                onClick={checkBackendHealth}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                title="Refresh Status"
              >
                <IconRefresh className={`w-4 h-4 text-gray-500 ${backendStatus === 'checking' ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex">
        <div className="flex-1 max-w-[1800px] mx-auto w-full flex">
          
          {/* Left Panel - Chat */}
          <div className="flex-1 flex flex-col border-r border-white/5 min-w-0">
            {/* Tabs */}
            <div className="border-b border-white/5 px-6">
              <div className="flex justify-between items-center">
                <div className="flex gap-1">
                  {[
                    { id: 'chat', label: 'Agent Console' },
                    { id: 'audit', label: 'Audit Trail', count: auditLog.length },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as 'chat' | 'audit')}
                      className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-all ${
                        activeTab === tab.id
                          ? 'border-[#00D4AA] text-white'
                          : 'border-transparent text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {tab.label}
                      {tab.count !== undefined && tab.count > 0 && (
                        <span className="ml-2 px-2 py-0.5 text-[10px] rounded-full bg-[#00D4AA]/10 text-[#00D4AA]">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {messages.length > 0 && (
                  <button
                    onClick={() => {
                      setMessages([]);
                      setSecuritySteps([]);
                      setAuditLog([]);
                      setActiveTab('chat');
                      setMetrics({ requestsSecured: 0, tokensExchanged: 0, threatsBlocked: 0, cibaApprovals: 0 });
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                  >
                    New Session
                  </button>
                )}
              </div>
            </div>

            {activeTab === 'chat' ? (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="w-14 h-14 mb-4 rounded-xl bg-gradient-to-br from-[#00297A]/20 via-[#007DC1]/20 to-[#00D4AA]/20 border border-white/5 flex items-center justify-center">
                        <IconCpu className="w-7 h-7 text-[#00D4AA]/60" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-1">
                        AI-Powered Customer Intelligence
                      </h3>
                      <p className="text-gray-500 text-sm max-w-md text-center mb-5">
                        Select a customer service task to see Atlas assist your support team.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl">
                        {DEMO_SCENARIOS.map((scenario, index) => (
                          <button
                            key={index}
                            onClick={() => setInput(scenario.query)}
                            className={`group px-4 py-3 text-left rounded-xl border transition-all ${
                              scenario.risk === 'critical' ? 'border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5' :
                              scenario.risk === 'high' ? 'border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/5' :
                              scenario.risk === 'medium' ? 'border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/5' :
                              'border-white/5 hover:border-white/10 hover:bg-white/5'
                            }`}
                          >
                            <p className="text-sm text-white font-medium mb-1">{scenario.label}</p>
                            <p className="text-[11px] text-gray-400 mb-1">{scenario.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <AnimatePresence>
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] ${
                          message.role === 'user'
                            ? 'bg-gradient-to-r from-[#007DC1] to-[#00D4AA] text-white rounded-2xl rounded-br-sm'
                            : 'bg-[#12121a] border border-white/5 rounded-2xl rounded-bl-sm'
                        } px-5 py-4`}>
                          {message.role === 'assistant' && (
                            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
                              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#007DC1] to-[#00D4AA] flex items-center justify-center">
                                <IconCpu className="w-3.5 h-3.5 text-white" />
                              </div>
                              <span className="text-xs text-gray-400 font-medium">Atlas</span>
                            </div>
                          )}
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                          
                          {message.securityContext && (
                            <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-2">
                              {message.securityContext.tokenExchange && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <IconKey className="w-3 h-3" />
                                  Token Exchanged
                                </span>
                              )}
                              {message.securityContext.fgaCheck === 'ALLOWED' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <IconCheck className="w-3 h-3" />
                                  Authorized
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                  <IconX className="w-3 h-3" />
                                  Access Denied
                                </span>
                              )}
                              {message.securityContext.cibaRequired && (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${
                                  message.securityContext.cibaStatus === 'approved' 
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                  <IconLock className="w-3 h-3" />
                                  CIBA {message.securityContext.cibaStatus}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {isProcessing && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-[#12121a] border border-white/5 rounded-2xl rounded-bl-sm px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            {[0, 1, 2].map(i => (
                              <motion.span
                                key={i}
                                className="w-2 h-2 bg-[#00D4AA] rounded-full"
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-gray-500">Processing securely...</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-5 border-t border-white/5">
                  <form onSubmit={handleSubmit} className="flex gap-3">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Enter a command or select a scenario above"
                      className="flex-1 bg-[#12121a] border border-white/10 rounded-xl px-5 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00D4AA]/50 focus:ring-1 focus:ring-[#00D4AA]/20 transition-all"
                      disabled={isProcessing}
                    />
                    <button
                      type="submit"
                      disabled={isProcessing || !input.trim()}
                      className="px-6 py-3.5 bg-gradient-to-r from-[#007DC1] to-[#00D4AA] text-white font-medium rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <IconSend className="w-4 h-4" />
                      Execute
                    </button>
                  </form>
                </div>
              </>
            ) : (
              /* Audit Trail */
              <div className="flex-1 overflow-y-auto p-6">
                {auditLog.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center">
                    <IconActivity className="w-12 h-12 text-gray-700 mb-4" />
                    <p className="text-gray-500">No audit entries recorded</p>
                    <p className="text-gray-600 text-sm">Execute a scenario to generate audit logs</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditLog.map((entry, index) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-[#12121a] border border-white/5 rounded-xl p-5"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              entry.decision === 'allowed' ? 'bg-emerald-500/10' :
                              entry.decision === 'denied' ? 'bg-red-500/10' : 'bg-amber-500/10'
                            }`}>
                              {entry.decision === 'allowed' ? (
                                <IconCheck className="w-4 h-4 text-emerald-400" />
                              ) : entry.decision === 'denied' ? (
                                <IconX className="w-4 h-4 text-red-400" />
                              ) : (
                                <IconAlert className="w-4 h-4 text-amber-400" />
                              )}
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${
                                entry.decision === 'allowed' ? 'text-emerald-400' :
                                entry.decision === 'denied' ? 'text-red-400' : 'text-amber-400'
                              }`}>
                                {entry.decision.toUpperCase()}
                              </p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                                Risk: {entry.riskLevel}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs text-gray-600 font-mono">
                            {entry.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 mb-2 line-clamp-2">{entry.action}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <span>User: {entry.user}</span>
                          <span>Resource: {entry.resource}</span>
                          <span className="font-mono">{entry.auditId}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel - Architecture & Security Flow */}
          <div className="w-[420px] flex flex-col bg-[#0a0a0f]">
            {/* Architecture Diagram */}
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center gap-2 mb-4">
                <IconDatabase className="w-4 h-4 text-[#00D4AA]" />
                <h2 className="text-sm font-semibold text-white">Security Architecture</h2>
              </div>
              
              <div className="space-y-0">
                {/* User */}
                <div className="flex justify-center">
                  <ArchNode label="Support Rep" sublabel="Customer Service" status={archState.user as any} />
                </div>
                
                <ConnLine active={flowActive} direction="down" status={archState.user as any} />
                
                {/* Customer Service App */}
                <div className="flex justify-center">
                  <ArchNode label="Customer Service App" sublabel="Next.js" status={archState.app as any} />
                </div>
                
                <ConnLine active={flowActive} direction="down" status={archState.app as any} />
                
                {/* Atlas AI Agent */}
                <div className="flex justify-center">
                  <ArchNode label="Atlas" sublabel="AI Agent" status={archState.agent as any} />
                </div>
                
                <ConnLine active={flowActive} direction="down" status={archState.agent as any} />
                
                {/* Okta */}
                <div className="flex justify-center">
                  <ArchNode label="Okta" sublabel="Identity / XAA" status={archState.okta as any} />
                </div>
                
                <ConnLine active={flowActive} direction="down" status={archState.okta as any} />
                
                {/* MCP Servers Row */}
                <div className="flex justify-center gap-3">
                  {/* Internal MCP */}
                  <div className="flex flex-col items-center">
                    <ArchNode label="Internal MCP" sublabel="Enterprise Tools" status={archState.mcp as any} />
                    <div className="mt-2 flex gap-1">
                      <span className="px-1.5 py-0.5 text-[8px] bg-[#14141c] border border-white/5 rounded text-gray-400">CRM</span>
                      <span className="px-1.5 py-0.5 text-[8px] bg-[#14141c] border border-white/5 rounded text-gray-400">Docs</span>
                      <span className="px-1.5 py-0.5 text-[8px] bg-[#14141c] border border-white/5 rounded text-gray-400">Payments</span>
                    </div>
                  </div>
                  
                  {/* External SaaS */}
                  <div className="flex flex-col items-center">
                    <ArchNode label="External SaaS" sublabel="Coming Soon" status={archState.external as any} disabled={true} />
                    <div className="mt-2 flex gap-1">
                      <span className="px-1.5 py-0.5 text-[8px] bg-[#14141c]/50 border border-white/5 rounded text-gray-600">GitHub</span>
                      <span className="px-1.5 py-0.5 text-[8px] bg-[#14141c]/50 border border-white/5 rounded text-gray-600">Slack</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Flow Steps */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <IconActivity className="w-4 h-4 text-[#00D4AA]" />
                  <h2 className="text-sm font-semibold text-white">Security Events</h2>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {securitySteps.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-8">
                    <IconShield className="w-10 h-10 text-gray-800 mb-3" />
                    <p className="text-gray-600 text-sm">Security events will appear here</p>
                    <p className="text-gray-700 text-xs">Execute a scenario to begin</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {securitySteps.map((step, index) => (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="relative"
                      >
                        {index < securitySteps.length - 1 && (
                          <div className="absolute left-3 top-8 w-px h-5 bg-gradient-to-b from-white/10 to-transparent" />
                        )}
                        
                        <div className="flex items-start gap-3">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                            step.status === 'success' ? 'bg-emerald-500/20' :
                            step.status === 'error' ? 'bg-red-500/20' :
                            step.status === 'warning' ? 'bg-amber-500/20' :
                            step.status === 'running' ? 'bg-blue-500/20' :
                            'bg-gray-500/20'
                          }`}>
                            {step.status === 'success' ? (
                              <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
                            ) : step.status === 'error' ? (
                              <IconX className="w-3.5 h-3.5 text-red-400" />
                            ) : step.status === 'warning' ? (
                              <IconAlert className="w-3.5 h-3.5 text-amber-400" />
                            ) : step.status === 'running' ? (
                              <motion.div
                                className="w-2 h-2 bg-blue-400 rounded-full"
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 0.6, repeat: Infinity }}
                              />
                            ) : (
                              <div className="w-2 h-2 bg-gray-500 rounded-full" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${
                              step.status === 'error' ? 'text-red-400' :
                              step.status === 'success' ? 'text-white' :
                              step.status === 'warning' ? 'text-amber-400' :
                              'text-gray-300'
                            }`}>
                              {step.name}
                            </p>
                            <p className="text-xs text-gray-600 truncate">{step.detail}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#0a0a0f]">
        <div className="max-w-[1800px] mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-gray-400">
                  Demo by <span className="text-white">Kundan Kolhe</span> | Product Marketing, Okta
                </p>
              </div>
            </div>
            <div className="text-right max-w-lg">
              <p className="text-[11px] text-gray-400">
                <span className="text-[#00D4AA]">Okta for AI Agents</span> | Securing machine-speed operations at 5,000+ actions/min
              </p>
              <p className="text-[10px] text-gray-600 mt-0.5">
                Cross-App Access (XAA) | Fine-Grained Authorization (FGA) | Step-Up Auth (CIBA) | Token Vault
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
