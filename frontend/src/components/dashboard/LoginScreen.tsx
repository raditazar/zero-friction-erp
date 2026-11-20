import { GOOGLE_LOGIN_URL } from "@/lib/api";
import {
  FormCard,
  FormCardHeader,
  FormCardTitle,
  FormCardContent,
  FormCardFooter,
} from "@/components/ui/form";
import { SubmitAction } from "@/components/ui/form";
import { CoinStack } from "@/components/three/coin-stack";
import {
  WelcomeCaptureIllustration,
  WelcomeGrowIllustration,
  WelcomeOrganizeIllustration,
} from "@/components/illustrations";

const POINTS = [
  { art: WelcomeCaptureIllustration, title: "Catat tanpa repot", text: "Foto struk, ketik singkat, atau biarkan notifikasi bank yang mencatat." },
  { art: WelcomeOrganizeIllustration, title: "Semua dompet, satu tempat", text: "Rekening, e-wallet, dan uang tunai terpantau bersama." },
  { art: WelcomeGrowIllustration, title: "Lihat arahnya", text: "Anggaran dan arus kas yang mudah dibaca, tanpa rumus." },
];

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
  const online = ready?.database === "ok";
  return (
    <section className="grid min-h-dvh bg-paper md:grid-cols-2">
      {/* Left panel: branding (desktop) */}
      <div className="relative hidden flex-col justify-center overflow-hidden border-r border-line bg-paper-sunk p-12 text-ink md:flex lg:p-24">
        <CoinStack count={8} className="absolute -right-10 top-10 h-72 w-64 lg:h-80 lg:w-72" />
        <div className="relative max-w-xl">
          <div className="surface-raised-sm mb-8 inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-semibold text-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="size-4 rounded object-contain dark:invert" />
            <span>satset ERP</span>
          </div>
          <h1 className="font-display mb-6 text-4xl font-semibold leading-tight text-ink lg:text-5xl">
            Keuangan harian,{" "}
            <span className="inline-block -rotate-2 rounded-2xl bg-mint px-3 text-mint-ink">tanpa ribet.</span>
          </h1>
          <p className="mb-12 text-lg leading-relaxed text-ink-soft">
            Dompet, transaksi, anggaran, dan otomasi pencatatan dalam satu tempat.
          </p>

          <div className="space-y-6">
            {POINTS.map(({ art: Art, title, text }) => (
              <div key={title} className="flex items-center gap-5">
                <Art className="h-16 w-20 shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-ink">{title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel: sign-in */}
      <div
        className="flex flex-col items-center justify-center p-6 sm:p-12"
        style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))", paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex flex-col items-start md:hidden">
            <div className="mb-2 flex h-36 w-full items-end justify-between">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="mb-2 size-12 rounded-2xl object-contain dark:invert" />
              <CoinStack count={7} className="-mr-4 h-36 w-32" />
            </div>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] text-ink">
              Keuangan harian,
              <br />
              <span className="mt-1 inline-block -rotate-2 rounded-2xl bg-mint px-2.5 text-mint-ink">tanpa ribet.</span>
            </h1>
          </div>

          <FormCard className="bg-card">
            <FormCardHeader className="pb-4">
              <div>
                <FormCardTitle className="text-2xl">Masuk</FormCardTitle>
                <p className="mt-1 text-sm text-ink-soft">Gunakan akun Google untuk membuka ruang kerja Anda.</p>
              </div>
            </FormCardHeader>
            <FormCardContent className="space-y-6">
              <div className="rounded-xl border border-line bg-paper p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink-soft">Status server</span>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${online ? "bg-positive-solid" : "animate-pulse bg-caution-solid"}`} />
                    <span className={online ? "text-positive" : "text-caution"}>
                      {online ? "Terhubung" : ready?.database ?? "Memeriksa…"}
                    </span>
                  </div>
                </div>
                {authChecked && authError ? (
                  <div className="mt-4 border-t border-line pt-3">
                    <p role="alert" className="rounded-md border border-negative-line bg-negative-soft p-2.5 text-sm text-negative">{authError}</p>
                  </div>
                ) : null}
              </div>

              <a
                data-touch=""
                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                href={GOOGLE_LOGIN_URL}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Lanjutkan dengan Google
              </a>
            </FormCardContent>
            <FormCardFooter className="pt-2">
              <SubmitAction isSubmitting={false} label="Muat ulang sesi" variant="outline" className="h-11 w-full" onClick={onRetry} />
            </FormCardFooter>
          </FormCard>
        </div>
      </div>
    </section>
  );
}
