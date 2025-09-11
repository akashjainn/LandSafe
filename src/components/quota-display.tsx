"use client";

import { useState, useEffect } from 'react';
// removed unused Badge import
// Card and CardContent are intentionally unused

interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  month: string;
}

export function QuotaDisplay() {
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQuota() {
      try {
        const response = await fetch('/api/quota');
        const data = await response.json();
        if (data.success) {
          setQuota(data.quota);
        }
      } catch (error) {
        console.error('Failed to fetch quota:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchQuota();
    // Refresh quota every 30 seconds
    const interval = setInterval(fetchQuota, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !quota) return null;

  const percentUsed = (quota.used / quota.limit) * 100;
  const getStatusColor = () => {
    if (percentUsed >= 90) return 'destructive';
    if (percentUsed >= 75) return 'secondary';
    return 'default';
  };

  return (
    <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/20 rounded-xl backdrop-blur-sm border border-white/20">
      <div className="flex items-center gap-2">
        <div className="text-xs font-medium text-blue-200">API Quota</div>
        <div className={`px-2 py-1 rounded-md text-xs font-semibold ${
          percentUsed >= 90 
            ? 'bg-red-100 text-red-700' 
            : percentUsed >= 75 
            ? 'bg-amber-100 text-amber-700' 
            : 'bg-emerald-100 text-emerald-700'
        }`}>
          {quota.remaining} left
        </div>
      </div>
      <div className="text-xs text-blue-200">
        {quota.used}/{quota.limit} used this month
      </div>
    </div>
  );
}
