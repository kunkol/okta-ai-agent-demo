// components/Header.tsx
'use client';

import { signOut } from 'next-auth/react';

interface HeaderProps {
  userName?: string;
  userEmail?: string;
  onPromptLibraryClick: () => void;
}

export default function Header({ userName, userEmail, onPromptLibraryClick }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Logo and App Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Apex Customer 360</h1>
            <p className="text-xs text-gray-500">Powered by AI • Secure • Confidential</p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          {/* Prompt Library Button */}
          <button
            onClick={onPromptLibraryClick}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            📚 Prompt Library
          </button>

          {/* Online Status */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-sm text-gray-600">Online</span>
          </div>

          {/* User Info */}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{userName || 'User'}</p>
              <p className="text-xs text-gray-500">{userEmail || ''}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
