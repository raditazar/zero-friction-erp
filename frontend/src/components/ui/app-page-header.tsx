"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
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
  customBreadcrumb?: { label: string; href?: string }[];
  className?: string;
};

export function AppPageHeader({
  title: customTitle,
  eyebrow: customEyebrow,
  description: customDesc,
  primaryCta: customCta,
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

  const renderCtaButton = (isMobile: boolean) => {
    if (!cta) return null;
    const content = (
      <>
        <Plus className="mr-1.5 size-4" />
        {cta.label}
      </>
    );

    const buttonClass = isMobile
      ? "w-full justify-center mt-3 btn-primary text-sm py-2.5 font-medium min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] focus-visible:ring-offset-2"
      : "btn-primary text-sm px-4 py-2 font-medium flex items-center shrink-0 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] focus-visible:ring-offset-2";

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

        {/* Desktop Primary CTA */}
        <div className="hidden md:block">
          {renderCtaButton(false)}
        </div>
      </div>
    </div>
  );
}

export function MobilePageHeader() {
  return <AppPageHeader />;
}
