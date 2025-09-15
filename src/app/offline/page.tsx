"use client";

export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <div className="min-h-[60vh] grid place-items-center px-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-semibold">You’re offline</h1>
        <p className="text-slate-500">Some features may be unavailable. Check your connection and try again.</p>
        <button onClick={() => location.reload()} className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-white text-sm hover:bg-slate-800">Retry</button>
      </div>
    </div>
  );
}
