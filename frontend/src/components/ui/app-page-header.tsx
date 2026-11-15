"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Plus, FileText } from "lucide-react";
import { getRouteMetadata } from "@/lib/route-metadata";
import { Button } from "@/components/ui/button";
import { MobileHeaderAction } from "@/components/ui/mobile-header";

type HeaderAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
};

export type AppPageHeaderProps = {
  title?: string;
  eyebrow?: string;
  description?: string;
  primaryCta?: Omit<HeaderAction, "icon">;
  secondaryCta?: HeaderAction;
  secondaryActions?: HeaderAction[];
  customBreadcrumb?: { label: string; href?: string }[];
  className?: string;
};

const primaryClass = "btn-primary text-sm px-4 py-2 font-medium flex items-center shrink-0 min-h-[44px]";
const secondaryClass = "btn-secondary text-sm px-3.5 py-2 font-medium flex items-center gap-1.5 shrink-0 min-h-[44px]";

function ActionButton({ action, className, children }: { action: HeaderAction; className: string; children: React.ReactNode }) {
  if (action.href) {
    return (
      <Link href={action.href} data-touch="" className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Button onClick={action.onClick} className={className}>
      {children}
    </Button>
  );
}

/**
 * Desktop: breadcrumb, title, description and actions.
 * Mobile: the shell's MobileAppHeader already shows the title, so only actions remain here and
 * the primary action moves into the top bar's right-hand slot.
 */
export function AppPageHeader({
  title: customTitle,
  eyebrow: customEyebrow,
  description: customDesc,
  primaryCta: customCta,
  secondaryCta,
  secondaryActions,
  customBreadcrumb,
  className = "",
}: AppPageHeaderProps) {
  const pathname = usePathname();
  const metadata = getRouteMetadata(pathname);

  const title = customTitle || metadata?.title || "Beranda";
  const eyebrow = customEyebrow || metadata?.eyebrow || "Aplikasi";
  const description = customDesc || metadata?.description || "";
  const cta = customCta || metadata?.primaryCta;

  const breadcrumbItems = customBreadcrumb || [
    { label: "Beranda", href: "/" },
    { label: eyebrow },
    { label: title },
  ];

  const hasSecondary = Boolean(secondaryCta || secondaryActions?.length);

  return (
    <div className={`flex-col gap-2 md:mb-6 md:flex ${hasSecondary ? "mb-4 flex" : "hidden"} ${className}`}>
      <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-xs text-ink-soft md:flex">
        {breadcrumbItems.map((item, index) => (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="size-3 text-ink-soft/60" aria-hidden="true" />}
            {item.href ? (
              <Link href={item.href} className="rounded px-1 py-0.5 transition-colors hover:text-ink">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-ink">{item.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="hidden flex-col gap-0.5 md:flex">
          <h1 className="font-display text-3xl font-semibold leading-tight text-ink">{title}</h1>
          {description && <p className="line-clamp-1 text-sm text-ink-soft">{description}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {secondaryActions?.map((action, idx) => (
            <ActionButton key={idx} action={action} className={secondaryClass}>
              {action.icon}
              {action.label}
            </ActionButton>
          ))}
          {secondaryCta ? (
            <ActionButton action={secondaryCta} className={secondaryClass}>
              {secondaryCta.icon || <FileText className="size-4" />}
              {secondaryCta.label}
            </ActionButton>
          ) : null}
          {cta ? (
            <span className="hidden md:block">
              <ActionButton action={cta} className={primaryClass}>
                <Plus className="mr-1.5 size-4" />
                {cta.label}
              </ActionButton>
            </span>
          ) : null}
        </div>
      </div>

      {cta ? (
        <MobileHeaderAction>
          <ActionButton
            action={cta}
            className="flex min-h-11 items-center gap-1 rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground md:hidden"
          >
            <Plus className="size-4" aria-hidden="true" />
            {cta.label}
          </ActionButton>
        </MobileHeaderAction>
      ) : null}
    </div>
  );
}

export function MobilePageHeader(props: AppPageHeaderProps) {
  return <AppPageHeader {...props} />;
}
