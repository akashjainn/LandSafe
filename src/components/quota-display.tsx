"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
    <Card className="shadow-sm border-0 bg-white/70 backdrop-blur-sm">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-slate-700">
            API Usage ({quota.month})
          </div>
          <Badge variant={getStatusColor()}>
            {quota.used}/{quota.limit} calls
          </Badge>
        </div>
        <div className="mt-2">
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                percentUsed >= 90 ? 'bg-red-500' : 
                percentUsed >= 75 ? 'bg-yellow-500' : 
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {quota.remaining} calls remaining
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
