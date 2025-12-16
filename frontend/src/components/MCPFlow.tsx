// components/MCPFlow.tsx
'use client';

import { useState } from 'react';
import { MCPInfo } from '@/types';

interface MCPFlowProps {
  mcpInfo?: MCPInfo;
  query?: string;
}

export default function MCPFlow({ mcpInfo, query }: MCPFlowProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedQuery, setCopiedQuery] = useState(false);
  const [copiedIdJag, setCopiedIdJag] = useState(false);
  const [copiedMcp, setCopiedMcp] = useState(false);

  const copyToClipboard = async (text: string, type: 'query' | 'idjag' | 'mcp') => {
    await navigator.clipboard.writeText(text);
    if (type === 'query') {
      setCopiedQuery(true);
      setTimeout(() => setCopiedQuery(false), 2000);
    } else if (type === 'idjag') {
      setCopiedIdJag(true);
      setTimeout(() => setCopiedIdJag(false), 2000);
    } else {
      setCopiedMcp(true);
      setTimeout(() => setCopiedMcp(false), 2000);
    }
  };

  // ID-JAG Steps
  const idJagSteps = [
    {
      step: 1,
      title: 'ID → ID-JAG',
      description: 'Exchange user ID token for ID-JAG token',
      section: 'chat-assistant',
    },
    {
      step: 2,
      title: 'Verify ID-JAG',
      description: 'Validate ID-JAG token (audit trail)',
      section: 'chat-assistant',
    },
    {
      step: 3,
      title: 'ID-JAG → MCP Token',
      description: 'Exchange ID-JAG for auth server token',
      section: 'chat-assistant',
    },
    {
      step: 4,
      title: 'Validate & Execute',
      description: mcpInfo?.tools_called?.[0] 
        ? `Verified access. Executing: ${mcpInfo.tools_called[0]}`
        : 'Verify token and execute tool',
      section: 'mcp-server',
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100"
      >
        <h3 className="text-sm font-semibold text-gray-700">MCP Flow</h3>
        <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* MCP Server */}
          <div>
            <span className="text-xs font-medium text-gray-600">MCP Server</span>
            <div className="mt-1 flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                </svg>
              </div>
              <span className="text-sm font-medium text-blue-900">
                {mcpInfo?.server || 'Apex Customer 360'}
              </span>
            </div>
          </div>

          {/* Query */}
          {(query || mcpInfo?.query) && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600">Query</span>
                <button
                  onClick={() => copyToClipboard(query || mcpInfo?.query || '', 'query')}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  {copiedQuery ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700">{query || mcpInfo?.query}</p>
              </div>
            </div>
          )}

          {/* Tools Executed */}
          {mcpInfo?.tools_called && mcpInfo.tools_called.length > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-600">Tools Executed</span>
              <div className="mt-1 space-y-1">
                {mcpInfo.tools_called.map((tool, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <span className="text-gray-500">⚙️</span>
                    <span className="text-sm font-mono text-gray-700">{tool}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ID-JAG Secure Flow */}
          <div>
            <span className="text-xs font-medium text-gray-600">ID-JAG Secure Flow</span>
            <div className="mt-2 p-4 bg-gradient-to-b from-blue-50 to-green-50 rounded-lg border border-gray-200">
              {/* Chat Assistant Section */}
              <div className="mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Chat Assistant (Steps 1-3)
                </span>
              </div>
              
              <div className="space-y-0">
                {idJagSteps.map((step, index) => (
                  <div key={step.step}>
                    {/* Section divider before MCP Server */}
                    {step.section === 'mcp-server' && index > 0 && (
                      <div className="my-3 border-t border-dashed border-gray-300 pt-3">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          MCP Server (Step 4)
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-3">
                      {/* Step number and connector */}
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                          step.section === 'chat-assistant' 
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                            : 'bg-gradient-to-br from-green-500 to-green-600'
                        }`}>
                          {step.step}
                        </div>
                        {index < idJagSteps.length - 1 && step.section === idJagSteps[index + 1]?.section && (
                          <div className="w-0.5 h-8 border-l-2 border-dashed border-gray-300"></div>
                        )}
                      </div>
                      
                      {/* Step content */}
                      <div className="flex-1 pb-4">
                        <p className="text-sm font-semibold text-gray-800">{step.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{step.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Token Details */}
          {(mcpInfo?.id_jag_token || mcpInfo?.mcp_access_token) && (
            <div className="space-y-3">
              {/* ID-JAG Token */}
              {mcpInfo?.id_jag_token && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">ID-JAG Token</span>
                    <button
                      onClick={() => copyToClipboard(mcpInfo.id_jag_token!, 'idjag')}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >
                      {copiedIdJag ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs font-mono text-blue-700 break-all line-clamp-2">
                      {mcpInfo.id_jag_token.substring(0, 80)}...
                    </p>
                  </div>
                </div>
              )}

              {/* MCP Access Token */}
              {mcpInfo?.mcp_access_token && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">MCP Access Token</span>
                    <button
                      onClick={() => copyToClipboard(mcpInfo.mcp_access_token!, 'mcp')}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >
                      {copiedMcp ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  {mcpInfo.scope && (
                    <p className="text-xs text-gray-500 mb-1">
                      Scope: {mcpInfo.scope} • Expires: {mcpInfo.expires_in}s
                    </p>
                  )}
                  <div className="p-2 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-xs font-mono text-green-700 break-all line-clamp-2">
                      {mcpInfo.mcp_access_token.substring(0, 80)}...
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Security Note */}
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <div>
                <p className="text-sm font-medium text-green-800">Secure Cross-App Access</p>
                <p className="text-xs text-green-700 mt-0.5">
                  ID tokens are never exposed to MCP server. Only short-lived access tokens are used.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
