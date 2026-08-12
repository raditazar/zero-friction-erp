"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Plus, FileText } from "lucide-react";
import { getRouteMetadata } from "@/lib/route-metadata";
import { Button } from "@/components/ui/button";

export type AppPageHeaderProps = {
  title?: string;
  eyebrow?: string;
  description?: string;
  primaryCta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryCta?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
  };
  secondaryActions?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
  }[];
  customBreadcrumb?: { label: string; href?: string }[];
  className?: string;
};

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

  const title = customTitle || metadata?.title || "Dashboard";
  const eyebrow = customEyebrow || metadata?.eyebrow || "Aplikasi";
  const description = customDesc || metadata?.description || "";
  const cta = customCta || metadata?.primaryCta;

  const breadcrumbItems = customBreadcrumb || [
    { label: "Beranda", href: "/" },
    { label: eyebrow },
    { label: title },
  ];

  const renderSecondaryCtaButton = () => {
    if (!secondaryCta) return null;
    const content = (
      <>
        {secondaryCta.icon || <FileText className="mr-1.5 size-4" />}
        {secondaryCta.label}
      </>
    );

    const buttonClass =
      "btn-secondary text-sm px-4 py-2 font-medium flex items-center shrink-0 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] focus-visible:ring-offset-2";

    if (secondaryCta.href) {
      return (
        <Link href={secondaryCta.href} className={buttonClass}>
          {content}
        </Link>
      );
    }

    return (
      <Button onClick={secondaryCta.onClick} className={buttonClass}>
        {content}
      </Button>
    );
  };

  const renderCtaButton = () => {
    if (!cta) return null;
    const content = (
      <>
        <Plus className="mr-1.5 size-4" />
        {cta.label}
      </>
    );

    const buttonClass =
      "btn-primary text-sm px-4 py-2 font-medium flex items-center shrink-0 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] focus-visible:ring-offset-2";

    if (cta.href) {
      return (
        <Link href={cta.href} className={buttonClass}>
          {content}
        </Link>
      );
    }

    return (
      <Button onClick={cta.onClick} className={buttonClass}>
        {content}
      </Button>
    );
  };

  return (
    <div className={`mb-6 flex flex-col gap-2 ${className}`}>
      {/* Breadcrumb - desktop & mobile */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-[#756f64]">
        {breadcrumbItems.map((item, index) => (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="size-3 text-[#756f64]/60" aria-hidden="true" />}
            {item.href ? (
              <Link href={item.href} className="hover:text-[#1A1A1A] transition-colors rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A]">
                {item.label}
              </Link>
            ) : (
              <span className="font-medium text-[#1A1A1A]">{item.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Main Header Area */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[22px] md:text-2xl font-bold tracking-tight text-[#1A1A1A] leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-[#756f64] line-clamp-1">{description}</p>
          )}
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-2 md:mt-0">
          {secondaryActions?.map((action, idx) => {
            const content = (
              <>
                {action.icon}
                {action.label}
              </>
            );
            const buttonClass =
              "btn-secondary text-sm px-3.5 py-2 font-medium flex items-center gap-1.5 shrink-0 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] focus-visible:ring-offset-2";
            if (action.href) {
              return (
                <Link key={idx} href={action.href} className={buttonClass}>
                  {content}
                </Link>
              );
            }
            return (
              <Button key={idx} onClick={action.onClick} className={buttonClass}>
                {content}
              </Button>
            );
          })}
          {renderSecondaryCtaButton()}
          {renderCtaButton()}
        </div>
      </div>
    </div>
  );
}

export function MobilePageHeader(props: AppPageHeaderProps) {
  return <AppPageHeader {...props} />;
}
