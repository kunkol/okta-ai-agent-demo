'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
type NodeStatus = 'idle' | 'active' | 'success' | 'error';
type FlowStepStatus = 'pending' | 'active' | 'complete' | 'error';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface User {
  name: string;
  email: string;
  sub: string;
  role: string;
}

interface TokenData {
  id_token: { raw: string; decoded: Record<string, unknown>; };
  id_jag_token: { raw: string; decoded: Record<string, unknown>; };
  mcp_access_token: { raw: string; scope: string; expires_in: number; };
}

interface FlowStep {
  step: number;
  title: string;
  description: string;
  status: FlowStepStatus;
  section: 'chat' | 'mcp';
}

// Demo user
const DEMO_USER: User = {
  name: 'Kundan Kolhe',
  email: 'kundan.kolhe@okta.com',
  sub: '00u8w1k16aeagsq620g7',
  role: 'Support Representative',
};

// Demo scenarios
const DEMO_SCENARIOS = [
  { label: 'Help customer on a call', description: 'Full access - Enterprise tier', query: 'Get customer information for Alice', risk: 'low', category: 'Customers' },
  { label: 'Process standard refund', description: '$5,000 - auto-approved', query: 'Initiate a payment of $5000 to Bob Smith', risk: 'medium', category: 'Payments' },
  { label: 'Process large refund', description: '$15,000 - manager approval', query: 'Initiate a payment of $15000 to Bob Smith', risk: 'critical', category: 'Payments' },
  { label: 'Search documentation', description: 'FGA-filtered results', query: 'Search for documents about security policies', risk: 'low', category: 'Documents' },
  { label: 'Access restricted record', description: 'Compliance hold - denied', query: 'Get customer information for Charlie', risk: 'high', category: 'Customers' },
  { label: 'View partner account', description: 'Full access - Professional tier', query: 'Get customer information for Bob', risk: 'low', category: 'Customers' },
];

// Generate realistic tokens
const generateTokens = (user: User, query: string, tool: string): TokenData => {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;
  
  const idTokenDecoded = {
    sub: user.sub,
    name: user.name,
    email: user.email,
    ver: 1,
    iss: "https://qa-aiagentsproducttc1.trexcloud.com/oauth2/default",
    aud: "0oa8xatd11PBe622F0g7",
    iat: now,
    exp: exp,
    jti: `ID.${Math.random().toString(36).substring(2, 15)}`,
    amr: ["pwd", "mfa"],
    auth_time: now - 300,
  };

  const idJagDecoded = {
    iss: "https://qa-aiagentsproducttc1.trexcloud.com",
    aud: "api://apex-customers-mcp",
    sub: user.sub,
    agent_id: "atlas-ai-agent",
    agent_name: "Atlas",
    azp: "apex-customer-360",
    scope: tool === 'get_customer' ? 'customers:read' : tool === 'initiate_payment' ? 'payments:write' : 'documents:read',
    delegation_chain: [{ actor: user.email, app: "apex-customer-360", timestamp: now }],
    iat: now,
    exp: now + 300,
  };

  const encodeToken = (header: object, payload: object) => {
    const h = btoa(JSON.stringify(header)).replace(/=/g, '');
    const p = btoa(JSON.stringify(payload)).replace(/=/g, '');
    return `${h}.${p}.${Math.random().toString(36).substring(2, 20)}`;
  };

  return {
    id_token: { raw: encodeToken({ alg: 'RS256', typ: 'JWT' }, idTokenDecoded), decoded: idTokenDecoded },
    id_jag_token: { raw: encodeToken({ alg: 'RS256', typ: 'id-jag+jwt' }, idJagDecoded), decoded: idJagDecoded },
    mcp_access_token: { raw: `eyJraWQ${Math.random().toString(36).substring(2, 8)}Vd2UTRBVHFZR2VyMFdmZHM5QzRCKm15Mks0SmVyYjU3QlczRWFnTHZFIiwiYWxnIjoi...`, scope: idJagDecoded.scope, expires_in: 3600 },
  };
};

// Copy Button Component
const CopyButton = ({ text, label = "Copy" }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors">
      {copied ? (
        <><svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-emerald-500">Copied</span></>
      ) : (
        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><span>{label}</span></>
      )}
    </button>
  );
};

// Flow Node Component
const FlowNode = ({ 
  status, label, sublabel, icon, extraContent, isLast = false, compact = false
}: { 
  status: NodeStatus; label: string; sublabel: string; icon: React.ReactNode; extraContent?: React.ReactNode; isLast?: boolean; compact?: boolean;
}) => {
  const statusStyles = {
    idle: 'border-gray-600 bg-slate-800',
    active: 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/30',
    success: 'border-emerald-500 bg-emerald-500/20',
    error: 'border-red-500 bg-red-500/20',
  };
  const iconBgStyles = {
    idle: 'bg-gray-700 text-gray-400',
    active: 'bg-blue-500 text-white',
    success: 'bg-emerald-500 text-white',
    error: 'bg-red-500 text-white',
  };

  return (
    <div className="flex flex-col items-center">
      <motion.div
        animate={{ scale: status === 'active' ? [1, 1.03, 1] : 1 }}
        transition={{ duration: 0.6, repeat: status === 'active' ? Infinity : 0 }}
        className={`relative w-full rounded-xl border-2 ${compact ? 'p-2' : 'p-3'} transition-all duration-300 ${statusStyles[status]}`}
      >
        {status === 'active' && <motion.div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full" animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }} />}
        {status === 'success' && <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"><svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
        {status === 'error' && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"><svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></div>}
        <div className="flex items-center gap-2">
          <div className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg flex items-center justify-center transition-colors ${iconBgStyles[status]}`}>{icon}</div>
          <div className="flex-1 min-w-0">
            <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-white truncate`}>{label}</p>
            <p className={`${compact ? 'text-[9px]' : 'text-xs'} text-gray-400 truncate`}>{sublabel}</p>
          </div>
        </div>
        {extraContent && <div className="mt-2">{extraContent}</div>}
      </motion.div>
      {!isLast && (
        <div className="flex flex-col items-center my-1">
          <motion.div className={`w-0.5 h-3 transition-colors ${status === 'success' ? 'bg-emerald-500' : status === 'active' ? 'bg-blue-500' : 'bg-gray-600'}`} />
          <svg className={`w-3 h-3 ${status === 'success' ? 'text-emerald-500' : status === 'active' ? 'text-blue-500' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 16l-6-6h12z" /></svg>
        </div>
      )}
    </div>
  );
};

// MCP Server Box Component (for side-by-side)
const MCPServerBox = ({ status, label, sublabel, tools, icon }: { status: NodeStatus; label: string; sublabel: string; tools: {name: string; icon: string}[]; icon: React.ReactNode }) => {
  const statusStyles = {
    idle: 'border-gray-600 bg-slate-800',
    active: 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/30',
    success: 'border-emerald-500 bg-emerald-500/20',
    error: 'border-red-500 bg-red-500/20',
  };
  const iconBgStyles = {
    idle: 'bg-gray-700 text-gray-400',
    active: 'bg-blue-500 text-white',
    success: 'bg-emerald-500 text-white',
    error: 'bg-red-500 text-white',
  };

  return (
    <motion.div
      animate={{ scale: status === 'active' ? [1, 1.02, 1] : 1 }}
      transition={{ duration: 0.6, repeat: status === 'active' ? Infinity : 0 }}
      className={`relative flex-1 rounded-xl border-2 p-2 transition-all duration-300 ${statusStyles[status]}`}
    >
      {status === 'success' && <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"><svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
      {status === 'error' && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"><svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></div>}
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBgStyles[status]}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-white truncate">{label}</p>
          <p className="text-[8px] text-gray-400 truncate">{sublabel}</p>
        </div>
      </div>
      <div className="space-y-0.5">
        {tools.map((tool, idx) => (
          <div key={idx} className="flex items-center gap-1 text-[9px] text-gray-400">
            <span>{tool.icon}</span><span>{tool.name}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// MCP Flow Step Component
const MCPFlowStep = ({ step, isLast }: { step: FlowStep; isLast: boolean }) => {
  const statusColors = {
    pending: 'bg-gray-300 text-gray-600',
    active: 'bg-blue-500 text-white animate-pulse',
    complete: 'bg-emerald-500 text-white',
    error: 'bg-red-500 text-white',
  };
  return (
    <div className="flex gap-2">
      <div className="flex flex-col items-center">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${statusColors[step.status]}`}>{step.step}</div>
        {!isLast && <div className={`w-0.5 flex-1 mt-1 ${step.status === 'complete' ? 'bg-emerald-400' : 'bg-gray-300'}`} />}
      </div>
      <div className="flex-1 pb-3">
        <p className="text-xs font-semibold text-gray-800">{step.title}</p>
        <p className="text-[10px] text-gray-500">{step.description}</p>
      </div>
    </div>
  );
};

// Collapsible Section
const CollapsibleSection = ({ title, children, defaultOpen = false, statusColor = 'emerald' }: { title: string; children: React.ReactNode; defaultOpen?: boolean; statusColor?: string }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colors: Record<string, string> = { emerald: 'bg-emerald-500', blue: 'bg-blue-500', purple: 'bg-purple-500' };
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${colors[statusColor] || colors.emerald}`} />
          <span className="text-xs font-semibold text-gray-800">{title}</span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-gray-100">
            <div className="p-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Prompt Library Modal
const PromptLibrary = ({ onSelect, onClose }: { onSelect: (query: string) => void; onClose: () => void }) => {
  const categories = ['Customers', 'Payments', 'Documents'];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl max-w-2xl w-full max-h-[70vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Prompt Library</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg text-gray-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(70vh-80px)]">
          {categories.map((category) => (
            <div key={category} className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">{category}</h3>
              <div className="space-y-2">
                {DEMO_SCENARIOS.filter(s => s.category === category).map((scenario, idx) => (
                  <button key={idx} onClick={() => { onSelect(scenario.query); onClose(); }} className={`w-full text-left p-3 rounded-xl border transition-all hover:scale-[1.01] ${scenario.risk === 'critical' ? 'border-red-200 hover:bg-red-50' : scenario.risk === 'high' ? 'border-amber-200 hover:bg-amber-50' : 'border-gray-200 hover:bg-emerald-50'}`}>
                    <p className="text-sm font-medium text-gray-900">{scenario.label}</p>
                    <p className="text-xs text-gray-500">{scenario.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

// Login Screen
const LoginScreen = ({ onLogin }: { onLogin: () => void }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-8">
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
      <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-[#00297A] to-[#00D4AA] flex items-center justify-center mb-8 shadow-2xl">
        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
      </div>
      <h1 className="text-4xl font-bold text-white mb-3">Apex Financial Services</h1>
      <p className="text-xl text-gray-400 mb-2">Customer 360 Platform</p>
      <p className="text-sm text-gray-500 mb-12">Powered by Atlas AI</p>
      <button onClick={onLogin} className="px-10 py-4 bg-white text-gray-900 font-semibold rounded-xl hover:bg-gray-100 transition-all shadow-xl flex items-center gap-3 mx-auto">
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#007DC1"/><path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z" fill="white"/></svg>
        Sign in with Okta
      </button>
    </motion.div>
  </div>
);

// Main Component
export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user] = useState<User>(DEMO_USER);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [tokens, setTokens] = useState<TokenData | null>(null);
  const [currentTool, setCurrentTool] = useState<string>('');
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([
    { step: 1, title: 'ID → ID-JAG', description: 'Exchange user ID token for ID-JAG token', status: 'pending', section: 'chat' },
    { step: 2, title: 'Verify ID-JAG', description: 'Validate ID-JAG token (audit trail)', status: 'pending', section: 'chat' },
    { step: 3, title: 'ID-JAG → MCP Token', description: 'Exchange ID-JAG for authorization server token', status: 'pending', section: 'chat' },
    { step: 4, title: 'Validate & Execute', description: 'Verified access. Executing tool...', status: 'pending', section: 'mcp' },
  ]);
  
  const [flowState, setFlowState] = useState({
    rep: 'idle' as NodeStatus, okta: 'idle' as NodeStatus, agent: 'idle' as NodeStatus,
    security: 'idle' as NodeStatus, mcp_internal: 'idle' as NodeStatus, mcp_external: 'idle' as NodeStatus,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://okta-ai-agent-backend.onrender.com';

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const resetFlow = () => {
    setFlowState({ rep: 'idle', okta: 'idle', agent: 'idle', security: 'idle', mcp_internal: 'idle', mcp_external: 'idle' });
    setFlowSteps(steps => steps.map(s => ({ ...s, status: 'pending' as FlowStepStatus })));
  };

  const animateFlow = async (hasError = false, tool: string) => {
    setFlowState(prev => ({ ...prev, rep: 'active' }));
    await new Promise(r => setTimeout(r, 300));
    setFlowState(prev => ({ ...prev, rep: 'success', okta: 'active' }));
    setFlowSteps(steps => steps.map((s, i) => i === 0 ? { ...s, status: 'active' } : s));
    
    await new Promise(r => setTimeout(r, 300));
    setFlowSteps(steps => steps.map((s, i) => i === 0 ? { ...s, status: 'complete' } : i === 1 ? { ...s, status: 'active' } : s));
    setFlowState(prev => ({ ...prev, okta: 'success', agent: 'active' }));
    
    await new Promise(r => setTimeout(r, 300));
    setFlowSteps(steps => steps.map((s, i) => i === 1 ? { ...s, status: 'complete' } : i === 2 ? { ...s, status: 'active' } : s));
    setFlowState(prev => ({ ...prev, agent: 'success', security: 'active' }));
    
    await new Promise(r => setTimeout(r, 300));
    setFlowSteps(steps => steps.map((s, i) => i === 2 ? { ...s, status: 'complete' } : i === 3 ? { ...s, status: 'active', description: `Verified access. Executing: ${tool}` } : s));
    setFlowState(prev => ({ ...prev, security: 'success', mcp_internal: 'active' }));
    
    await new Promise(r => setTimeout(r, 300));
    setFlowSteps(steps => steps.map((s, i) => i === 3 ? { ...s, status: hasError ? 'error' : 'complete' } : s));
    setFlowState(prev => ({ ...prev, mcp_internal: hasError ? 'error' : 'success' }));
  };

  const handleNewSession = () => { setMessages([]); setInput(''); setTokens(null); setCurrentTool(''); setCurrentQuery(''); resetFlow(); };
  const handleLogout = () => { setIsLoggedIn(false); handleNewSession(); };

  const sendMessage = async (content: string) => {
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setCurrentQuery(content);
    resetFlow();

    let tool = 'get_customer';
    if (content.toLowerCase().includes('payment') || content.toLowerCase().includes('refund')) tool = 'initiate_payment';
    else if (content.toLowerCase().includes('document') || content.toLowerCase().includes('search')) tool = 'search_documents';
    setCurrentTool(tool);

    const hasError = content.toLowerCase().includes('charlie');
    const newTokens = generateTokens(user, content, tool);
    setTokens(newTokens);
    animateFlow(hasError, tool);

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: content }) });
      const data = await response.json();
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response, timestamp: new Date() }]);
    } catch (error) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Failed to connect'}`, timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoggedIn) return <LoginScreen onLogin={() => setIsLoggedIn(true)} />;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* HEADER */}
      <header className="border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-[1920px] mx-auto px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00297A] to-[#00D4AA] flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Apex Financial Services</h1>
                <p className="text-sm text-gray-400">Customer 360 Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4 px-5 py-3 bg-white/5 rounded-2xl border border-white/10">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center text-white font-bold">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{user.name}</p>
                  <p className="text-xs text-gray-400">{user.role}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="px-5 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN: 60% / 20% / 20% */}
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 max-w-[1920px] mx-auto w-full flex">
          
          {/* COLUMN 1: Chat (60%) */}
          <div className="w-[60%] flex flex-col border-r border-white/10 bg-slate-800/50">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </div>
                <div>
                  <h2 className="text-white font-semibold">Atlas AI Assistant</h2>
                  <p className="text-xs text-gray-400">Secure Enterprise Agent</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPromptLibrary(true)} className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 text-white rounded-lg">📚 Prompts</button>
                {messages.length > 0 && <button onClick={handleNewSession} className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-lg">New Chat</button>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  </div>
                  <h3 className="text-xl text-white font-semibold mb-2">Welcome, {user.name.split(' ')[0]}!</h3>
                  <p className="text-gray-400 mb-8">How can I help you with customer support today?</p>
                  <div className="grid grid-cols-2 gap-3 max-w-2xl w-full">
                    {DEMO_SCENARIOS.map((scenario, idx) => (
                      <button key={idx} onClick={() => sendMessage(scenario.query)} className={`p-4 text-left rounded-xl border transition-all hover:scale-[1.02] ${scenario.risk === 'critical' ? 'border-red-500/30 hover:bg-red-500/10' : scenario.risk === 'high' ? 'border-amber-500/30 hover:bg-amber-500/10' : 'border-white/10 hover:bg-white/5'}`}>
                        <p className="text-sm text-white font-medium">{scenario.label}</p>
                        <p className="text-xs text-gray-500">{scenario.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <motion.div key={message.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${message.role === 'user' ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white' : 'bg-white/10 text-gray-100'}`}>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/10 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" />
                          <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-white/10">
              <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) sendMessage(input.trim()); }} className="flex gap-3">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about customers, payments, or policies..." className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500" disabled={isLoading} />
                <button type="submit" disabled={isLoading || !input.trim()} className="px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium rounded-xl disabled:opacity-50">Send</button>
              </form>
            </div>
          </div>

          {/* COLUMN 2: Visual Flow (20%) */}
          <div className="w-[20%] flex flex-col bg-gradient-to-b from-slate-800/50 to-slate-900/50 border-r border-white/10">
            <div className="px-4 py-4 border-b border-white/10">
              <h2 className="text-white font-semibold text-sm">Security Flow</h2>
              <p className="text-xs text-gray-500">Real-time visualization</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <FlowNode status={flowState.rep} label={user.name} sublabel="Support Representative" compact
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} />

              <FlowNode status={flowState.okta} label="Okta SSO" sublabel="Identity Provider" compact
                icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8" /></svg>} />

              <FlowNode status={flowState.agent} label="Atlas" sublabel="AI Agent (powered by Claude)" compact
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />

              <FlowNode status={flowState.security} label="Okta for AI Agents" sublabel="Secure Auth (XAA, CIBA, FGA)" compact
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>} isLast />

              {/* Side-by-side MCP Servers */}
              <div className="pt-2">
                <div className="flex items-center gap-1 mb-2">
                  <div className={`w-0.5 h-4 ${flowState.security === 'success' ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                </div>
                <div className="flex gap-2">
                  <MCPServerBox
                    status={flowState.mcp_internal}
                    label="Internal MCP"
                    sublabel="apex-customers-mcp"
                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2" /></svg>}
                    tools={[
                      { name: 'get_customer', icon: '👤' },
                      { name: 'search_documents', icon: '📄' },
                      { name: 'initiate_payment', icon: '💳' },
                    ]}
                  />
                  <MCPServerBox
                    status={flowState.mcp_external}
                    label="External SaaS"
                    sublabel="Third-party MCP"
                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" /></svg>}
                    tools={[
                      { name: 'GitHub', icon: '🐙' },
                      { name: 'Slack', icon: '💬' },
                      { name: 'Salesforce', icon: '☁️' },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 3: MCP Flow & Tokens (20%) - Indranil Style */}
          <div className="w-[20%] flex flex-col bg-gray-50 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              
              {/* ID Token Details - TOP */}
              <CollapsibleSection title="ID Token Details" defaultOpen statusColor="emerald">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-medium text-gray-500">Decoded Token</span>
                      {tokens && <CopyButton text={JSON.stringify(tokens.id_token.decoded, null, 2)} />}
                    </div>
                    <div className="bg-slate-900 rounded-lg p-2 max-h-32 overflow-auto">
                      <pre className="text-[9px] text-emerald-400 font-mono whitespace-pre-wrap">
                        {tokens ? JSON.stringify(tokens.id_token.decoded, null, 2) : '{\n  "sub": "waiting...",\n  "name": "...",\n  "email": "..."\n}'}
                      </pre>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-medium text-gray-500">Raw Token</span>
                      {tokens && <CopyButton text={tokens.id_token.raw} />}
                    </div>
                    <div className="bg-gray-100 rounded-lg p-2 border border-gray-200">
                      <p className="text-[9px] text-gray-600 font-mono break-all line-clamp-3">
                        {tokens?.id_token.raw || 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'}
                      </p>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* MCP Flow */}
              <CollapsibleSection title="MCP Flow" defaultOpen statusColor="blue">
                <div className="space-y-3">
                  {/* MCP Server */}
                  <div>
                    <span className="text-[10px] font-medium text-gray-500 uppercase block mb-1">MCP Server</span>
                    <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" /></svg>
                      <span className="text-xs font-medium text-blue-700">Apex Customers MCP</span>
                    </div>
                  </div>

                  {/* Query */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-medium text-gray-500 uppercase">Query</span>
                      {currentQuery && <CopyButton text={currentQuery} />}
                    </div>
                    <div className="bg-gray-100 rounded-lg p-2 border border-gray-200">
                      <p className="text-xs text-gray-700">{currentQuery || 'Waiting for query...'}</p>
                    </div>
                  </div>

                  {/* Tools Executed */}
                  <div>
                    <span className="text-[10px] font-medium text-gray-500 uppercase block mb-1">Tools Executed</span>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg border border-gray-200">
                      <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                      <span className="text-xs text-gray-700 font-medium">{currentTool || 'waiting...'}</span>
                    </div>
                  </div>

                  {/* ID-JAG Token */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-medium text-gray-500 uppercase">ID-JAG Token</span>
                      {tokens && <CopyButton text={tokens.id_jag_token.raw} />}
                    </div>
                    <div className="bg-gray-100 rounded-lg p-2 border border-gray-200">
                      <p className="text-[9px] text-gray-600 font-mono break-all line-clamp-3">
                        {tokens?.id_jag_token.raw || 'eyJhbGciOiJSUzI1NiIsInR5cCI6ImlkLWphZytqd3QifQ...'}
                      </p>
                    </div>
                  </div>

                  {/* MCP Access Token */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <span className="text-[10px] font-medium text-gray-500 uppercase">MCP Access Token</span>
                        {tokens && (
                          <span className="ml-2 text-[9px] text-gray-400">
                            Scope: <span className="text-emerald-600">{tokens.mcp_access_token.scope}</span> | Expires: {tokens.mcp_access_token.expires_in}s
                          </span>
                        )}
                      </div>
                      {tokens && <CopyButton text={tokens.mcp_access_token.raw} />}
                    </div>
                    <div className="bg-gray-100 rounded-lg p-2 border border-gray-200">
                      <p className="text-[9px] text-gray-600 font-mono break-all line-clamp-2">
                        {tokens?.mcp_access_token.raw || 'mcp_waiting...'}
                      </p>
                    </div>
                  </div>

                  {/* ID-JAG Secure Flow */}
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-[10px] font-medium text-gray-500 uppercase block mb-2">ID-JAG Secure Flow</span>
                    
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 mb-2">
                      <span className="text-[10px] font-semibold text-purple-700">Chat Assistant (STEPS 1-3)</span>
                    </div>
                    <div className="ml-1 mb-2">
                      {flowSteps.filter(s => s.section === 'chat').map((step, idx, arr) => (
                        <MCPFlowStep key={step.step} step={step} isLast={idx === arr.length - 1} />
                      ))}
                    </div>
                    
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 mb-2">
                      <span className="text-[10px] font-semibold text-emerald-700">MCP Server (STEP 4)</span>
                    </div>
                    <div className="ml-1">
                      {flowSteps.filter(s => s.section === 'mcp').map((step, idx, arr) => (
                        <MCPFlowStep key={step.step} step={step} isLast={idx === arr.length - 1} />
                      ))}
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Secure Cross-App Access */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-800">Secure Cross-App Access</p>
                    <p className="text-[10px] text-emerald-600">ID tokens are never exposed to MCP server. Only short-lived access tokens are used.</p>
                  </div>
                </div>
              </div>

              {/* System Status */}
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <h3 className="text-xs font-semibold text-gray-800 mb-3">System Status</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">AI Assistant</span>
                    <span className="flex items-center gap-1.5 text-emerald-600"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />Active</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Authentication</span>
                    <span className="flex items-center gap-1.5 text-emerald-600"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />Secure</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Data Privacy</span>
                    <span className="flex items-center gap-1.5 text-emerald-600"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />Protected</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-white/10">
        <div className="max-w-[1920px] mx-auto px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-white">AI Agent Security Demo</p>
              <p className="text-sm text-gray-400">Built by <span className="text-emerald-400 font-medium">Kundan Kolhe</span> • Product Marketing, Okta</p>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Okta</p>
                <p className="text-xs text-white font-medium">Identity Cloud</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Auth0</p>
                <p className="text-xs text-white font-medium">Developer Identity</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center px-4 py-2 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-lg border border-emerald-500/30">
                <p className="text-[10px] text-emerald-400 uppercase tracking-wider mb-1">For AI Agents</p>
                <p className="text-xs text-white font-bold">XAA • FGA • CIBA</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a href="https://www.okta.com/solutions/secure-ai/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#007DC1"/><path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z" fill="white"/></svg>
                <span className="text-sm text-white font-medium">Okta Secures AI</span>
              </a>
              <a href="https://auth0.com/ai" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors">
                <span className="text-orange-500 font-bold text-lg">a0</span>
                <span className="text-sm text-white font-medium">Auth0 for AI</span>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Prompt Library */}
      <AnimatePresence>
        {showPromptLibrary && <PromptLibrary onSelect={sendMessage} onClose={() => setShowPromptLibrary(false)} />}
      </AnimatePresence>
    </div>
  );
}
