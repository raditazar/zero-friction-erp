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
    <section className="grid min-h-screen place-items-center bg-[#1B2326] px-5 py-10">
      <div className="w-full max-w-[420px] rounded-lg border bg-[#202A2D] p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-[#10F5CC]">Zero-Friction ERP</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#F5FEFD]">Sign in to your command center</h1>
        <p className="mt-3 text-sm leading-6 text-[#F5FEFD]/62">
          Use your Google account to access wallets, transactions, inbox review, and automation tools.
        </p>
        <div className="mt-5 rounded-md border border-[#F5FEFD]/8 bg-[#1B2326] px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#F5FEFD]/46">Backend</span>
            <span className={ready?.database === "ok" ? "text-[#10F5CC]" : "text-[#F5FEFD]/72"}>
              {ready?.database ?? "checking"}
            </span>
          </div>
          {authChecked && authError ? (
            <p className="mt-2 pt-2 text-[#F5FEFD]/48">{authError}</p>
          ) : null}
        </div>
        <div className="mt-5 grid gap-2">
          <a className="btn-google h-11 text-center" href={GOOGLE_LOGIN_URL}>
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

