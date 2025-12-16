'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
type ArchStatus = 'idle' | 'active' | 'success' | 'error';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  securityContext?: SecurityContext;
}

interface SecurityContext {
  mcp_server?: string;
  tools_called?: string[];
  id_jag_token?: string;
  mcp_access_token?: string;
  scope?: string;
  expires_in?: number;
}

interface SecurityEvent {
  type: 'xaa' | 'fga' | 'ciba';
  status: 'success' | 'error' | 'warning' | 'pending';
  message: string;
  detail?: string;
}

// Demo scenarios - All tested against C1/C2 APIs
const DEMO_SCENARIOS = [
  { 
    label: 'Help customer on a call', 
    description: 'Full access - Enterprise tier customer',
    query: 'Get customer information for Alice', 
    risk: 'low',
    category: 'MCP - Customers'
  },
  { 
    label: 'Process standard refund', 
    description: '$5,000 - approved with enhanced monitoring',
    query: 'Initiate a payment of $5000 to Bob Smith', 
    risk: 'medium',
    category: 'MCP - Payments'
  },
  { 
    label: 'Process large refund', 
    description: '$15,000 - requires manager approval (CIBA)',
    query: 'Initiate a payment of $15000 to Bob Smith', 
    risk: 'critical',
    category: 'MCP - Payments'
  },
  { 
    label: 'Search product documentation', 
    description: 'Results filtered by access level (FGA)',
    query: 'Search for documents about security policies', 
    risk: 'low',
    category: 'RAG - Documents'
  },
  { 
    label: 'Access restricted record', 
    description: 'Account under compliance review - denied',
    query: 'Get customer information for Charlie', 
    risk: 'high',
    category: 'MCP - Customers'
  },
  { 
    label: 'View partner account', 
    description: 'Full access - Professional tier customer',
    query: 'Get customer information for Bob', 
    risk: 'low',
    category: 'MCP - Customers'
  },
];

// Prompt Library Modal
const PromptLibrary = ({ onSelect, onClose }: { onSelect: (query: string) => void; onClose: () => void }) => {
  const categories = [
    { name: 'MCP - Customers', prompts: DEMO_SCENARIOS.filter(s => s.category === 'MCP - Customers') },
    { name: 'MCP - Payments', prompts: DEMO_SCENARIOS.filter(s => s.category === 'MCP - Payments') },
    { name: 'RAG - Documents', prompts: DEMO_SCENARIOS.filter(s => s.category === 'RAG - Documents') },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#12121a] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[70vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Prompt Library</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(70vh-80px)]">
          <p className="text-sm text-gray-400 mb-6">
            Select a prompt to test XAA, FGA, and CIBA security scenarios.
          </p>
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category.name}>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">{category.name}</h3>
                <div className="space-y-2">
                  {category.prompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => { onSelect(prompt.query); onClose(); }}
                      className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group"
                    >
                      <p className="text-sm text-white group-hover:text-[#00D4AA] transition-colors">{prompt.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{prompt.description}</p>
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

// Architecture Node Component
const ArchNode = ({ label, sublabel, status, tools }: { label: string; sublabel: string; status: ArchStatus; tools?: string[] }) => {
  const statusColors = {
    idle: 'border-gray-600 bg-[#1a1a24]',
    active: 'border-[#00D4AA] bg-[#00D4AA]/10 shadow-[0_0_20px_rgba(0,212,170,0.3)]',
    success: 'border-emerald-500 bg-emerald-500/10',
    error: 'border-red-500 bg-red-500/10',
  };

  return (
    <div className={`px-4 py-3 rounded-xl border-2 transition-all duration-300 ${statusColors[status]}`}>
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="text-[10px] text-gray-400">{sublabel}</p>
      {tools && tools.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tools.map((tool, i) => (
            <span key={i} className="px-2 py-0.5 bg-white/10 rounded text-[9px] text-gray-300">{tool}</span>
          ))}
        </div>
      )}
    </div>
  );
};

// Token Display Component
const TokenDisplay = ({ label, token, expanded, onToggle }: { label: string; token?: string; expanded: boolean; onToggle: () => void }) => {
  const [copied, setCopied] = useState(false);
  
  const copyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncate = (str: string, len: number) => str.length > len ? `${str.slice(0, len)}...` : str;

  return (
    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <div className="flex items-center gap-2">
          {token && (
            <button onClick={copyToken} className="p-1 hover:bg-white/10 rounded transition-colors">
              {copied ? (
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}
          <button onClick={onToggle} className="p-1 hover:bg-white/10 rounded transition-colors">
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
      <p className="font-mono text-[10px] text-gray-300 break-all">
        {token ? (expanded ? token : truncate(token, 50)) : 'Waiting for request...'}
      </p>
    </div>
  );
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'audit'>('console');
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [flowActive, setFlowActive] = useState(false);
  const [archState, setArchState] = useState<Record<string, ArchStatus>>({
    user: 'idle',
    app: 'idle',
    agent: 'idle',
    okta: 'idle',
    mcp: 'idle',
  });
  const [metrics, setMetrics] = useState({ requests: 0, tokens: 0, blocked: 0 });
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [currentContext, setCurrentContext] = useState<SecurityContext | null>(null);
  const [expandedTokens, setExpandedTokens] = useState({ idJag: false, mcp: false });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://okta-ai-agent-backend.onrender.com';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const animateArchitecture = async (hasError = false) => {
    setFlowActive(true);
    const steps = ['user', 'app', 'agent', 'okta', 'mcp'];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setArchState(prev => ({ ...prev, [step]: 'active' }));
      await new Promise(r => setTimeout(r, 300));
      
      if (hasError && step === 'mcp') {
        setArchState(prev => ({ ...prev, [step]: 'error' }));
      } else {
        setArchState(prev => ({ ...prev, [step]: 'success' }));
      }
    }
  };

  const resetArchitecture = () => {
    setFlowActive(false);
    setArchState({
      user: 'idle',
      app: 'idle',
      agent: 'idle',
      okta: 'idle',
      mcp: 'idle',
    });
  };

  const handleNewSession = () => {
    setMessages([]);
    setInput('');
    setSecurityEvents([]);
    setCurrentContext(null);
    resetArchitecture();
    setMetrics({ requests: 0, tokens: 0, blocked: 0 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    await sendMessage(input.trim());
  };

  const handleScenarioClick = async (query: string) => {
    await sendMessage(query);
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
    setSecurityEvents([]);
    
    // Check if this will be an error case
    const willError = content.toLowerCase().includes('charlie');

    try {
      // Start architecture animation
      animateArchitecture(willError);

      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });

      const data = await response.json();
      
      // Generate simulated tokens (in real implementation, these come from backend)
      const mockIdJag = `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ikt1bmRhbktLRGVtb0FnZW50In0.eyJpc3MiOiJodHRwczovL3FhLWFpYWdlbnRzcHJvZHVjdHRjMS50cmV4Y2xvdWQuY29tIiwiYXVkIjoiYXBpOi8vYXBleC1jdXN0b21lcnMiLCJzdWIiOiIwMHU4dzFrMTZhZWFnc3E2MjBnNyJ9.signature`;
      const mockMcpToken = `mcp_${Date.now()}_customers_read_${Math.random().toString(36).substring(7)}`;
      
      // Set security context
      const secContext: SecurityContext = {
        mcp_server: 'apex-customers-mcp',
        tools_called: ['get_customer'],
        id_jag_token: mockIdJag,
        mcp_access_token: mockMcpToken,
        scope: 'customers:read',
        expires_in: 3600,
      };
      setCurrentContext(secContext);
      
      // Parse security events from response
      const events: SecurityEvent[] = [];
      const responseText = data.response?.toLowerCase() || '';
      
      // Token Exchange (XAA)
      events.push({
        type: 'xaa',
        status: 'success',
        message: 'Token Exchanged',
        detail: 'ID Token → ID-JAG → MCP Access Token'
      });
      setMetrics(prev => ({ ...prev, tokens: prev.tokens + 1 }));

      // FGA Check
      if (responseText.includes('denied') || responseText.includes('access denied') || responseText.includes('not authorized') || content.toLowerCase().includes('charlie')) {
        events.push({
          type: 'fga',
          status: 'error',
          message: 'Access Denied',
          detail: 'FGA policy check failed - compliance hold'
        });
        setMetrics(prev => ({ ...prev, blocked: prev.blocked + 1 }));
      } else {
        events.push({
          type: 'fga',
          status: 'success',
          message: 'Authorized',
          detail: 'FGA policy check passed'
        });
      }

      // CIBA Check
      if (responseText.includes('pending') || responseText.includes('approval') || responseText.includes('manager') || content.includes('15000')) {
        events.push({
          type: 'ciba',
          status: 'warning',
          message: 'Step-Up Required',
          detail: 'Manager approval pending via CIBA'
        });
      }

      setSecurityEvents(events);
      setMetrics(prev => ({ ...prev, requests: prev.requests + 1 }));

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        securityContext: secContext,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      setArchState(prev => ({ ...prev, agent: 'error' }));
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0a0f]/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00297A] to-[#00D4AA] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-white">Apex Customer 360</h1>
                <p className="text-xs text-gray-500">AI Agent Security Demo</p>
              </div>
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-8 px-6 py-2 bg-white/5 rounded-xl">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{metrics.requests}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Requests</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#00D4AA]">{metrics.tokens}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Tokens</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400">{metrics.blocked}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Blocked</p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs text-emerald-400">All Systems Operational</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex">
        <div className="flex-1 max-w-[1800px] mx-auto w-full flex">
          
          {/* Left Panel - Agent Console */}
          <div className="flex-1 flex flex-col border-r border-white/5">
            {/* Tabs */}
            <div className="border-b border-white/5 px-6">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <button
                    onClick={() => setActiveTab('console')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'console' ? 'border-[#00D4AA] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    Agent Console
                  </button>
                  <button
                    onClick={() => setActiveTab('audit')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'audit' ? 'border-[#00D4AA] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    Audit Trail ({messages.filter(m => m.role === 'assistant').length})
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPromptLibrary(true)}
                    className="px-3 py-1.5 text-xs text-[#00D4AA] hover:bg-[#00D4AA]/10 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Prompts
                  </button>
                  {messages.length > 0 && (
                    <button
                      onClick={handleNewSession}
                      className="px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      New Session
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {messages.length === 0 ? (
                /* Scenario Selection */
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00D4AA]/20 to-[#00297A]/20 flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-[#00D4AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-2">Welcome to Atlas AI</h2>
                  <p className="text-gray-400 text-sm mb-8 max-w-md text-center">
                    Your secure AI assistant for customer support. Select a scenario to see enterprise security in action.
                  </p>
                  
                  {/* Prompt Library Button */}
                  <button
                    onClick={() => setShowPromptLibrary(true)}
                    className="mb-6 px-6 py-3 bg-[#00D4AA]/10 border border-[#00D4AA]/30 text-[#00D4AA] rounded-xl hover:bg-[#00D4AA]/20 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Open Prompt Library
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl">
                    {DEMO_SCENARIOS.map((scenario, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleScenarioClick(scenario.query)}
                        className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                          scenario.risk === 'critical' ? 'border-red-500/30 hover:border-red-500/60 hover:bg-red-500/5' :
                          scenario.risk === 'high' ? 'border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5' :
                          scenario.risk === 'medium' ? 'border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5' :
                          'border-white/10 hover:border-[#00D4AA]/40 hover:bg-[#00D4AA]/5'
                        }`}
                      >
                        <p className="text-sm text-white font-medium mb-1">{scenario.label}</p>
                        <p className="text-xs text-gray-400">{scenario.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Chat Messages */
                <div className="space-y-4">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                        {message.role === 'assistant' && (
                          <span className="text-xs text-gray-500 mb-1 block">Atlas</span>
                        )}
                        <div className={`rounded-2xl px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-gradient-to-r from-[#00D4AA] to-[#00297A] text-white'
                            : 'bg-white/5 text-gray-100 border border-white/10'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 rounded-2xl px-4 py-3 border border-white/10">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-[#00D4AA] rounded-full animate-bounce" />
                            <span className="w-2 h-2 bg-[#00D4AA] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                            <span className="w-2 h-2 bg-[#00D4AA] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                          </div>
                          <span className="text-sm text-gray-400">Atlas is thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-white/5 p-4">
              <form onSubmit={handleSubmit} className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about customers, payments, or policies..."
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00D4AA] focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-[#00D4AA] to-[#00297A] text-white font-medium rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  Send
                </button>
              </form>
            </div>
          </div>

          {/* Right Panel - Security Flow */}
          <div className="w-[440px] flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* Security Flow Diagram */}
              <div className="bg-[#12121a] rounded-xl border border-white/5 p-5">
                <h3 className="text-sm font-medium text-white mb-5">Security Flow</h3>
                
                <div className="flex flex-col items-center space-y-2">
                  {/* Support Rep */}
                  <ArchNode label="Support Rep" sublabel="Customer Service" status={archState.user as ArchStatus} />
                  <div className={`h-6 w-0.5 transition-colors ${flowActive ? 'bg-[#00D4AA]' : 'bg-gray-700'}`} />
                  
                  {/* Customer Service App */}
                  <ArchNode label="Apex Customer 360" sublabel="Next.js Frontend" status={archState.app as ArchStatus} />
                  <div className={`h-6 w-0.5 transition-colors ${flowActive ? 'bg-[#00D4AA]' : 'bg-gray-700'}`} />
                  
                  {/* Atlas AI Agent */}
                  <ArchNode label="Atlas" sublabel="AI Agent (Claude)" status={archState.agent as ArchStatus} />
                  <div className={`h-6 w-0.5 transition-colors ${flowActive ? 'bg-[#00D4AA]' : 'bg-gray-700'}`} />
                  
                  {/* Okta */}
                  <ArchNode label="Okta" sublabel="Identity / XAA / FGA" status={archState.okta as ArchStatus} />
                  <div className={`h-6 w-0.5 transition-colors ${flowActive ? 'bg-[#00D4AA]' : 'bg-gray-700'}`} />
                  
                  {/* MCP Server */}
                  <ArchNode 
                    label="Internal MCP Server" 
                    sublabel="apex-customers-mcp" 
                    status={archState.mcp as ArchStatus}
                    tools={['get_customer', 'search_documents', 'initiate_payment']}
                  />
                </div>
              </div>

              {/* Token Details */}
              <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
                <h3 className="text-sm font-medium text-white mb-4">Token Exchange</h3>
                <div className="space-y-3">
                  <TokenDisplay 
                    label="ID-JAG Token" 
                    token={currentContext?.id_jag_token} 
                    expanded={expandedTokens.idJag}
                    onToggle={() => setExpandedTokens(prev => ({ ...prev, idJag: !prev.idJag }))}
                  />
                  <TokenDisplay 
                    label="MCP Access Token" 
                    token={currentContext?.mcp_access_token} 
                    expanded={expandedTokens.mcp}
                    onToggle={() => setExpandedTokens(prev => ({ ...prev, mcp: !prev.mcp }))}
                  />
                  {currentContext?.scope && (
                    <div className="flex items-center justify-between text-xs px-3 py-2 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Scope</span>
                      <span className="text-[#00D4AA] font-mono">{currentContext.scope}</span>
                    </div>
                  )}
                  {currentContext?.expires_in && (
                    <div className="flex items-center justify-between text-xs px-3 py-2 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Expires In</span>
                      <span className="text-gray-300">{currentContext.expires_in}s</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Security Events */}
              <div className="bg-[#12121a] rounded-xl border border-white/5 p-4">
                <h3 className="text-sm font-medium text-white mb-4">Security Events</h3>
                
                {securityEvents.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Run a scenario to see security events</p>
                ) : (
                  <div className="space-y-2">
                    {securityEvents.map((event, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${
                          event.status === 'success' ? 'border-emerald-500/30 bg-emerald-500/5' :
                          event.status === 'error' ? 'border-red-500/30 bg-red-500/5' :
                          event.status === 'warning' ? 'border-amber-500/30 bg-amber-500/5' :
                          'border-white/10 bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              event.status === 'success' ? 'bg-emerald-500' :
                              event.status === 'error' ? 'bg-red-500' :
                              event.status === 'warning' ? 'bg-amber-500' :
                              'bg-gray-500'
                            }`} />
                            <span className="text-xs font-medium text-white">{event.message}</span>
                          </div>
                          <span className={`text-[10px] uppercase tracking-wider ${
                            event.status === 'success' ? 'text-emerald-400' :
                            event.status === 'error' ? 'text-red-400' :
                            event.status === 'warning' ? 'text-amber-400' :
                            'text-gray-400'
                          }`}>
                            {event.type}
                          </span>
                        </div>
                        {event.detail && (
                          <p className="text-[11px] text-gray-400 mt-1 ml-4">{event.detail}</p>
                        )}
                      </div>
                    ))}
                  </div>
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
            <div>
              <p className="text-xs text-gray-400">
                Demo by <span className="text-white">Kundan Kolhe</span> | Product Marketing, Okta
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-gray-500">Secured by</span>
              <a 
                href="https://www.okta.com/solutions/secure-ai/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#00D4AA] hover:underline"
              >
                Okta Secures AI
              </a>
              <span className="text-gray-600">|</span>
              <a 
                href="https://auth0.com/ai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-orange-400 hover:underline"
              >
                Auth0 for AI
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Prompt Library Modal */}
      <AnimatePresence>
        {showPromptLibrary && (
          <PromptLibrary 
            onSelect={handleScenarioClick} 
            onClose={() => setShowPromptLibrary(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
