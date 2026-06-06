export default function Home() {
  return (
    <div className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">Zero-Friction ERP</p>
            <h1 className="mt-1 text-2xl font-semibold">Transaction command center</h1>
          </div>
          <div className="flex gap-2 text-sm">
            <span className="border border-zinc-200 px-3 py-2">Backend: :8080</span>
            <span className="border border-zinc-200 px-3 py-2">Inbox-first</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1.5fr_1fr]">
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Uncategorized inbox</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Queue for OCR, natural-language cash entries, and wallet screenshots before reconciliation.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Pending review", "0"],
              ["AI failures", "0"],
              ["Duplicate blocks", "0"],
            ].map(([label, value]) => (
              <div key={label} className="border border-zinc-200 bg-white p-4">
                <p className="text-sm text-zinc-600">{label}</p>
                <p className="mt-3 text-3xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h3 className="font-medium">Webhook endpoints</h3>
            </div>
            <div className="grid gap-3 p-4 text-sm">
              <code className="border border-zinc-200 bg-zinc-50 p-3">GET /healthz</code>
              <code className="border border-zinc-200 bg-zinc-50 p-3">POST /webhooks/transactions</code>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Wallets</h2>
            <p className="mt-1 text-sm text-zinc-600">Initial placeholders for Supabase-backed balances.</p>
          </div>

          {["Cash", "Bank A", "GoPay", "OVO"].map((wallet) => (
            <div key={wallet} className="flex items-center justify-between border border-zinc-200 bg-white p-4">
              <span className="font-medium">{wallet}</span>
              <span className="text-sm text-zinc-500">Rp0</span>
            </div>
          ))}
        </aside>
      </main>
    </div>
  );
}
