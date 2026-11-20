"use client";

import { Illustration, Ink, Mint, MintLine, OnMint, circle, type IllustrationProps } from "./base";

export type { IllustrationProps } from "./base";
export { CoinStackStatic } from "./coin-stack-static";

/** Empty tray with a ticked badge: nothing left to review. */
export function InboxClearIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <Mint d={circle(128, 20, 13)} origin={[128, 20]} />
      <Ink d="M28 64 44 34h72l16 30v26a8 8 0 0 1-8 8H36a8 8 0 0 1-8-8Z" />
      <Ink d="M28 64h30q2 12 22 12t22-12h30" />
      <OnMint d="m122 20 4.5 4.5 8-9" />
      <Ink d="M42 14v8M38 18h8" faint />
      <Ink d="M140 48v6M137 51h6" faint />
    </Illustration>
  );
}

/** Open ledger with blank ruled pages. */
export function LedgerEmptyIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <Mint d="M100 24h16v30l-8-7-8 7Z" origin={[108, 36]} />
      <Ink d="M80 36c-14-8-34-8-50-4v62c16-4 36-4 50 4 14-8 34-8 50-4V32c-16-4-36-4-50 4Z" />
      <Ink d="M80 36v62" />
      <Ink d="M42 48h26M42 60h26M42 72h16" faint />
      <Ink d="M92 62h26M92 74h18" faint />
    </Illustration>
  );
}

/** Wallet with a coin about to drop in. */
export function WalletEmptyIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <Mint d={circle(62, 24, 12)} origin={[62, 24]} />
      <OnMint d="M62 19v10" />
      <Ink d="M30 50a8 8 0 0 1 8-8h76a8 8 0 0 1 8 8v42a8 8 0 0 1-8 8H38a8 8 0 0 1-8-8Z" />
      <Ink d="M122 60h-22a10 10 0 0 0 0 20h22" />
      <Ink d="M101 70h.01" width={4} />
      <Ink d="M44 42 96 28a6 6 0 0 1 7 4l3 10" faint />
    </Illustration>
  );
}

/** Gauge still at zero with a plus sign: budget not set yet. */
export function BudgetUnsetIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <Ink d="M30 90a48 48 0 0 1 96 0" faint />
      <MintLine d="M30 90a48 48 0 0 1 14-34" width={8} />
      <Ink d="M78 90 52 62" width={2.5} />
      <Ink d="M78 90h.01" width={7} />
      <Ink d="M20 102h116" />
      <Ink d="M132 30v14M125 37h14" />
    </Illustration>
  );
}

/** Peak with a flag: a goal to reach. */
export function GoalEmptyIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <Ink d="M18 100 58 46l20 26 18-20 44 48Z" />
      <Ink d="M58 46V20" />
      <Mint d="M58 20 82 28 58 38Z" origin={[58, 29]} />
      <Ink d="M46 62l12 10 10-8" faint />
      <Ink d={circle(122, 28, 7)} faint />
    </Illustration>
  );
}

/** Plug pulled out of its socket. */
export function ErrorIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <Ink d="M14 64h32" />
      <Ink d="M46 48h16a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H46Z" />
      <Ink d="M68 57h10M68 71h10" />
      <Ink d="M146 64h-32" />
      <Ink d="M114 46h-10a10 10 0 0 0-10 10v16a10 10 0 0 0 10 10h10Z" />
      <MintLine d="M80 26l3 12M88 22v13M96 26l-3 12" />
    </Illustration>
  );
}

/** Cloud struck through: no connection. */
export function OfflineIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <Mint d={circle(116, 34, 13)} origin={[116, 34]} />
      <Ink d="M50 90a19 19 0 0 1 1-38 27 27 0 0 1 52-3 21 21 0 0 1 7 41Z" />
      <Ink d="M38 104 124 20" width={3} />
    </Illustration>
  );
}

/** Rubber stamp with a tick: everything is done. */
export function SuccessStampIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <g transform="rotate(-8 80 60)">
        <Mint d={circle(80, 60, 27)} origin={[80, 60]} />
        <Ink d={circle(80, 60, 36)} />
        <OnMint d="m66 61 10 10 20-22" width={4} />
      </g>
      <Ink d="M26 34l8 5M22 60h10M134 86l-8-5M138 60h-10M118 20l-5 8" faint />
    </Illustration>
  );
}

/** Welcome 1: snap a receipt with the phone. */
export function WelcomeCaptureIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <Mint d="M66 36h28v42l-5-4-4.5 4-4.5-4-4.5 4-4.5-4-5 4Z" origin={[80, 56]} />
      <Ink d="M56 16h48a8 8 0 0 1 8 8v72a8 8 0 0 1-8 8H56a8 8 0 0 1-8-8V24a8 8 0 0 1 8-8Z" />
      <OnMint d="M72 46h16M72 55h10" width={2} />
      <Ink d="M80 93h.01" width={6} />
      <Ink d="M122 32l9-6M125 46h11M38 32l-9-6M35 46H24" faint />
    </Illustration>
  );
}

/** Welcome 2: every wallet in one place. */
export function WelcomeOrganizeIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <Mint d="M46 34 120 24l5 38-74 10Z" origin={[86, 48]} />
      <Ink d="M30 50h84a6 6 0 0 1 6 6v38a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6V56a6 6 0 0 1 6-6Z" />
      <Ink d="M24 66h96" />
      <Ink d="M36 84h20M94 84h14" faint />
    </Illustration>
  );
}

/** Welcome 3: watch the numbers grow. */
export function WelcomeGrowIllustration(props: IllustrationProps) {
  return (
    <Illustration {...props}>
      <Mint d="M38 84 62 66l18 8 24-28 22-10v58H38Z" origin={[82, 98]} opacity={0.55} />
      <Ink d="M28 22v76h108" />
      <Ink d="M38 84 62 66l18 8 24-28 22-10" width={2.5} />
      <Ink d="M113 34h13v13" width={2.5} />
    </Illustration>
  );
}

export const illustrations = {
  inbox: InboxClearIllustration,
  ledger: LedgerEmptyIllustration,
  wallet: WalletEmptyIllustration,
  budget: BudgetUnsetIllustration,
  goal: GoalEmptyIllustration,
  error: ErrorIllustration,
  offline: OfflineIllustration,
  success: SuccessStampIllustration,
} as const;

export type IllustrationName = keyof typeof illustrations;
