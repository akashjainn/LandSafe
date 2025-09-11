export const dynamic = 'force-static';

export default function SettingsPage() {
  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-4">Settings</h1>
      <p className="text-sm text-slate-600 mb-8">
        Placeholder settings page. This removes the 404 prefetch error you were seeing for <code>/settings?_rsc=...</code>.
        Replace this content with real configuration panels when ready.
      </p>
      <div className="grid gap-6">
        <section className="rounded-xl border border-slate-200 bg-white/70 backdrop-blur p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Flight Data</h2>
          <p className="text-xs text-slate-500">Add controls here to manage provider keys, quota resets, and cache inspection.</p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white/70 backdrop-blur p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Appearance</h2>
          <p className="text-xs text-slate-500">Theme toggles, density preferences, and layout options can go here.</p>
        </section>
      </div>
    </div>
  );
}
