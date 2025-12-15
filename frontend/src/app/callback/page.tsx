'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getOktaAuth } from '@/lib/auth-context';

export default function CallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Processing login...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setStatus('Exchanging authorization code...');
        
        const oktaAuth = getOktaAuth();
        
        // Parse tokens from URL (handles the OAuth callback)
        const tokens = await oktaAuth.token.parseFromUrl();
        
        if (tokens.tokens) {
          setStatus('Storing tokens...');
          
          // Store tokens in token manager
          await oktaAuth.tokenManager.setTokens(tokens.tokens);
          
          setStatus('Login successful! Redirecting...');
          
          // Small delay to show success message
          setTimeout(() => {
            router.push('/');
          }, 500);
        } else {
          throw new Error('No tokens received from Okta');
        }
      } catch (err) {
        console.error('Callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 max-w-md w-full mx-4">
        {error ? (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Authentication Failed</h2>
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-[#007DC1] text-white rounded-lg hover:bg-[#006ba3] transition-colors"
            >
              Return to Home
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#007DC1]/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#007DC1] animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Authenticating with Okta</h2>
            <p className="text-white/60">{status}</p>
          </div>
        )}
      </div>
    </div>
  );
}
