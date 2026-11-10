import { GOOGLE_LOGIN_URL } from "@/lib/api";
import {
  FormCard,
  FormCardHeader,
  FormCardTitle,
  FormCardContent,
  FormCardFooter,
} from "@/components/ui/form";
import { SubmitAction } from "@/components/ui/form";

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
    <section className="grid min-h-screen md:grid-cols-2 bg-[#1B2326]">
      {/* Left Panel: Information/Branding */}
      <div className="hidden md:flex flex-col justify-center p-12 lg:p-24 bg-gradient-to-br from-[#151b1e] to-[#0a0d0f] text-positive-line border-r border-card/5">
        <div className="max-w-xl">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-mint/20 bg-mint/10 px-3.5 py-1 text-xs font-semibold text-mint">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="satset Logo" className="size-4 object-contain rounded" />
            <span>satset ERP</span>
          </div>
          <h1 className="mb-6 text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
            Enterprise Management, <span className="text-mint">Simplified.</span>
          </h1>
          <p className="mb-12 text-lg text-positive-line/70 leading-relaxed">
            Experience the future of enterprise resource planning. Streamline your workflows, manage wallets, track transactions, and automate operations seamlessly from one unified command center.
          </p>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-[#202A2D] p-3 text-mint shadow-lg shadow-[#10F5CC]/5">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Secure Access</h3>
                <p className="text-sm text-positive-line/60 mt-1">Enterprise-grade security using Google Workspace authentication.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-[#202A2D] p-3 text-mint shadow-lg shadow-[#10F5CC]/5">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Lightning Fast</h3>
                <p className="text-sm text-positive-line/60 mt-1">Optimized performance for zero friction in your daily tasks.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel: Login Form */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px]">
          <div className="md:hidden mb-8 text-center flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="satset Logo" className="size-10 object-contain rounded-lg mb-2" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mint mb-1">
              satset ERP
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Command Center
            </h1>
          </div>

          <FormCard className="bg-[#202A2D] border-card/10 shadow-2xl">
            <FormCardHeader className="pb-4">
              <FormCardTitle className="text-2xl text-white">Sign in</FormCardTitle>
              <p className="text-sm text-positive-line/60 mt-1">
                Use your Google account to access your workspace.
              </p>
            </FormCardHeader>
            <FormCardContent className="space-y-6">
              <div className="rounded-lg border border-card/10 bg-[#1B2326] p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-positive-line/60 font-medium">Backend Status</span>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${ready?.database === "ok" ? "bg-mint" : "bg-caution-solid animate-pulse"}`} />
                    <span className={ready?.database === "ok" ? "text-mint" : "text-caution"}>
                      {ready?.database === "ok" ? "Connected" : ready?.database ?? "Checking..."}
                    </span>
                  </div>
                </div>
                {authChecked && authError ? (
                  <div className="mt-4 pt-3 border-t border-card/10">
                    <p className="text-sm text-negative bg-negative-solid/10 p-2.5 rounded-md border border-negative-line/20">{authError}</p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                <a
                  className="flex h-11 w-full items-center justify-center gap-3 rounded-md bg-card px-4 text-sm font-semibold text-ink transition-colors hover:bg-paper-sunk focus:outline-none focus:ring-2 focus:ring-card/50"
                  href={GOOGLE_LOGIN_URL}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </a>
              </div>
            </FormCardContent>
            <FormCardFooter className="pt-2">
              <SubmitAction
                isSubmitting={false}
                label="Refresh Session"
                variant="outline"
                className="w-full h-11 border-card/10 text-positive-line hover:bg-card/5 hover:text-white transition-colors"
                onClick={onRetry}
              />
            </FormCardFooter>
          </FormCard>
        </div>
      </div>
    </section>
  );
}
