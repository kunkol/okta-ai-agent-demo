'use client';

import { useAuth } from '@/lib/auth-context';

export function LoginButton() {
  const { isAuthenticated, isLoading, user, login, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg">
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        <span className="text-white/60 text-sm">Loading...</span>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-3">
        {/* User info */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-emerald-400 text-sm font-medium">
            {user.name || user.email || user.preferred_username || 'Authenticated'}
          </span>
        </div>
        
        {/* Logout button */}
        <button
          onClick={logout}
          className="px-4 py-2 text-sm text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="flex items-center gap-2 px-4 py-2 bg-[#007DC1] hover:bg-[#006ba3] text-white rounded-lg transition-colors font-medium"
    >
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
      </svg>
      Sign in with Okta
    </button>
  );
}

// Compact version for header
export function LoginButtonCompact() {
  const { isAuthenticated, isLoading, user, login, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 font-medium text-sm">
          {(user.name || user.email || 'U')[0].toUpperCase()}
        </div>
        <button
          onClick={logout}
          className="text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="px-3 py-1.5 bg-[#007DC1] hover:bg-[#006ba3] text-white text-sm rounded-lg transition-colors"
    >
      Sign In
    </button>
  );
}
