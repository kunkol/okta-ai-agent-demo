'use client';

import { X, Users, CreditCard, FileText, Shield, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PromptLibraryProps {
  onSelect: (prompt: string) => void;
  onClose: () => void;
}

const PROMPT_CATEGORIES = [
  {
    name: 'XAA - Customer Queries',
    icon: Users,
    color: 'text-okta-teal',
    bgColor: 'bg-okta-teal/10',
    prompts: [
      { label: 'Alice Lookup', text: 'Get customer information for Alice' },
      { label: 'Bob Lookup', text: 'Get customer information for Bob' },
      { label: 'List All Customers', text: 'Show me all customers in the system' },
      { label: 'Customer Orders', text: 'What orders has Alice placed recently?' },
    ],
  },
  {
    name: 'FGA - Access Control',
    icon: Shield,
    color: 'text-okta-purple',
    bgColor: 'bg-okta-purple/10',
    prompts: [
      { label: 'Charlie Lookup (Denied)', text: 'Get customer information for Charlie' },
      { label: 'Check My Permissions', text: 'What resources can I access?' },
      { label: 'View Restricted Data', text: 'Show me confidential customer records' },
    ],
  },
  {
    name: 'CIBA - Step-Up Auth',
    icon: AlertTriangle,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    prompts: [
      { label: 'Small Payment ($5K)', text: 'Process a payment of $5,000 for Alice' },
      { label: 'Large Payment ($15K)', text: 'Process a payment of $15,000 for Bob' },
      { label: 'High-Risk Transaction', text: 'Transfer $50,000 to external account' },
    ],
  },
  {
    name: 'Documents & Policies',
    icon: FileText,
    color: 'text-success',
    bgColor: 'bg-success/10',
    prompts: [
      { label: 'Refund Policy', text: 'What is the refund policy?' },
      { label: 'Privacy Policy', text: 'Show me the privacy policy' },
      { label: 'Search Documents', text: 'Find documents about data retention' },
    ],
  },
];

export default function PromptLibrary({ onSelect, onClose }: PromptLibraryProps) {
  return (
    <AnimatePresence>
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
          className="bg-[#12121a] border border-white/10 rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 className="text-lg font-semibold text-white">Demo Prompt Library</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
            <p className="text-sm text-gray-400 mb-6">
              Select a prompt to test different security scenarios: Cross-App Access (XAA), 
              Fine-Grained Authorization (FGA), and CIBA step-up authentication.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PROMPT_CATEGORIES.map((category) => (
                <div key={category.name} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${category.bgColor}`}>
                      <category.icon className={`w-4 h-4 ${category.color}`} />
                    </div>
                    <h3 className="text-sm font-medium text-white">{category.name}</h3>
                  </div>

                  <div className="space-y-2">
                    {category.prompts.map((prompt) => (
                      <button
                        key={prompt.label}
                        onClick={() => onSelect(prompt.text)}
                        className="w-full text-left p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group"
                      >
                        <p className="text-sm text-white group-hover:text-okta-teal transition-colors">
                          {prompt.label}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          &quot;{prompt.text}&quot;
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
