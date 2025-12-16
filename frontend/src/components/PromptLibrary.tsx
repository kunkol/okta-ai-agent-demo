// components/PromptLibrary.tsx
'use client';

import { PromptCategory } from '@/types';

interface PromptLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (prompt: string) => void;
}

const promptLibrary: PromptCategory[] = [
  {
    category: 'XAA Demos',
    prompts: [
      {
        title: 'Customer Lookup',
        prompt: 'Look up customer Sarah Chen and show me her account details',
        description: 'Demonstrates XAA token exchange to access MCP tools',
      },
      {
        title: 'Recent Orders',
        prompt: 'What are the recent orders for customer ID 12345?',
        description: 'Shows cross-app access to order management system',
      },
      {
        title: 'Customer Support History',
        prompt: 'Show me the support ticket history for Acme Corp',
        description: 'Retrieves support data via secure token exchange',
      },
    ],
  },
  {
    category: 'FGA Demos',
    prompts: [
      {
        title: 'View Allowed Data',
        prompt: 'Show me customer details for accounts I manage',
        description: 'FGA allows access - user has permission',
      },
      {
        title: 'Access Denied Demo',
        prompt: 'Show me all customer credit card numbers',
        description: 'FGA denies access - sensitive data protection',
      },
      {
        title: 'Role-Based Access',
        prompt: 'Show me the financial summary for all enterprise customers',
        description: 'FGA checks user role before granting access',
      },
    ],
  },
  {
    category: 'CIBA Demos',
    prompts: [
      {
        title: 'Step-Up Auth Required',
        prompt: 'Update the billing address for customer Sarah Chen',
        description: 'Triggers CIBA step-up authentication',
      },
      {
        title: 'High-Value Transaction',
        prompt: 'Process a refund of $5000 for order #789',
        description: 'CIBA approval required for high-value actions',
      },
      {
        title: 'Sensitive Data Modification',
        prompt: 'Change the primary contact email for Acme Corp to new@acme.com',
        description: 'CIBA verifies user identity before critical changes',
      },
    ],
  },
];

export default function PromptLibrary({ isOpen, onClose, onSelectPrompt }: PromptLibraryProps) {
  if (!isOpen) return null;

  const handleSelectPrompt = (prompt: string) => {
    onSelectPrompt(prompt);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Prompt Library</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="space-y-6">
            {promptLibrary.map((category) => (
              <div key={category.category}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {category.category}
                </h3>
                <div className="space-y-2">
                  {category.prompts.map((item) => (
                    <button
                      key={item.title}
                      onClick={() => handleSelectPrompt(item.prompt)}
                      className="w-full text-left p-4 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl">📋</span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 group-hover:text-blue-700">
                            {item.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">{item.prompt}</p>
                          <p className="text-xs text-gray-400 mt-2">{item.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
