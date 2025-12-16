// components/SystemStatus.tsx
'use client';

interface SystemStatusProps {
  isOnline?: boolean;
  isAuthenticated?: boolean;
}

export default function SystemStatus({ isOnline = true, isAuthenticated = true }: SystemStatusProps) {
  const statuses = [
    {
      name: 'AI Assistant',
      status: isOnline ? 'Active' : 'Offline',
      isGood: isOnline,
    },
    {
      name: 'Authentication',
      status: isAuthenticated ? 'Secure' : 'Not Authenticated',
      isGood: isAuthenticated,
    },
    {
      name: 'Data Privacy',
      status: 'Protected',
      isGood: true,
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">System Status</h3>
      <div className="space-y-2">
        {statuses.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{item.name}</span>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  item.isGood ? 'bg-green-500' : 'bg-red-500'
                }`}
              ></span>
              <span
                className={`text-xs font-medium ${
                  item.isGood ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
