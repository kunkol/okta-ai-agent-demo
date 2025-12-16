'use client';

import { useSession, signIn } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import MessageBubble from '@/components/MessageBubble';
import IDTokenDetails from '@/components/IDTokenDetails';
import MCPFlow from '@/components/MCPFlow';
import SystemStatus from '@/components/SystemStatus';
import PromptLibrary from '@/components/PromptLibrary';
import { Message, MCPInfo } from '@/types';
import { sendChatMessage } from '@/lib/api';

// Extend Session type
declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    idToken?: string;
  }
}

export default function Home() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [currentMcpInfo, setCurrentMcpInfo] = useState<MCPInfo | undefined>();
  const [lastQuery, setLastQuery] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add welcome message on first load
  useEffect(() => {
    if (session && messages.length === 0) {
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: `Welcome to Apex Customer 360! I'm Atlas, your AI assistant.\n\nI can help you with:\n• Customer lookups and account details\n• Order history and support tickets\n• Account management tasks\n\nHow can I assist you today?`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [session, messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLastQuery(input.trim());
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage(
        userMessage.content,
        session?.accessToken,
        session?.idToken
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        mcpInfo: response.mcp_info,
        securityFlow: response.security_flow,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      if (response.mcp_info) {
        setCurrentMcpInfo(response.mcp_info);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPrompt = (prompt: string) => {
    setInput(prompt);
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Login page
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          {/* Logo */}
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Apex Customer 360</h1>
          <p className="text-gray-600 mb-8">AI-Powered Customer Support Platform</p>

          {/* Sign In Button */}
          <button
            onClick={() => signIn('okta')}
            className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
              <circle cx="12" cy="12" r="5"/>
            </svg>
            Sign in with Okta
          </button>

          {/* Security badges */}
          <div className="mt-8 flex items-center justify-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <span>🔒</span> Enterprise SSO
            </span>
            <span className="flex items-center gap-1">
              <span>✓</span> Secure
            </span>
            <span className="flex items-center gap-1">
              <span>✓</span> Compliant
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Main chat interface
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <Header
        userName={session.user?.name || ''}
        userEmail={session.user?.email || ''}
        onPromptLibraryClick={() => setShowPromptLibrary(true)}
      />

      {/* Main Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-180px)]">
          {/* Chat Interface - Left */}
          <div className="lg:col-span-2 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex justify-start mb-4">
                  <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-4 bg-white">
              <form onSubmit={handleSubmit} className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything about Apex customers, orders, or support..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-xl transition-colors"
                >
                  Send
                </button>
              </form>
              <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                <div className="flex items-center gap-4">
                  <span>🔒 Secure chat</span>
                  <span>🔐 End-to-end encrypted</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Powered by AI</span>
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                </div>
              </div>
            </div>
          </div>

          {/* Security Panel - Right */}
          <div className="space-y-4 overflow-y-auto">
            <IDTokenDetails idToken={session.idToken} />
            <MCPFlow mcpInfo={currentMcpInfo} query={lastQuery} />
            <SystemStatus isOnline={true} isAuthenticated={!!session} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-4">
        <p className="text-center text-sm text-gray-500">
          © 2024 Apex Corporation. AI-powered customer support.
        </p>
      </footer>

      {/* Prompt Library Modal */}
      <PromptLibrary
        isOpen={showPromptLibrary}
        onClose={() => setShowPromptLibrary(false)}
        onSelectPrompt={handleSelectPrompt}
      />
    </div>
  );
}
