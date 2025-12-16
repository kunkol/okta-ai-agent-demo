// components/IDTokenDetails.tsx
'use client';

import { useState } from 'react';
import { DecodedToken } from '@/types';
import { decodeJWT } from '@/lib/api';

interface IDTokenDetailsProps {
  idToken?: string;
}

export default function IDTokenDetails({ idToken }: IDTokenDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedDecoded, setCopiedDecoded] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState(false);

  const decodedToken: DecodedToken | null = idToken ? decodeJWT(idToken) as DecodedToken : null;

  const copyToClipboard = async (text: string, type: 'decoded' | 'raw') => {
    await navigator.clipboard.writeText(text);
    if (type === 'decoded') {
      setCopiedDecoded(true);
      setTimeout(() => setCopiedDecoded(false), 2000);
    } else {
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    }
  };

  if (!idToken) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">ID Token Details</h3>
        </div>
        <div className="p-4 text-sm text-gray-500 text-center">
          Sign in to view token details
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100"
      >
        <h3 className="text-sm font-semibold text-gray-700">ID Token Details</h3>
        <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Decoded Token */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">Decoded Token</span>
              <button
                onClick={() => copyToClipboard(JSON.stringify(decodedToken, null, 2), 'decoded')}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                {copiedDecoded ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                {JSON.stringify(decodedToken, null, 2)}
              </pre>
            </div>
          </div>

          {/* Raw Token */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">Raw Token</span>
              <button
                onClick={() => copyToClipboard(idToken, 'raw')}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                {copiedRaw ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div className="bg-gray-100 rounded-lg p-3">
              <p className="text-xs font-mono text-gray-600 break-all line-clamp-4">
                {idToken}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
