'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, Send, Shield, Key, Clock, CheckCircle, AlertTriangle, 
  XCircle, Copy, Check, RefreshCw, BookOpen, FileText, 
  ChevronDown, ChevronRight, LogOut, Zap, Lock, Server
} from 'lucide-react';
import { Message, SecurityContext, AuditEntry, DecodedToken, XAAStep } from '@/types';
import { sendChatMessage, checkBackendHealth } from '@/lib/api';
import PromptLibrary from '@/components/PromptLibrary';

// Decode JWT token
function decodeToken(token: string): DecodedToken | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

// Truncate token for display
function truncateToken(token: string, length: number = 40): string {
  if (!token || token.length <= length) return token;
  return `${token.slice(0, length / 2)}...${token.slice(-length / 2)}`;
}

// Copy to clipboard hook
function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return { copied, copy };
}

// Default XAA steps
const DEFAULT_XAA_STEPS: XAAStep[] = [
  { step: 1, name: 'ID Token Received', description: 'Frontend sends ID token', status: 'pending' },
  { step: 2, name: 'ID-JAG Exchange', description: 'Backend exchanges for ID-JAG', status: 'pending' },
  { step: 3, name: 'MCP Access Token', description: 'Get scoped MCP token', status: 'pending' },
  { step: 4, name: 'Tool Execution', description: 'Execute with authorization', status: 'pending' },
];

export default function Home() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'healthy' | 'degraded' | 'offline'>('checking');
  const [activeTab, setActiveTab] = useState<'chat' | 'audit'>('chat');
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [currentSecurityContext, setCurrentSecurityContext] = useState<SecurityContext | null>(null);
  const [xaaSteps, setXaaSteps] = useState<XAAStep[]>(DEFAULT_XAA_STEPS);
  const [expandedPanels, setExpandedPanels] = useState({
    idToken: true,
    xaaFlow: true,
    security: true,
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { copied: tokenCopied, copy: copyToken } = useCopyToClipboard();

  // Check backend health
  const checkHealth = useCallback(async () => {
    setBackendStatus('checking');
    try {
      await checkBackendHealth();
      setBackendStatus('healthy');
    } catch {
      setBackendStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle chat submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Reset and animate XAA steps
    setXaaSteps(DEFAULT_XAA_STEPS.map(s => ({ ...s, status: 'pending' as const })));

    try {
      // Step 1: ID Token
      setXaaSteps(prev => prev.map((s, i) => 
        i === 0 ? { ...s, status: 'success' as const, timestamp: new Date().toISOString() } : 
        i === 1 ? { ...s, status: 'active' as const } : s
      ));

      await new Promise(r => setTimeout(r, 300));

      // Make API call
      const response = await sendChatMessage(
        userMessage.content,
        session?.idToken,
        session?.user?.id
      );

      // Step 2: ID-JAG Exchange
      setXaaSteps(prev => prev.map((s, i) => 
        i <= 1 ? { ...s, status: 'success' as const, timestamp: new Date().toISOString() } : 
        i === 2 ? { ...s, status: 'active' as const } : s
      ));

      await new Promise(r => setTimeout(r, 200));

      // Step 3: MCP Access Token
      setXaaSteps(prev => prev.map((s, i) => 
        i <= 2 ? { ...s, status: 'success' as const, timestamp: new Date().toISOString() } : 
        i === 3 ? { ...s, status: 'active' as const } : s
      ));

      await new Promise(r => setTimeout(r, 200));

      // Step 4: Tool Execution
      setXaaSteps(prev => prev.map(s => ({ ...s, status: 'success' as const, timestamp: new Date().toISOString() })));

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        securityContext: response.security_context,
      };

      setMessages(prev => [...prev, assistantMessage]);
      setCurrentSecurityContext(response.security_context || null);

      // Add to audit log
      if (response.security_context) {
        const entry: AuditEntry = {
          id: Date.now().toString(),
          timestamp: new Date(),
          action: response.security_context.tools_called?.[0] || 'chat',
          user: session?.user?.email || 'anonymous',
          resource: response.security_context.mcp_server || 'default',
          result: response.security_context.fga_result?.allowed !== false ? 'allowed' : 'denied',
          details: `Scope: ${response.security_context.scope || 'N/A'}`,
        };
        setAuditLog(prev => [entry, ...prev]);
      }
    } catch (error) {
      setXaaSteps(prev => prev.map((s, i) => 
        s.status === 'active' ? { ...s, status: 'error' as const } : s
      ));

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle prompt selection from library
  const handlePromptSelect = (prompt: string) => {
    setInput(prompt);
    setShowPromptLibrary(false);
  };

  // Toggle panel expansion
  const togglePanel = (panel: keyof typeof expandedPanels) => {
    setExpandedPanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  };

  // Decode user's ID token
  const decodedIdToken = session?.idToken ? decodeToken(session.idToken) : null;

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-okta-teal border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Login screen
  if (!session) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="glass-card rounded-2xl p-8 text-center">
            {/* Logo */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-okta-teal to-okta-purple flex items-center justify-center">
              <Shield className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">Apex Customer 360</h1>
            <p className="text-gray-400 mb-8">AI-powered customer support with enterprise security</p>

            {/* Features */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-3 rounded-xl bg-white/5">
                <Zap className="w-5 h-5 text-okta-teal mx-auto mb-2" />
                <p className="text-xs text-gray-400">XAA</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <Lock className="w-5 h-5 text-okta-purple mx-auto mb-2" />
                <p className="text-xs text-gray-400">FGA</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <Shield className="w-5 h-5 text-success mx-auto mb-2" />
                <p className="text-xs text-gray-400">CIBA</p>
              </div>
            </div>

            {/* Sign in button */}
            <button
              onClick={() => signIn('okta')}
              className="w-full py-4 px-6 bg-gradient-to-r from-okta-teal to-okta-purple text-white font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
                <circle cx="12" cy="12" r="4" fill="currentColor"/>
              </svg>
              Sign in with Okta
            </button>

            <p className="mt-6 text-xs text-gray-500">
              Secured by Okta Identity • Enterprise SSO
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Main chat interface
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6 py-3 flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-okta-teal to-okta-purple flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Apex Customer 360</h1>
              <p className="text-xs text-gray-500">AI Agent Security Demo</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {/* Prompt Library */}
            <button
              onClick={() => setShowPromptLibrary(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm text-gray-300"
            >
              <BookOpen className="w-4 h-4" />
              Prompts
            </button>

            {/* Backend Status */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
              <div className={`w-2 h-2 rounded-full ${
                backendStatus === 'healthy' ? 'bg-success' :
                backendStatus === 'degraded' ? 'bg-warning' :
                backendStatus === 'offline' ? 'bg-danger' : 'bg-gray-500'
              }`} />
              <span className="text-xs text-gray-400">
                {backendStatus === 'checking' ? 'Connecting...' :
                 backendStatus === 'healthy' ? 'Online' :
                 backendStatus === 'degraded' ? 'Degraded' : 'Offline'}
              </span>
              <button onClick={checkHealth} className="p-1 hover:bg-white/10 rounded transition-colors">
                <RefreshCw className={`w-3 h-3 text-gray-400 ${backendStatus === 'checking' ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* User Info */}
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-right">
                <p className="text-sm font-medium text-white">{session.user?.name}</p>
                <p className="text-xs text-gray-500">{session.user?.email}</p>
              </div>
              <button
                onClick={() => signOut()}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 max-w-[1800px] mx-auto w-full flex">
          
          {/* Left Panel - Chat */}
          <div className="flex-1 flex flex-col border-r border-white/5">
            {/* Tab Navigation */}
            <div className="border-b border-white/5 px-6">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'chat'
                      ? 'border-okta-teal text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Bot className="w-4 h-4 inline mr-2" />
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'audit'
                      ? 'border-okta-teal text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <FileText className="w-4 h-4 inline mr-2" />
                  Audit Trail
                  {auditLog.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 bg-okta-teal/20 text-okta-teal rounded text-xs">
                      {auditLog.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {activeTab === 'chat' ? (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-okta-teal/20 to-okta-purple/20 flex items-center justify-center mb-4">
                        <Bot className="w-8 h-8 text-okta-teal" />
                      </div>
                      <h2 className="text-xl font-semibold text-white mb-2">Welcome to Atlas AI</h2>
                      <p className="text-gray-400 max-w-md">
                        Your secure AI assistant for customer support. Try asking about customers, payments, or policies.
                      </p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-gradient-to-r from-okta-teal to-okta-purple text-white'
                            : message.role === 'system'
                            ? 'bg-danger/20 text-danger border border-danger/30'
                            : 'bg-white/5 text-gray-100'
                        }`}>
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs mt-2 opacity-50">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </motion.div>
                    ))
                  )}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-okta-teal rounded-full animate-bounce" />
                            <span className="w-2 h-2 bg-okta-teal rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                            <span className="w-2 h-2 bg-okta-teal rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                          </div>
                          <span className="text-sm text-gray-400">Atlas is thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-white/5 p-4">
                  <form onSubmit={handleSubmit} className="flex gap-3">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask about customers, payments, or policies..."
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-okta-teal focus:border-transparent"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !input.trim()}
                      className="px-6 py-3 bg-gradient-to-r from-okta-teal to-okta-purple text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Send
                    </button>
                  </form>
                </div>
              </>
            ) : (
              /* Audit Trail Tab */
              <div className="flex-1 overflow-y-auto p-6">
                {auditLog.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <FileText className="w-12 h-12 text-gray-600 mb-4" />
                    <p className="text-gray-400">No audit entries yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditLog.map((entry) => (
                      <div key={entry.id} className="p-4 bg-white/5 rounded-xl border border-white/5">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              entry.result === 'allowed' ? 'bg-success/20 text-success' :
                              entry.result === 'denied' ? 'bg-danger/20 text-danger' :
                              'bg-warning/20 text-warning'
                            }`}>
                              {entry.result.toUpperCase()}
                            </span>
                            <span className="text-sm text-white font-medium">{entry.action}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {entry.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 space-y-1">
                          <p>User: {entry.user}</p>
                          <p>Resource: {entry.resource}</p>
                          {entry.details && <p>{entry.details}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel - Security */}
          <div className="w-[400px] flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* ID Token Panel */}
              <div className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePanel('idToken')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-okta-teal" />
                    <span className="text-sm font-medium text-white">ID Token</span>
                  </div>
                  {expandedPanels.idToken ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                
                <AnimatePresence>
                  {expandedPanels.idToken && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5"
                    >
                      <div className="p-4 space-y-3">
                        {decodedIdToken ? (
                          <>
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Subject</span>
                                <span className="text-gray-300 font-mono">{decodedIdToken.sub}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Email</span>
                                <span className="text-gray-300">{decodedIdToken.email}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Issuer</span>
                                <span className="text-gray-300 font-mono truncate max-w-[200px]">{decodedIdToken.iss}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Expires</span>
                                <span className="text-gray-300">
                                  {decodedIdToken.exp ? new Date(decodedIdToken.exp * 1000).toLocaleString() : 'N/A'}
                                </span>
                              </div>
                            </div>
                            <div className="pt-3 border-t border-white/5">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-500">Raw Token</span>
                                <button
                                  onClick={() => session?.idToken && copyToken(session.idToken)}
                                  className="p-1 hover:bg-white/10 rounded transition-colors"
                                >
                                  {tokenCopied ? (
                                    <Check className="w-3 h-3 text-success" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-gray-400" />
                                  )}
                                </button>
                              </div>
                              <p className="token-display text-gray-400 bg-black/30 p-2 rounded">
                                {truncateToken(session?.idToken || '', 60)}
                              </p>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500">No token available</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* XAA Flow Panel */}
              <div className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePanel('xaaFlow')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-okta-purple" />
                    <span className="text-sm font-medium text-white">XAA Flow</span>
                  </div>
                  {expandedPanels.xaaFlow ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                
                <AnimatePresence>
                  {expandedPanels.xaaFlow && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5"
                    >
                      <div className="p-4 space-y-3">
                        {xaaSteps.map((step, index) => (
                          <motion.div
                            key={step.step}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`flex items-start gap-3 p-3 rounded-lg ${
                              step.status === 'active' ? 'bg-okta-teal/10 border border-okta-teal/30' :
                              step.status === 'success' ? 'bg-success/5' :
                              step.status === 'error' ? 'bg-danger/10' :
                              'bg-white/5'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                              step.status === 'success' ? 'bg-success' :
                              step.status === 'error' ? 'bg-danger' :
                              step.status === 'active' ? 'bg-okta-teal animate-pulse' :
                              'bg-gray-600'
                            }`}>
                              {step.status === 'success' ? (
                                <CheckCircle className="w-4 h-4 text-white" />
                              ) : step.status === 'error' ? (
                                <XCircle className="w-4 h-4 text-white" />
                              ) : step.status === 'active' ? (
                                <Clock className="w-4 h-4 text-white animate-spin" />
                              ) : (
                                <span className="text-xs text-white font-medium">{step.step}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${
                                step.status === 'error' ? 'text-danger' :
                                step.status === 'success' ? 'text-white' :
                                step.status === 'active' ? 'text-okta-teal' :
                                'text-gray-400'
                              }`}>
                                {step.name}
                              </p>
                              <p className="text-xs text-gray-500">{step.description}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Security Context Panel */}
              <div className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={() => togglePanel('security')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-success" />
                    <span className="text-sm font-medium text-white">Security Context</span>
                  </div>
                  {expandedPanels.security ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                
                <AnimatePresence>
                  {expandedPanels.security && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5"
                    >
                      <div className="p-4 space-y-3">
                        {currentSecurityContext ? (
                          <>
                            {currentSecurityContext.mcp_server && (
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">MCP Server</span>
                                <span className="px-2 py-0.5 bg-okta-teal/20 text-okta-teal rounded">
                                  {currentSecurityContext.mcp_server}
                                </span>
                              </div>
                            )}
                            {currentSecurityContext.tools_called && currentSecurityContext.tools_called.length > 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Tools</span>
                                <span className="text-gray-300">{currentSecurityContext.tools_called.join(', ')}</span>
                              </div>
                            )}
                            {currentSecurityContext.scope && (
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Scope</span>
                                <span className="text-gray-300 font-mono">{currentSecurityContext.scope}</span>
                              </div>
                            )}
                            {currentSecurityContext.expires_in && (
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Expires In</span>
                                <span className="text-gray-300">{currentSecurityContext.expires_in}s</span>
                              </div>
                            )}
                            {currentSecurityContext.fga_result && (
                              <div className="pt-3 border-t border-white/5">
                                <div className="flex items-center gap-2 mb-2">
                                  <Shield className="w-3 h-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">FGA Result</span>
                                </div>
                                <div className={`p-2 rounded text-xs ${
                                  currentSecurityContext.fga_result.allowed 
                                    ? 'bg-success/10 text-success' 
                                    : 'bg-danger/10 text-danger'
                                }`}>
                                  {currentSecurityContext.fga_result.allowed ? '✓ Allowed' : '✗ Denied'}: 
                                  {currentSecurityContext.fga_result.user} → {currentSecurityContext.fga_result.relation} → {currentSecurityContext.fga_result.object}
                                </div>
                              </div>
                            )}
                            {currentSecurityContext.ciba_status && currentSecurityContext.ciba_status.triggered && (
                              <div className="pt-3 border-t border-white/5">
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertTriangle className="w-3 h-3 text-warning" />
                                  <span className="text-xs text-gray-500">CIBA Step-Up</span>
                                </div>
                                <div className={`p-2 rounded text-xs ${
                                  currentSecurityContext.ciba_status.status === 'approved' 
                                    ? 'bg-success/10 text-success' 
                                    : currentSecurityContext.ciba_status.status === 'denied'
                                    ? 'bg-danger/10 text-danger'
                                    : 'bg-warning/10 text-warning'
                                }`}>
                                  {currentSecurityContext.ciba_status.status.toUpperCase()}
                                  {currentSecurityContext.ciba_status.reason && `: ${currentSecurityContext.ciba_status.reason}`}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-gray-500 text-center py-4">
                            Send a message to see security context
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Environment Info */}
              <div className="glass-card rounded-xl p-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Environment</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tenant</span>
                    <span className="text-gray-300 font-mono">qa-aiagentsproducttc1</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Agent</span>
                    <span className="text-gray-300 font-mono">KK Demo Agent</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Auth Server</span>
                    <span className="text-gray-300 font-mono">default</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Prompt Library Modal */}
      {showPromptLibrary && (
        <PromptLibrary
          onSelect={handlePromptSelect}
          onClose={() => setShowPromptLibrary(false)}
        />
      )}
    </div>
  );
}
