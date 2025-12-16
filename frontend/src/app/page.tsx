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
  id_token: {
    raw: string;
    decoded: Record<string, unknown>;
  };
  id_jag_token: {
    raw: string;
    decoded: Record<string, unknown>;
  };
  mcp_access_token: {
    raw: string;
    scope: string;
    expires_in: number;
  };
}

interface FlowState {
  rep: NodeStatus;
  okta: NodeStatus;
  agent: NodeStatus;
  security: NodeStatus;
  mcp: NodeStatus;
  currentStep: number;
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

// MCP Server Tools
const MCP_TOOLS = [
  { name: 'get_customer', description: 'Retrieve customer data', icon: '👤' },
  { name: 'search_documents', description: 'Search internal docs', icon: '📄' },
  { name: 'initiate_payment', description: 'Process payments', icon: '💳' },
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
    idp: "00o8w1k16aeagsq620g7",
    auth_time: now - 300,
    at_hash: Math.random().toString(36).substring(2, 15),
  };

  const idJagDecoded = {
    iss: "https://qa-aiagentsproducttc1.trexcloud.com",
    aud: "api://apex-customers-mcp",
    sub: user.sub,
    agent_id: "atlas-ai-agent",
    agent_name: "Atlas",
    azp: "apex-customer-360",
    scope: tool === 'get_customer' ? 'customers:read' : tool === 'initiate_payment' ? 'payments:write' : 'documents:read',
    delegation_chain: [
      { actor: user.email, app: "apex-customer-360", timestamp: now }
    ],
    iat: now,
    exp: now + 300,
    jti: `JAG.${Math.random().toString(36).substring(2, 15)}`,
  };

  // Create base64 encoded tokens
  const encodeToken = (header: object, payload: object) => {
    const h = btoa(JSON.stringify(header)).replace(/=/g, '');
    const p = btoa(JSON.stringify(payload)).replace(/=/g, '');
    const s = btoa('signature').replace(/=/g, '');
    return `${h}.${p}.${s}`;
  };

  return {
    id_token: {
      raw: encodeToken({ alg: 'RS256', typ: 'JWT', kid: 'KKDemoAgent' }, idTokenDecoded),
      decoded: idTokenDecoded,
    },
    id_jag_token: {
      raw: encodeToken({ alg: 'RS256', typ: 'id-jag+jwt', kid: 'OKTA-ID-JAG' }, idJagDecoded),
      decoded: idJagDecoded,
    },
    mcp_access_token: {
      raw: `mcp_${Date.now()}_${tool}_${Math.random().toString(36).substring(2, 10)}`,
      scope: idJagDecoded.scope,
      expires_in: 300,
    },
  };
};

// Animated Flow Node Component
const FlowNode = ({ 
  status, 
  label, 
  sublabel, 
  icon,
  tools,
  isLast = false 
}: { 
  status: NodeStatus; 
  label: string; 
  sublabel: string; 
  icon: React.ReactNode;
  tools?: typeof MCP_TOOLS;
  isLast?: boolean;
}) => {
  const statusStyles = {
    idle: 'border-gray-300 bg-gray-50',
    active: 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/30',
    success: 'border-emerald-500 bg-emerald-50',
    error: 'border-red-500 bg-red-50',
  };

  const pulseStyles = {
    idle: '',
    active: 'animate-pulse',
    success: '',
    error: '',
  };

  const iconBgStyles = {
    idle: 'bg-gray-200 text-gray-600',
    active: 'bg-blue-500 text-white',
    success: 'bg-emerald-500 text-white',
    error: 'bg-red-500 text-white',
  };

  return (
    <div className="flex flex-col items-center">
      <motion.div
        initial={{ scale: 1 }}
        animate={{ 
          scale: status === 'active' ? [1, 1.05, 1] : 1,
        }}
        transition={{ 
          duration: 0.5, 
          repeat: status === 'active' ? Infinity : 0,
        }}
        className={`relative w-full max-w-[200px] rounded-xl border-2 p-4 transition-all duration-300 ${statusStyles[status]} ${pulseStyles[status]}`}
      >
        {/* Status indicator */}
        {status === 'active' && (
          <motion.div 
            className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full"
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
        {status === 'success' && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}

        <div className="flex flex-col items-center text-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors ${iconBgStyles[status]}`}>
            {icon}
          </div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>
          
          {/* MCP Tools */}
          {tools && tools.length > 0 && (
            <div className="mt-3 w-full space-y-1">
              {tools.map((tool, idx) => (
                <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-white/80 rounded text-[10px] text-gray-600">
                  <span>{tool.icon}</span>
                  <span>{tool.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Connector Arrow */}
      {!isLast && (
        <div className="flex flex-col items-center my-2">
          <motion.div
            className={`w-0.5 h-6 transition-colors duration-300 ${
              status === 'success' ? 'bg-emerald-400' : 
              status === 'active' ? 'bg-blue-400' : 
              status === 'error' ? 'bg-red-400' : 'bg-gray-300'
            }`}
            animate={{
              background: status === 'active' ? ['#60A5FA', '#3B82F6', '#60A5FA'] : undefined,
            }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <svg 
            className={`w-4 h-4 transition-colors duration-300 ${
              status === 'success' ? 'text-emerald-400' : 
              status === 'active' ? 'text-blue-400' : 
              status === 'error' ? 'text-red-400' : 'text-gray-300'
            }`} 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M12 16l-6-6h12z" />
          </svg>
        </div>
      )}
    </div>
  );
};

// Token Display Panel
const TokenPanel = ({ 
  title, 
  token, 
  decoded, 
  isExpanded, 
  onToggle 
}: { 
  title: string; 
  token: string; 
  decoded?: Record<string, unknown>; 
  isExpanded: boolean; 
  onToggle: () => void;
}) => {
  const [copied, setCopied] = useState(false);

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium text-gray-900">{title}</span>
        </div>
        <svg 
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-100"
          >
            <div className="p-4 space-y-3">
              {decoded && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500">Decoded</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(decoded, null, 2));
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-3 max-h-48 overflow-auto">
                    <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap">
                      {JSON.stringify(decoded, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Raw Token</span>
                  <button onClick={copyToken} className="text-xs text-gray-400 hover:text-gray-600">
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <div className="bg-gray-100 rounded-lg p-3">
                  <p className="text-xs text-gray-600 font-mono break-all line-clamp-3">
                    {token}
                  </p>
                </div>
              </div>
            </div>
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[70vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Prompt Library</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(70vh-80px)]">
          <p className="text-sm text-gray-500 mb-6">
            Select a scenario to test XAA token exchange, FGA authorization, and CIBA step-up authentication.
          </p>
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{category}</h3>
                <div className="space-y-2">
                  {DEMO_SCENARIOS.filter(s => s.category === category).map((scenario, idx) => (
                    <button
                      key={idx}
                      onClick={() => { onSelect(scenario.query); onClose(); }}
                      className={`w-full text-left p-4 rounded-xl border transition-all hover:scale-[1.01] ${
                        scenario.risk === 'critical' ? 'border-red-200 hover:border-red-400 hover:bg-red-50' :
                        scenario.risk === 'high' ? 'border-amber-200 hover:border-amber-400 hover:bg-amber-50' :
                        scenario.risk === 'medium' ? 'border-blue-200 hover:border-blue-400 hover:bg-blue-50' :
                        'border-gray-200 hover:border-emerald-400 hover:bg-emerald-50'
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900">{scenario.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{scenario.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Login Screen
const LoginScreen = ({ onLogin }: { onLogin: () => void }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-8">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center"
    >
      {/* Logo */}
      <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#00297A] to-[#00D4AA] flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/20">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">Apex Financial Services</h1>
      <p className="text-lg text-gray-400 mb-2">Customer 360 Platform</p>
      <p className="text-sm text-gray-500 mb-10">Powered by Atlas AI</p>

      <button
        onClick={onLogin}
        className="group relative px-8 py-4 bg-white text-gray-900 font-semibold rounded-xl hover:bg-gray-100 transition-all shadow-xl hover:shadow-2xl flex items-center gap-3 mx-auto"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#007DC1"/>
          <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z" fill="white"/>
        </svg>
        Sign in with Okta
      </button>

      <p className="text-xs text-gray-500 mt-12">
        Enterprise Identity &amp; Access Management
      </p>
    </motion.div>

    {/* Background decoration */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
    </div>
  </div>
);

// Main App Component
export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user] = useState<User>(DEMO_USER);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [tokens, setTokens] = useState<TokenData | null>(null);
  const [currentTool, setCurrentTool] = useState<string>('');
  const [expandedTokens, setExpandedTokens] = useState({ id: false, jag: false, mcp: false });
  
  const [flowState, setFlowState] = useState<FlowState>({
    rep: 'idle',
    okta: 'idle',
    agent: 'idle',
    security: 'idle',
    mcp: 'idle',
    currentStep: 0,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://okta-ai-agent-backend.onrender.com';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const resetFlow = () => {
    setFlowState({
      rep: 'idle',
      okta: 'idle',
      agent: 'idle',
      security: 'idle',
      mcp: 'idle',
      currentStep: 0,
    });
  };

  const animateFlow = async (hasError = false) => {
    // Step 1: Rep initiates
    setFlowState(prev => ({ ...prev, rep: 'active', currentStep: 1 }));
    await new Promise(r => setTimeout(r, 400));
    setFlowState(prev => ({ ...prev, rep: 'success', okta: 'active', currentStep: 2 }));
    
    // Step 2: Okta SSO
    await new Promise(r => setTimeout(r, 400));
    setFlowState(prev => ({ ...prev, okta: 'success', agent: 'active', currentStep: 3 }));
    
    // Step 3: Agent processing
    await new Promise(r => setTimeout(r, 400));
    setFlowState(prev => ({ ...prev, agent: 'success', security: 'active', currentStep: 4 }));
    
    // Step 4: Security check
    await new Promise(r => setTimeout(r, 400));
    setFlowState(prev => ({ ...prev, security: 'success', mcp: 'active', currentStep: 5 }));
    
    // Step 5: MCP execution
    await new Promise(r => setTimeout(r, 400));
    setFlowState(prev => ({ 
      ...prev, 
      mcp: hasError ? 'error' : 'success', 
      currentStep: 6 
    }));
  };

  const handleNewSession = () => {
    setMessages([]);
    setInput('');
    setTokens(null);
    setCurrentTool('');
    resetFlow();
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    handleNewSession();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    await sendMessage(input.trim());
  };

  const sendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    resetFlow();

    // Determine tool based on query
    let tool = 'get_customer';
    if (content.toLowerCase().includes('payment') || content.toLowerCase().includes('refund')) {
      tool = 'initiate_payment';
    } else if (content.toLowerCase().includes('document') || content.toLowerCase().includes('search')) {
      tool = 'search_documents';
    }
    setCurrentTool(tool);

    // Check for error case
    const hasError = content.toLowerCase().includes('charlie');

    // Generate tokens
    const newTokens = generateTokens(user, content, tool);
    setTokens(newTokens);

    // Start flow animation
    animateFlow(hasError);

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to connect to backend'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Show login screen if not logged in
  if (!isLoggedIn) {
    return <LoginScreen onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo & Company */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00297A] to-[#00D4AA] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Apex Financial Services</h1>
                <p className="text-xs text-gray-400">Customer 360 Platform</p>
              </div>
            </div>

            {/* User & Logout */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                  {user.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-gray-400">{user.role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - 3 Column Layout */}
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 max-w-[1920px] mx-auto w-full flex">
          
          {/* Column 1: Chat */}
          <div className="w-[500px] flex flex-col border-r border-white/10 bg-slate-800/50">
            {/* Chat Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-white font-semibold">Atlas AI Assistant</h2>
                  <p className="text-xs text-gray-400">Secure Enterprise Agent</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPromptLibrary(true)}
                  className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                >
                  📚 Prompts
                </button>
                {messages.length > 0 && (
                  <button
                    onClick={handleNewSession}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    New Chat
                  </button>
                )}
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-white font-semibold mb-2">Welcome, {user.name.split(' ')[0]}!</h3>
                  <p className="text-gray-400 text-sm mb-6 max-w-xs">
                    How can I help you with customer support today?
                  </p>
                  <div className="grid gap-2 w-full max-w-sm">
                    {DEMO_SCENARIOS.slice(0, 3).map((scenario, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendMessage(scenario.query)}
                        className="p-3 text-left rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                      >
                        <p className="text-sm text-white">{scenario.label}</p>
                        <p className="text-xs text-gray-500">{scenario.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                        <div className={`rounded-2xl px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white'
                            : 'bg-white/10 text-gray-100'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 px-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/10 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" />
                            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                          </div>
                          <span className="text-sm text-gray-400">Processing...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-white/10">
              <form onSubmit={handleSubmit} className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about customers, payments, or policies..."
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  Send
                </button>
              </form>
            </div>
          </div>

          {/* Column 2: Visual Flow */}
          <div className="flex-1 flex flex-col bg-gradient-to-b from-slate-800/50 to-slate-900/50 border-r border-white/10">
            <div className="px-6 py-4 border-b border-white/10">
              <h2 className="text-white font-semibold">Security Flow</h2>
              <p className="text-xs text-gray-400">Real-time request visualization</p>
            </div>
            
            <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
              {/* Flow Nodes */}
              <FlowNode
                status={flowState.rep}
                label={user.name}
                sublabel={user.role}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                }
              />

              <FlowNode
                status={flowState.okta}
                label="Okta SSO"
                sublabel="Identity Provider"
                icon={
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                }
              />

              <FlowNode
                status={flowState.agent}
                label="Atlas"
                sublabel="AI Agent (Claude)"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              />

              <FlowNode
                status={flowState.security}
                label="Okta for AI Agents"
                sublabel="XAA • FGA • CIBA"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                }
              />

              <FlowNode
                status={flowState.mcp}
                label="MCP Server"
                sublabel="apex-customers-mcp"
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                  </svg>
                }
                tools={MCP_TOOLS}
                isLast
              />
            </div>
          </div>

          {/* Column 3: Token Details */}
          <div className="w-[400px] flex flex-col bg-slate-800/30">
            <div className="px-6 py-4 border-b border-white/10">
              <h2 className="text-white font-semibold">Token Details</h2>
              <p className="text-xs text-gray-400">Live security context</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Current Tool */}
              {currentTool && (
                <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                    <span className="text-xs font-medium text-violet-300">Active Tool</span>
                  </div>
                  <p className="text-sm text-white font-mono">{currentTool}</p>
                </div>
              )}

              {/* ID Token */}
              <TokenPanel
                title="ID Token (Okta)"
                token={tokens?.id_token.raw || 'Waiting for request...'}
                decoded={tokens?.id_token.decoded}
                isExpanded={expandedTokens.id}
                onToggle={() => setExpandedTokens(prev => ({ ...prev, id: !prev.id }))}
              />

              {/* ID-JAG Token */}
              <TokenPanel
                title="ID-JAG Token (Agent Grant)"
                token={tokens?.id_jag_token.raw || 'Waiting for request...'}
                decoded={tokens?.id_jag_token.decoded}
                isExpanded={expandedTokens.jag}
                onToggle={() => setExpandedTokens(prev => ({ ...prev, jag: !prev.jag }))}
              />

              {/* MCP Access Token */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setExpandedTokens(prev => ({ ...prev, mcp: !prev.mcp }))}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium text-gray-900">MCP Access Token</span>
                  </div>
                  <svg 
                    className={`w-4 h-4 text-gray-400 transition-transform ${expandedTokens.mcp ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                <AnimatePresence>
                  {expandedTokens.mcp && tokens && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-100"
                    >
                      <div className="p-4 space-y-3">
                        <div className="bg-gray-100 rounded-lg p-3">
                          <p className="text-xs text-gray-600 font-mono break-all">
                            {tokens.mcp_access_token.raw}
                          </p>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Scope</span>
                          <span className="text-emerald-600 font-mono">{tokens.mcp_access_token.scope}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Expires In</span>
                          <span className="text-gray-700">{tokens.mcp_access_token.expires_in}s</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Security Info */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mt-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-300">Secure Cross-App Access</p>
                    <p className="text-xs text-emerald-400/70 mt-1">
                      ID tokens never exposed to MCP server. Only short-lived, scoped access tokens are used.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Prominent Footer */}
      <footer className="bg-slate-950 border-t border-white/10">
        <div className="max-w-[1920px] mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            {/* Left: Demo Attribution */}
            <div className="flex items-center gap-6">
              <div>
                <p className="text-white font-semibold">AI Agent Security Demo</p>
                <p className="text-sm text-gray-400">
                  Built by <span className="text-emerald-400">Kundan Kolhe</span> • Product Marketing, Okta
                </p>
              </div>
            </div>

            {/* Center: Security Features */}
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Cross-App Access</p>
                <p className="text-sm text-white font-medium">XAA</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Fine-Grained Auth</p>
                <p className="text-sm text-white font-medium">FGA</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Step-Up Auth</p>
                <p className="text-sm text-white font-medium">CIBA</p>
              </div>
            </div>

            {/* Right: Secured By Links */}
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-500">Secured by</span>
              <a 
                href="https://www.okta.com/solutions/secure-ai/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#007DC1"/>
                  <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z" fill="white"/>
                </svg>
                <span className="text-sm text-white font-medium">Okta Secures AI</span>
              </a>
              <a 
                href="https://auth0.com/ai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <span className="text-orange-500 font-bold text-lg">a0</span>
                <span className="text-sm text-white font-medium">Auth0 for AI</span>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Prompt Library Modal */}
      <AnimatePresence>
        {showPromptLibrary && (
          <PromptLibrary 
            onSelect={sendMessage} 
            onClose={() => setShowPromptLibrary(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
