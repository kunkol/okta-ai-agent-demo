'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession, signIn, signOut } from 'next-auth/react';

// Types
type NodeStatus = 'idle' | 'active' | 'success' | 'error';
type FlowStepStatus = 'pending' | 'active' | 'complete' | 'error';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface TokenData {
  id_token: { raw: string; decoded: Record<string, unknown>; };
  id_jag_token: { raw: string; decoded: Record<string, unknown>; } | null;
  auth_server_token: { raw: string; scope: string; expires_in: number; audience: string; } | null;
}

interface FlowStep {
  step: number;
  title: string;
  description: string;
  status: FlowStepStatus;
  section: 'chat' | 'mcp';
}

// Demo scenarios
const DEMO_SCENARIOS = [
  { label: 'Help customer on a call', description: 'Full access - Enterprise tier', query: 'Get customer information for Alice', risk: 'low', category: 'Customers' },
  { label: 'Process standard refund', description: '$5,000 - auto-approved', query: 'Initiate a payment of $5000 to Bob Smith', risk: 'medium', category: 'Payments' },
  { label: 'Process large refund', description: '$15,000 - manager approval', query: 'Initiate a payment of $15000 to Bob Smith', risk: 'critical', category: 'Payments' },
  { label: 'Search documentation', description: 'FGA-filtered results', query: 'Search for documents about security policies', risk: 'low', category: 'Documents' },
  { label: 'Access restricted record', description: 'Compliance hold - denied', query: 'Get customer information for Charlie', risk: 'high', category: 'Customers' },
  { label: 'View partner account', description: 'Full access - Professional tier', query: 'Get customer information for Bob', risk: 'low', category: 'Customers' },
];

// Decode JWT helper
const decodeJwt = (token: string): Record<string, unknown> => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return {};
  }
};

// Copy Button Component
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
      {copied ? (
        <><svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-emerald-400">Copied</span></>
      ) : (
        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg><span>Copy</span></>
      )}
    </button>
  );
};

// Flow Node Component
const FlowNode = ({ 
  status, label, sublabel, icon, isLast = false
}: { 
  status: NodeStatus; label: string; sublabel: string; icon: React.ReactNode; isLast?: boolean;
}) => {
  const statusStyles = {
    idle: 'border-slate-600 bg-slate-800/80',
    active: 'border-blue-400 bg-blue-500/20 shadow-lg shadow-blue-500/40',
    success: 'border-emerald-400 bg-emerald-500/20 shadow-md shadow-emerald-500/30',
    error: 'border-red-400 bg-red-500/20',
  };
  const iconBgStyles = {
    idle: 'bg-slate-700 text-slate-400',
    active: 'bg-blue-500 text-white',
    success: 'bg-emerald-500 text-white',
    error: 'bg-red-500 text-white',
  };

  return (
    <div className="flex items-center gap-2">
      <motion.div
        animate={{ scale: status === 'active' ? [1, 1.05, 1] : 1 }}
        transition={{ duration: 0.5, repeat: status === 'active' ? Infinity : 0 }}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all duration-300 ${statusStyles[status]}`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBgStyles[status]}`}>{icon}</div>
        <div>
          <p className="text-xs font-semibold text-white">{label}</p>
          <p className="text-[9px] text-slate-400">{sublabel}</p>
        </div>
      </motion.div>
      {!isLast && (
        <div className={`w-8 h-0.5 ${status === 'success' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
      )}
    </div>
  );
};

// MCP Flow Step Component (Dark Theme)
const MCPFlowStepDark = ({ step, isLast }: { step: FlowStep; isLast: boolean }) => {
  const statusColors = {
    pending: 'bg-slate-600 text-slate-400',
    active: 'bg-blue-500 text-white animate-pulse',
    complete: 'bg-emerald-500 text-white',
    error: 'bg-red-500 text-white',
  };
  return (
    <div className="flex gap-2">
      <div className="flex flex-col items-center">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${statusColors[step.status]}`}>{step.step}</div>
        {!isLast && <div className={`w-0.5 flex-1 mt-1 ${step.status === 'complete' ? 'bg-emerald-400' : 'bg-slate-600'}`} />}
      </div>
      <div className="flex-1 pb-3">
        <p className="text-xs font-semibold text-gray-200">{step.title}</p>
        <p className="text-[10px] text-gray-500">{step.description}</p>
      </div>
    </div>
  );
};

// Collapsible Section (Dark Theme)
const CollapsibleSection = ({ title, children, defaultOpen = false, statusColor = 'emerald' }: { title: string; children: React.ReactNode; defaultOpen?: boolean; statusColor?: string }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colors: Record<string, string> = { emerald: 'bg-emerald-500', blue: 'bg-blue-500', purple: 'bg-purple-500' };
  return (
    <div className="bg-slate-800 rounded-lg border border-white/10 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${colors[statusColor] || colors.emerald}`} />
          <span className="text-xs font-semibold text-white">{title}</span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-white/10">
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

// Loading Screen
const LoadingScreen = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-8">
    <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
    <p className="text-white">Loading...</p>
  </div>
);

// Main Component
export default function Home() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [tokens, setTokens] = useState<TokenData | null>(null);
  const [currentTool, setCurrentTool] = useState<string>('');
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [xaaStatus, setXaaStatus] = useState<string>('');
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([
    { step: 1, title: 'ID → ID-JAG', description: 'Exchange user ID token for ID-JAG token', status: 'pending', section: 'chat' },
    { step: 2, title: 'Verify ID-JAG', description: 'Validate ID-JAG token (audit trail)', status: 'pending', section: 'chat' },
    { step: 3, title: 'ID-JAG → Auth Server Token', description: 'Exchange ID-JAG for authorization server token', status: 'pending', section: 'chat' },
    { step: 4, title: 'Validate & Execute', description: 'Verified access. Executing tool...', status: 'pending', section: 'mcp' },
  ]);
  
  const [flowState, setFlowState] = useState({
    rep: 'idle' as NodeStatus, okta: 'idle' as NodeStatus, agent: 'idle' as NodeStatus,
    security: 'idle' as NodeStatus, mcp_internal: 'idle' as NodeStatus, mcp_external: 'idle' as NodeStatus,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://okta-ai-agent-backend.onrender.com';

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Initialize tokens from session
  useEffect(() => {
    if (session?.idToken) {
      const decoded = decodeJwt(session.idToken);
      setTokens({
        id_token: { raw: session.idToken, decoded },
        id_jag_token: null,
        auth_server_token: null,
      });
    }
  }, [session]);

  const resetFlow = () => {
    setFlowState({ rep: 'idle', okta: 'idle', agent: 'idle', security: 'idle', mcp_internal: 'idle', mcp_external: 'idle' });
    setFlowSteps(steps => steps.map(s => ({ ...s, status: 'pending' as FlowStepStatus })));
    setXaaStatus('');
  };

  const animateFlow = async (hasError = false, tool: string, xaaSuccess: boolean) => {
    setFlowState(prev => ({ ...prev, rep: 'active' }));
    await new Promise(r => setTimeout(r, 300));
    setFlowState(prev => ({ ...prev, rep: 'success', okta: 'active' }));
    setFlowSteps(steps => steps.map((s, i) => i === 0 ? { ...s, status: 'active' } : s));
    
    await new Promise(r => setTimeout(r, 300));
    setFlowSteps(steps => steps.map((s, i) => i === 0 ? { ...s, status: xaaSuccess ? 'complete' : 'error' } : i === 1 ? { ...s, status: 'active' } : s));
    setFlowState(prev => ({ ...prev, okta: xaaSuccess ? 'success' : 'error', agent: 'active' }));
    
    await new Promise(r => setTimeout(r, 300));
    setFlowSteps(steps => steps.map((s, i) => i === 1 ? { ...s, status: xaaSuccess ? 'complete' : 'error' } : i === 2 ? { ...s, status: 'active' } : s));
    setFlowState(prev => ({ ...prev, agent: xaaSuccess ? 'success' : 'error', security: 'active' }));
    
    await new Promise(r => setTimeout(r, 300));
    setFlowSteps(steps => steps.map((s, i) => i === 2 ? { ...s, status: xaaSuccess ? 'complete' : 'error' } : i === 3 ? { ...s, status: 'active', description: `Verified access. Executing: ${tool}` } : s));
    setFlowState(prev => ({ ...prev, security: xaaSuccess ? 'success' : 'error', mcp_internal: 'active' }));
    
    await new Promise(r => setTimeout(r, 300));
    setFlowSteps(steps => steps.map((s, i) => i === 3 ? { ...s, status: hasError ? 'error' : 'complete' } : s));
    setFlowState(prev => ({ ...prev, mcp_internal: hasError ? 'error' : 'success' }));
  };

  const handleNewSession = () => { setMessages([]); setInput(''); setTokens(session?.idToken ? { id_token: { raw: session.idToken, decoded: decodeJwt(session.idToken) }, id_jag_token: null, auth_server_token: null } : null); setCurrentTool(''); setCurrentQuery(''); resetFlow(); };
  const handleLogout = () => { signOut({ callbackUrl: '/' }); };
  const handleLogin = () => { signIn('okta'); };

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

    try {
      // Build headers with ID token
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add ID token if available
      if (session?.idToken) {
        headers['X-ID-Token'] = session.idToken;
        console.log('Sending ID token to backend');
      } else {
        console.warn('No ID token available in session');
      }

      const response = await fetch(`${BACKEND_URL}/api/chat`, { 
        method: 'POST', 
        headers,
        body: JSON.stringify({ message: content }) 
      });
      
      const data = await response.json();
      
      // Check if XAA was performed
      const xaaPerformed = data.security_flow?.token_exchanged || false;
      setXaaStatus(xaaPerformed ? 'XAA Successful' : 'XAA Not Performed');
      
      // Update tokens with MCP info if available
      if (data.mcp_info && session?.idToken) {
        setTokens({
          id_token: { raw: session.idToken, decoded: decodeJwt(session.idToken) },
          id_jag_token: data.mcp_info.id_jag_token ? { raw: data.mcp_info.id_jag_token, decoded: {} } : null,
          auth_server_token: data.mcp_info.auth_server_token ? {
            raw: data.mcp_info.auth_server_token,
            scope: data.mcp_info.scope || 'mcp:read',
            expires_in: data.mcp_info.expires_in || 3600,
            audience: data.mcp_info.audience || 'api://default'
          } : null,
        });
      }
      
      // Animate flow based on XAA result
      animateFlow(hasError, tool, xaaPerformed);
      
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response, timestamp: new Date() }]);
    } catch (error) {
      animateFlow(true, tool, false);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Failed to connect'}`, timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (status === 'loading') {
    return <LoadingScreen />;
  }

  // Not authenticated
  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Get user info from session
  const user = {
    name: session.user?.name || 'Unknown User',
    email: session.user?.email || '',
    sub: session.user?.id || '',
    role: 'Support Representative',
  };

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
              {/* XAA Status Badge */}
              {xaaStatus && (
                <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${xaaStatus.includes('Successful') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                  {xaaStatus}
                </div>
              )}
              <div className="flex items-center gap-4 px-5 py-3 bg-white/5 rounded-2xl border border-white/10">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center text-white font-bold">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{user.name}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
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

      {/* MAIN: 60% / 40% */}
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
                        <p className="text-xs text-gray-400">{scenario.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <motion.div key={message.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-100'}`}>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p className="text-[10px] mt-1 opacity-60">{message.timestamp.toLocaleTimeString()}</p>
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                      <div className="bg-slate-700 rounded-2xl px-4 py-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-white/10">
              <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) sendMessage(input.trim()); }} className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 bg-slate-700 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <button type="submit" disabled={isLoading || !input.trim()} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors">
                  Send
                </button>
              </form>
            </div>
          </div>

          {/* COLUMN 2: Security Panel (40%) */}
          <div className="w-[40%] flex flex-col bg-slate-900 overflow-y-auto">
            <div className="p-4 space-y-4">
              {/* ID Token Section */}
              <CollapsibleSection title="ID Token (from Okta SSO)" defaultOpen statusColor="emerald">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-medium text-gray-400">Decoded Claims</span>
                      {tokens?.id_token && <CopyButton text={JSON.stringify(tokens.id_token.decoded, null, 2)} />}
                    </div>
                    <div className="bg-slate-900 rounded-lg p-2 max-h-32 overflow-auto border border-white/10">
                      <pre className="text-[9px] text-emerald-400 font-mono whitespace-pre-wrap">
                        {tokens?.id_token ? JSON.stringify(tokens.id_token.decoded, null, 2) : '{\n  "sub": "waiting for login...",\n  "name": "...",\n  "email": "..."\n}'}
                      </pre>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-medium text-gray-400">Raw Token</span>
                      {tokens?.id_token && <CopyButton text={tokens.id_token.raw} />}
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-2 border border-white/10">
                      <p className="text-[9px] text-gray-400 font-mono break-all line-clamp-3">
                        {tokens?.id_token?.raw || 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'}
                      </p>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* XAA Flow Section */}
              <CollapsibleSection title="XAA Flow (Cross-App Access)" defaultOpen statusColor="blue">
                <div className="space-y-3">
                  {/* Query */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-medium text-gray-400 uppercase">Current Query</span>
                      {currentQuery && <CopyButton text={currentQuery} />}
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-2 border border-white/10">
                      <p className="text-xs text-gray-300">{currentQuery || 'Waiting for query...'}</p>
                    </div>
                  </div>

                  {/* Tool */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-medium text-gray-400 uppercase">Tool Being Called</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900/50 rounded-lg border border-white/10">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                      <span className="text-xs text-gray-300 font-medium">{currentTool || 'waiting...'}</span>
                    </div>
                  </div>

                  {/* Auth Server Token */}
                  {tokens?.auth_server_token && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium text-gray-400 uppercase">Auth Server Token</span>
                          <span className="text-[8px] text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">{tokens.auth_server_token.scope}</span>
                        </div>
                        <CopyButton text={tokens.auth_server_token.raw} />
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-2 border border-white/10">
                        <p className="text-[9px] text-gray-400 font-mono break-all line-clamp-2">
                          {tokens.auth_server_token.raw}
                        </p>
                        <p className="text-[8px] text-gray-500 mt-1">Audience: {tokens.auth_server_token.audience} | Expires in: {tokens.auth_server_token.expires_in}s</p>
                      </div>
                    </div>
                  )}

                  {/* Flow Steps */}
                  <div className="pt-2 border-t border-white/10">
                    <span className="text-[10px] font-medium text-gray-400 uppercase block mb-2">XAA Token Exchange Flow</span>
                    
                    <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-2 mb-2">
                      <span className="text-[10px] font-semibold text-purple-300">Backend API (Steps 1-3)</span>
                    </div>
                    <div className="ml-1 mb-2">
                      {flowSteps.filter(s => s.section === 'chat').map((step, idx, arr) => (
                        <MCPFlowStepDark key={step.step} step={step} isLast={idx === arr.length - 1} />
                      ))}
                    </div>
                    
                    <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-lg p-2 mb-2">
                      <span className="text-[10px] font-semibold text-emerald-300">MCP Server (Step 4)</span>
                    </div>
                    <div className="ml-1">
                      {flowSteps.filter(s => s.section === 'mcp').map((step, idx, arr) => (
                        <MCPFlowStepDark key={step.step} step={step} isLast={idx === arr.length - 1} />
                      ))}
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Security Status */}
              <div className={`border rounded-lg p-3 ${xaaStatus.includes('Successful') ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-slate-800 border-white/10'}`}>
                <div className="flex items-start gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${xaaStatus.includes('Successful') ? 'bg-emerald-500/30' : 'bg-slate-700'}`}>
                    {xaaStatus.includes('Successful') ? (
                      <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    )}
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${xaaStatus.includes('Successful') ? 'text-emerald-300' : 'text-gray-300'}`}>
                      {xaaStatus || 'Waiting for XAA...'}
                    </p>
                    <p className={`text-[10px] ${xaaStatus.includes('Successful') ? 'text-emerald-400/80' : 'text-gray-500'}`}>
                      {xaaStatus.includes('Successful') 
                        ? 'ID tokens exchanged securely. MCP access granted.'
                        : 'Send a message to trigger XAA flow.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-white/10">
        <div className="max-w-[1920px] mx-auto px-8 py-6">
          <div className="flex items-center justify-center gap-6">
            <a href="https://www.okta.com/solutions/secure-ai/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#007DC1"/><path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z" fill="white"/></svg>
              <span className="text-sm text-white font-medium">Okta Secures AI</span>
            </a>
            <span className="text-gray-600">|</span>
            <a href="https://auth0.com/ai" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors">
              <span className="text-orange-500 font-bold text-xl">a0</span>
              <span className="text-sm text-white font-medium">Auth0 for AI</span>
            </a>
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
