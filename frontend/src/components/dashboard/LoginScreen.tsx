import { GOOGLE_LOGIN_URL } from "@/lib/api";

export function LoginScreen({
  ready,
  authChecked,
  authError,
  onRetry,
}: {
  ready: { status: string; database?: string } | null;
  authChecked: boolean;
  authError: string;
  onRetry: () => void;
}) {
  return (
    <section className="grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-[420px] rounded border border-zinc-800 bg-[#090b11] p-6 shadow-2xl shadow-black/35">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Zero-Friction ERP</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50">Sign in to your command center</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Use your Google account to access wallets, transactions, inbox review, and automation tools.
        </p>
        <div className="mt-5 rounded border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Backend</span>
            <span className={ready?.database === "ok" ? "text-lime-300" : "text-amber-300"}>
              {ready?.database ?? "checking"}
            </span>
          </div>
          {authChecked && authError ? (
            <p className="mt-2 border-t border-zinc-800 pt-2 text-zinc-500">{authError}</p>
          ) : null}
        </div>
        <div className="mt-5 grid gap-2">
          <a className="btn-primary grid h-11 place-items-center text-center" href={GOOGLE_LOGIN_URL}>
            Login with Google
          </a>
          <button className="btn-secondary h-10" onClick={onRetry}>
            Refresh session
          </button>
        </div>
      </div>
    </section>
  );
}

