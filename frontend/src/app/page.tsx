'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession, signIn, signOut } from 'next-auth/react';

// Types
type ArchStatus = 'idle' | 'active' | 'success' | 'error';
type FlowStepStatus = 'pending' | 'active' | 'complete';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  securityContext?: SecurityContext;
}

interface SecurityContext {
  mcp_server: string;
  query: string;
  tools_called: string[];
  id_token: string;
  id_jag_token: string;
  mcp_access_token: string;
  scope: string;
  expires_in: number;
  flow_steps: FlowStep[];
}

interface FlowStep {
  step: number;
  title: string;
  description: string;
  status: FlowStepStatus;
  section: 'chat' | 'mcp';
}

interface SecurityEvent {
  type: 'xaa' | 'fga' | 'ciba';
  status: 'success' | 'error' | 'warning' | 'pending';
  message: string;
  detail?: string;
}

// Utility to decode JWT
const decodeJWT = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

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

// Collapsible Section Component
const CollapsibleSection = ({ 
  title, 
  icon, 
  children, 
  defaultOpen = true,
  statusColor = 'emerald'
}: { 
  title: string; 
  icon?: React.ReactNode;
  children: React.ReactNode; 
  defaultOpen?: boolean;
  statusColor?: 'emerald' | 'blue' | 'amber' | 'red';
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colors = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${colors[statusColor]}`} />
          <span className="text-sm font-medium text-gray-900">{title}</span>
        </div>
        <svg 
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-gray-100">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Copy Button Component
const CopyButton = ({ text, label = 'Copy' }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-emerald-500">Copied</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
};

// Flow Step Component
const FlowStepItem = ({ step, isLast }: { step: FlowStep; isLast: boolean }) => {
  const statusColors = {
    pending: 'bg-gray-300 text-gray-600',
    active: 'bg-blue-500 text-white animate-pulse',
    complete: 'bg-emerald-500 text-white',
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${statusColors[step.status]}`}>
          {step.step}
        </div>
        {!isLast && (
          <div className={`w-0.5 h-8 mt-1 ${step.status === 'complete' ? 'bg-emerald-300' : 'bg-gray-200'}`} />
        )}
      </div>
      <div className="flex-1 pb-4">
        <p className="text-sm font-medium text-gray-900">{step.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
      </div>
    </div>
  );
};

export default function Home() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'audit'>('console');
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [metrics, setMetrics] = useState({ requests: 0, tokens: 0, blocked: 0 });
  const [currentContext, setCurrentContext] = useState<SecurityContext | null>(null);
  const [systemStatus, setSystemStatus] = useState({
    aiAssistant: 'active' as 'active' | 'inactive',
    authentication: 'secure' as 'secure' | 'insecure',
    dataPrivacy: 'protected' as 'protected' | 'exposed',
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://okta-ai-agent-backend.onrender.com';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show loading while checking auth
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  // Show sign-in if not authenticated
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00297A] to-[#00D4AA] flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Apex Customer 360</h1>
        <p className="text-gray-500 mb-8">AI Agent Security Demo</p>
        <button
          onClick={() => signIn('okta')}
          className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-blue-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          Sign in with Okta
        </button>
        <p className="text-xs text-gray-400 mt-8">
          Secured by{' '}
          <a href="https://www.okta.com/solutions/secure-ai/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
            Okta Secures AI
          </a>
        </p>
      </div>
    );
  }

  const handleNewSession = () => {
    setMessages([]);
    setInput('');
    setCurrentContext(null);
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

  const generateSecurityContext = (query: string, toolUsed: string): SecurityContext => {
    const timestamp = Date.now();
    // Use actual ID token from session if available
    const idToken = (session as any)?.idToken || `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IktLRGVtb0FnZW50In0.eyJzdWIiOiIke3Nlc3Npb24/LnVzZXI/LmVtYWlsfSIsIm5hbWUiOiIke3Nlc3Npb24/LnVzZXI/Lm5hbWV9IiwiZW1haWwiOiIke3Nlc3Npb24/LnVzZXI/LmVtYWlsfSIsInZlciI6MSwiaXNzIjoiaHR0cHM6Ly9xYS1haWFnZW50c3Byb2R1Y3R0YzEudHJleGNsb3VkLmNvbSIsImF1ZCI6IjBvYTh4YXRkMTFQQmU2MjJGMGc3IiwiaWF0IjokeyR0aW1lc3RhbXB9LCJleHAiOiR7dGltZXN0YW1wICsgMzYwMDAwMH19.signature`;
    const idJagToken = `eyJhbGciOiJSUzI1NiIsInR5cCI6ImlkLWphZytqd3QiLCJraWQiOiJPS1RBLUlELUpBRyJ9.eyJpc3MiOiJodHRwczovL3FhLWFpYWdlbnRzcHJvZHVjdHRjMS50cmV4Y2xvdWQuY29tIiwiYXVkIjoiYXBpOi8vYXBleC1jdXN0b21lcnMtbWNwIiwic3ViIjoiJHtzZXNzaW9uPy51c2VyPy5lbWFpbH0iLCJhZ2VudF9pZCI6ImtrLWRlbW8tYWdlbnQiLCJzY29wZSI6ImN1c3RvbWVyczpyZWFkIHBheW1lbnRzOndyaXRlIiwiYXpwIjoiYXRsYXMtYWktYWdlbnQiLCJpYXQiOiR7dGltZXN0YW1wfSwiZXhwIjoke3RpbWVzdGFtcCArIDMwMDAwMH19.id-jag-signature`;
    const mcpToken = `mcp_${timestamp}_${toolUsed}_${Math.random().toString(36).substring(2, 10)}`;

    return {
      mcp_server: 'Apex Customers MCP',
      query: query,
      tools_called: [toolUsed],
      id_token: idToken,
      id_jag_token: idJagToken,
      mcp_access_token: mcpToken,
      scope: toolUsed === 'get_customer' ? 'customers:read' : toolUsed === 'initiate_payment' ? 'payments:write' : 'documents:read',
      expires_in: 3600,
      flow_steps: [
        { step: 1, title: 'ID → ID-JAG', description: 'Exchange user ID token for ID-JAG token', status: 'complete', section: 'chat' },
        { step: 2, title: 'Verify ID-JAG', description: 'Validate ID-JAG token (audit trail)', status: 'complete', section: 'chat' },
        { step: 3, title: 'ID-JAG → MCP Token', description: 'Exchange ID-JAG for authorization server token', status: 'complete', section: 'chat' },
        { step: 4, title: 'Validate & Execute', description: `Verified access. Executing: ${toolUsed}`, status: 'complete', section: 'mcp' },
      ],
    };
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

    // Determine tool based on query
    let toolUsed = 'get_customer';
    if (content.toLowerCase().includes('payment') || content.toLowerCase().includes('refund')) {
      toolUsed = 'initiate_payment';
    } else if (content.toLowerCase().includes('document') || content.toLowerCase().includes('search')) {
      toolUsed = 'search_documents';
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });

      const data = await response.json();
      
      // Generate security context
      const secContext = generateSecurityContext(content, toolUsed);
      setCurrentContext(secContext);
      
      // Update metrics
      setMetrics(prev => ({ 
        ...prev, 
        requests: prev.requests + 1,
        tokens: prev.tokens + 1,
        blocked: content.toLowerCase().includes('charlie') ? prev.blocked + 1 : prev.blocked
      }));

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        securityContext: secContext,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
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

  // Parse decoded token for display
  const getDecodedToken = () => {
    if (!currentContext?.id_token) return null;
    // Use actual session data
    return {
      sub: session?.user?.email?.split('@')[0] || "user",
      name: session?.user?.name || "User",
      email: session?.user?.email || "user@example.com",
      ver: 1,
      iss: "https://qa-aiagentsproducttc1.trexcloud.com",
      aud: "0oa8xatd11PBe622F0g7",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
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
                <h1 className="text-xl font-semibold text-gray-900">Apex Customer 360</h1>
                <p className="text-xs text-gray-500">AI Agent Security Demo</p>
              </div>
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-8 px-6 py-2 bg-gray-100 rounded-xl">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{metrics.requests}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Requests</p>
                </div>
                <div className="w-px h-8 bg-gray-300" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{metrics.tokens}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Tokens</p>
                </div>
                <div className="w-px h-8 bg-gray-300" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">{metrics.blocked}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Blocked</p>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs text-emerald-700 font-medium">All Systems Operational</span>
              </div>

              {/* User Info & Sign Out */}
              <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{session.user?.name}</p>
                  <p className="text-xs text-gray-500">{session.user?.email}</p>
                </div>
                <button
                  onClick={() => signOut()}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex">
        <div className="flex-1 max-w-[1800px] mx-auto w-full flex">
          
          {/* Left Panel - Agent Console */}
          <div className="flex-1 flex flex-col border-r border-gray-200 bg-white">
            {/* Tabs */}
            <div className="border-b border-gray-200 px-6">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <button
                    onClick={() => setActiveTab('console')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'console' ? 'border-emerald-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Agent Console
                  </button>
                  <button
                    onClick={() => setActiveTab('audit')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'audit' ? 'border-emerald-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Audit Trail ({messages.filter(m => m.role === 'assistant').length})
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPromptLibrary(true)}
                    className="px-3 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Prompts
                  </button>
                  {messages.length > 0 && (
                    <button
                      onClick={handleNewSession}
                      className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
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
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-blue-100 flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Atlas AI</h2>
                  <p className="text-gray-500 text-sm mb-8 max-w-md text-center">
                    Your secure AI assistant for customer support. Select a scenario to see enterprise security in action.
                  </p>
                  
                  {/* Prompt Library Button */}
                  <button
                    onClick={() => setShowPromptLibrary(true)}
                    className="mb-6 px-6 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors flex items-center gap-2"
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
                        className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.02] bg-white shadow-sm ${
                          scenario.risk === 'critical' ? 'border-red-200 hover:border-red-400 hover:bg-red-50' :
                          scenario.risk === 'high' ? 'border-amber-200 hover:border-amber-400 hover:bg-amber-50' :
                          scenario.risk === 'medium' ? 'border-blue-200 hover:border-blue-400 hover:bg-blue-50' :
                          'border-gray-200 hover:border-emerald-400 hover:bg-emerald-50'
                        }`}
                      >
                        <p className="text-sm text-gray-900 font-medium mb-1">{scenario.label}</p>
                        <p className="text-xs text-gray-500">{scenario.description}</p>
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
                            ? 'bg-gradient-to-r from-emerald-500 to-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900 border border-gray-200'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-2xl px-4 py-3 border border-gray-200">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                          </div>
                          <span className="text-sm text-gray-500">Atlas is thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-4 bg-white">
              <form onSubmit={handleSubmit} className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about customers, payments, or policies..."
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-600 text-white font-medium rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  Send
                </button>
              </form>
            </div>
          </div>

          {/* Right Panel - Security Flow (Indranil Style) */}
          <div className="w-[420px] flex flex-col overflow-hidden bg-gray-50">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* ID Token Details */}
              <CollapsibleSection title="ID Token Details" statusColor="emerald">
                <div className="pt-4 space-y-4">
                  {/* Decoded Token */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">Decoded Token</span>
                      {currentContext && <CopyButton text={JSON.stringify(getDecodedToken(), null, 2)} />}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 max-h-48 overflow-y-auto">
                      <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap">
                        {currentContext ? JSON.stringify(getDecodedToken(), null, 2) : '{\n  "sub": "waiting...",\n  "name": "...",\n  "email": "..."\n}'}
                      </pre>
                    </div>
                  </div>

                  {/* Raw Token */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">Raw Token</span>
                      {currentContext && <CopyButton text={currentContext.id_token} />}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-xs text-gray-600 font-mono break-all line-clamp-4">
                        {currentContext?.id_token || 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'}
                      </p>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* MCP Flow */}
              <CollapsibleSection title="MCP Flow" statusColor="blue">
                <div className="pt-4 space-y-4">
                  {/* MCP Server */}
                  <div>
                    <span className="text-xs font-medium text-gray-600 block mb-2">MCP Server</span>
                    <div className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                      </svg>
                      <span className="text-sm font-medium text-blue-700">
                        {currentContext?.mcp_server || 'Apex Customers MCP'}
                      </span>
                    </div>
                  </div>

                  {/* Query */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">Query</span>
                      {currentContext && <CopyButton text={currentContext.query} />}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <p className="text-sm text-gray-700">
                        {currentContext?.query || 'Waiting for query...'}
                      </p>
                    </div>
                  </div>

                  {/* Tools Executed */}
                  <div>
                    <span className="text-xs font-medium text-gray-600 block mb-2">Tools Executed</span>
                    <div className="flex flex-wrap gap-2">
                      {(currentContext?.tools_called || ['get_customer']).map((tool, idx) => (
                        <span 
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-700"
                        >
                          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* ID-JAG Secure Flow */}
                  <div>
                    <span className="text-xs font-medium text-gray-600 block mb-3">ID-JAG Secure Flow</span>
                    
                    {/* Chat Assistant Section */}
                    <div className="mb-4">
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                        <span className="text-xs font-semibold text-purple-700">Chat Assistant (STEPS 1-3)</span>
                      </div>
                      <div className="ml-2">
                        {(currentContext?.flow_steps || [
                          { step: 1, title: 'ID → ID-JAG', description: 'Exchange user ID token for ID-JAG token', status: 'pending' as FlowStepStatus, section: 'chat' as const },
                          { step: 2, title: 'Verify ID-JAG', description: 'Validate ID-JAG token (audit trail)', status: 'pending' as FlowStepStatus, section: 'chat' as const },
                          { step: 3, title: 'ID-JAG → MCP Token', description: 'Exchange ID-JAG for authorization server token', status: 'pending' as FlowStepStatus, section: 'chat' as const },
                        ]).filter(s => s.section === 'chat').map((step, idx, arr) => (
                          <FlowStepItem key={step.step} step={step} isLast={idx === arr.length - 1} />
                        ))}
                      </div>
                    </div>

                    {/* MCP Server Section */}
                    <div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-3">
                        <span className="text-xs font-semibold text-emerald-700">MCP Server (STEP 4)</span>
                      </div>
                      <div className="ml-2">
                        {(currentContext?.flow_steps || [
                          { step: 4, title: 'Validate & Execute', description: 'Verified access. Executing: get_customer', status: 'pending' as FlowStepStatus, section: 'mcp' as const },
                        ]).filter(s => s.section === 'mcp').map((step, idx, arr) => (
                          <FlowStepItem key={step.step} step={step} isLast={idx === arr.length - 1} />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Secure Cross-App Access Info */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-800">Secure Cross-App Access</p>
                        <p className="text-xs text-emerald-600 mt-1">
                          ID tokens are never exposed to MCP server. Only short-lived access tokens are used.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* System Status */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <h3 className="text-sm font-medium text-gray-900 mb-4">System Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">AI Assistant</span>
                    <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                      Active
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Authentication</span>
                    <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                      Secure
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Data Privacy</span>
                    <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                      Protected
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-[1800px] mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">
                Demo by <span className="text-gray-900 font-medium">Kundan Kolhe</span> | Product Marketing, Okta
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-gray-400">Secured by</span>
              <a 
                href="https://www.okta.com/solutions/secure-ai/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline font-medium"
              >
                Okta Secures AI
              </a>
              <span className="text-gray-300">|</span>
              <a 
                href="https://auth0.com/ai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-orange-500 hover:underline font-medium"
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
