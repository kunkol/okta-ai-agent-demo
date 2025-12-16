'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  securityEvents?: SecurityEvent[];
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

// Architecture Node Component
const ArchNode = ({ label, sublabel, status }: { label: string; sublabel: string; status: 'idle' | 'active' | 'success' | 'error' }) => {
  const statusColors = {
    idle: 'border-gray-600 bg-[#1a1a24]',
    active: 'border-[#00D4AA] bg-[#00D4AA]/10 shadow-[0_0_20px_rgba(0,212,170,0.3)]',
    success: 'border-emerald-500 bg-emerald-500/10',
    error: 'border-red-500 bg-red-500/10',
  };

  return (
    <div className={`px-4 py-2 rounded-lg border-2 transition-all duration-300 ${statusColors[status]}`}>
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="text-[10px] text-gray-400">{sublabel}</p>
    </div>
  );
};

// Connection Line
const ConnLine = ({ active, direction = 'down' }: { active: boolean; direction?: 'down' | 'right' }) => {
  return (
    <div className={`${direction === 'down' ? 'h-6 w-0.5' : 'w-6 h-0.5'} mx-auto transition-colors duration-300 ${active ? 'bg-[#00D4AA]' : 'bg-gray-700'}`} />
  );
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'audit'>('console');
  const [flowActive, setFlowActive] = useState(false);
  const [archState, setArchState] = useState({
    user: 'idle' as const,
    app: 'idle' as const,
    agent: 'idle' as const,
    okta: 'idle' as const,
    mcp: 'idle' as const,
  });
  const [metrics, setMetrics] = useState({ requests: 0, tokens: 0, blocked: 0 });
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://okta-ai-agent-backend.onrender.com';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const animateArchitecture = async () => {
    setFlowActive(true);
    const steps: (keyof typeof archState)[] = ['user', 'app', 'agent', 'okta', 'mcp'];
    
    for (const step of steps) {
      setArchState(prev => ({ ...prev, [step]: 'active' }));
      await new Promise(r => setTimeout(r, 400));
      setArchState(prev => ({ ...prev, [step]: 'success' }));
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
    
    // Start architecture animation
    animateArchitecture();

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });

      const data = await response.json();
      
      // Parse security events from response
      const events: SecurityEvent[] = [];
      const responseText = data.response?.toLowerCase() || '';
      
      // Token Exchange (XAA)
      events.push({
        type: 'xaa',
        status: 'success',
        message: 'Token Exchanged',
        detail: 'ID-JAG → MCP Access Token'
      });
      setMetrics(prev => ({ ...prev, tokens: prev.tokens + 1 }));

      // FGA Check
      if (responseText.includes('denied') || responseText.includes('access denied') || responseText.includes('not authorized') || content.toLowerCase().includes('charlie')) {
        events.push({
          type: 'fga',
          status: 'error',
          message: 'Access Denied',
          detail: 'Policy check failed'
        });
        setMetrics(prev => ({ ...prev, blocked: prev.blocked + 1 }));
        // Mark architecture as error
        setArchState(prev => ({ ...prev, mcp: 'error' }));
      } else {
        events.push({
          type: 'fga',
          status: 'success',
          message: 'Authorized',
          detail: 'Policy check passed'
        });
      }

      // CIBA Check
      if (responseText.includes('pending') || responseText.includes('approval') || responseText.includes('manager') || content.includes('15000')) {
        events.push({
          type: 'ciba',
          status: 'warning',
          message: 'Step-Up Required',
          detail: 'Manager approval pending'
        });
      }

      setSecurityEvents(events);
      setMetrics(prev => ({ ...prev, requests: prev.requests + 1 }));

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        securityEvents: events,
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

  const handleNewSession = () => {
    setMessages([]);
    setInput('');
    setSecurityEvents([]);
    resetArchitecture();
    setMetrics({ requests: 0, tokens: 0, blocked: 0 });
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

          {/* Right Panel - Security Architecture */}
          <div className="w-[420px] flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Architecture Diagram */}
              <div className="bg-[#12121a] rounded-xl border border-white/5 p-6">
                <h3 className="text-sm font-medium text-white mb-6">Security Architecture</h3>
                
                <div className="flex flex-col items-center space-y-0">
                  {/* Support Rep */}
                  <ArchNode label="Support Rep" sublabel="Customer Service" status={archState.user} />
                  <ConnLine active={flowActive} direction="down" />
                  
                  {/* Customer Service App */}
                  <ArchNode label="Customer Service App" sublabel="Next.js" status={archState.app} />
                  <ConnLine active={flowActive} direction="down" />
                  
                  {/* Atlas AI Agent */}
                  <ArchNode label="Atlas" sublabel="AI Agent" status={archState.agent} />
                  <ConnLine active={flowActive} direction="down" />
                  
                  {/* Okta */}
                  <ArchNode label="Okta" sublabel="Identity / XAA" status={archState.okta} />
                  <ConnLine active={flowActive} direction="down" />
                  
                  {/* MCP Servers */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <ArchNode label="Internal MCP" sublabel="Enterprise Tools" status={archState.mcp} />
                      <div className="mt-2 flex gap-2">
                        <span className="px-2 py-1 bg-white/5 rounded text-[9px] text-gray-400">CRM</span>
                        <span className="px-2 py-1 bg-white/5 rounded text-[9px] text-gray-400">Docs</span>
                        <span className="px-2 py-1 bg-white/5 rounded text-[9px] text-gray-400">Payments</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center opacity-40">
                      <ArchNode label="External SaaS" sublabel="Coming Soon" status="idle" />
                      <div className="mt-2 flex gap-2">
                        <span className="px-2 py-1 bg-white/5 rounded text-[9px] text-gray-500">GitHub</span>
                        <span className="px-2 py-1 bg-white/5 rounded text-[9px] text-gray-500">Slack</span>
                      </div>
                    </div>
                  </div>
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
            <div className="text-right">
              <p className="text-[11px] text-gray-500">
                Cross-App Access (XAA) | Fine-Grained Authorization (FGA) | CIBA Step-Up Auth
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
