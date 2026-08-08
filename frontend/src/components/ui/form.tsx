"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle, Search } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { InfoTooltip, type InfoTooltipProps } from "@/components/ui/info-tooltip";
import { cn } from "@/lib/utils";

const formCardVariants = cva(
  "overflow-hidden rounded-xl border bg-[#FFFEFC] text-[#25221F] shadow-[0_1px_2px_rgba(37,34,31,0.04)]",
  {
    variants: {
      variant: {
        default: "border-[#E5E1DB]",
        caution: "border-[#E6C98B] bg-[#FFFDF7]",
        sensitive: "border-[#D8D1C8] bg-[#FCFBF8]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface FormCardProps extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof formCardVariants> {}

export const FormCard = React.forwardRef<HTMLElement, FormCardProps>(function FormCard(
  { className, variant, ...props },
  ref
) {
  return <section ref={ref} data-slot="form-card" className={cn(formCardVariants({ variant }), className)} {...props} />;
});

export const FormCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function FormCardHeader(
  { className, ...props },
  ref
) {
  return <div ref={ref} data-slot="form-card-header" className={cn("flex min-h-14 items-center justify-between gap-4 border-b border-inherit px-5 py-3.5", className)} {...props} />;
});

export const FormCardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function FormCardContent(
  { className, ...props },
  ref
) {
  return <div ref={ref} data-slot="form-card-content" className={cn("p-5", className)} {...props} />;
});

export const FormCardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function FormCardFooter(
  { className, ...props },
  ref
) {
  return <div ref={ref} data-slot="form-card-footer" className={cn("flex min-h-14 items-center justify-end gap-2 border-t border-inherit bg-[#FAF8F4]/70 px-5 py-3", className)} {...props} />;
});

export const FormCardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(function FormCardTitle(
  { className, ...props },
  ref
) {
  return <h2 ref={ref} data-slot="form-card-title" className={cn("text-sm font-semibold tracking-[-0.01em] text-[#25221F]", className)} {...props} />;
});

export const FormCardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(function FormCardDescription(
  { className, ...props },
  ref
) {
  return <p ref={ref} data-slot="form-card-description" className={cn("mt-0.5 text-xs leading-5 text-[#706A63]", className)} {...props} />;
});

export interface FormHelpProps extends InfoTooltipProps {
  /** A short technical term announced with the tooltip, when useful. */
  term?: string;
}

/** Contextual help for financial or technical terms. Wrap the page in InfoTooltipProvider once. */
export function FormHelp({ term, ariaLabel, content, ...props }: FormHelpProps) {
  return <InfoTooltip content={content} ariaLabel={ariaLabel ?? (term ? `Informasi tentang ${term}` : undefined)} {...props} />;
}

/** Semantic alias for FormHelp when the control is used strictly as a tooltip trigger. */
export const FormTooltip = FormHelp;

type FieldControlProps = {
  id?: string;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
};

export interface FormFieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  children: React.ReactElement<FieldControlProps>;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Connects the label to a non-standard form control. Defaults to the child id or a generated id. */
  htmlFor?: string;
  required?: boolean;
  sensitive?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  help?: React.ReactNode;
}

/**
 * Couples field metadata with one interactive control, including its accessible name and description.
 * For custom controls, pass `htmlFor` and forward that id to the focusable element.
 */
export function FormField({
  children,
  className,
  label,
  hint,
  error,
  htmlFor,
  required = false,
  sensitive = false,
  readOnly = false,
  disabled = false,
  help,
  ...props
}: FormFieldProps) {
  const generatedId = React.useId();
  const childProps = children.props;
  const controlId = htmlFor ?? childProps.id ?? `field-${generatedId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [childProps["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;

  const control = React.cloneElement(children, {
    id: childProps.id ?? controlId,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : childProps["aria-invalid"],
    "aria-required": required || undefined,
    disabled: disabled || childProps.disabled,
    readOnly: readOnly || childProps.readOnly,
    required: required || childProps.required,
    className: cn(Boolean(error) && "aria-[invalid=true]:border-[#A54B36] aria-[invalid=true]:focus:border-[#A54B36] aria-[invalid=true]:focus:ring-[#A54B36]/15", childProps.className),
  });

  return (
    <div
      data-slot="form-field"
      data-sensitive={sensitive || undefined}
      data-readonly={readOnly || undefined}
      data-disabled={disabled || undefined}
      className={cn("grid gap-1.5", disabled && "opacity-60", className)}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <label htmlFor={controlId} className="min-w-0 text-xs font-semibold tracking-[0.01em] text-[#3D3935]">
          {label}
          {required ? <span className="ml-0.5 text-[#9A5B31]" aria-hidden="true">*</span> : null}
        </label>
        {sensitive ? <span className="rounded border border-[#D8D1C8] bg-[#F5F2EC] px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.08em] text-[#625C55]">Sensitif</span> : null}
        {readOnly ? <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#817A72]">Baca saja</span> : null}
        {help}
      </div>
      {control}
      {hint ? <p id={hintId} className="text-xs leading-5 text-[#706A63]">{hint}</p> : null}
      {error ? <p id={errorId} role="alert" className="text-xs font-medium leading-5 text-[#A54B36]">{error}</p> : null}
    </div>
  );
}

export interface ResponsiveFormGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Compact by default; one column until the 640px breakpoint, then two. */
  gap?: "compact" | "default" | "relaxed";
}

export function ResponsiveFormGrid({ className, gap = "default", ...props }: ResponsiveFormGridProps) {
  return <div data-slot="responsive-form-grid" className={cn("grid grid-cols-1 sm:grid-cols-2", { "gap-3": gap === "compact", "gap-4": gap === "default", "gap-6": gap === "relaxed" }, className)} {...props} />;
}

export interface FormGridItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns occupied from the 640px breakpoint upward. */
  span?: 1 | 2;
}

export function FormGridItem({ className, span = 1, ...props }: FormGridItemProps) {
  return <div data-slot="form-grid-item" data-span={span} className={cn(span === 2 && "sm:col-span-2", className)} {...props} />;
}

const controlClassName =
  "flex h-10 w-full rounded-[0.625rem] border border-[#DCD8D1] bg-white px-3 text-sm text-[#25221F] shadow-[0_1px_1px_rgba(37,34,31,0.02)] outline-none transition-[border-color,box-shadow] placeholder:text-[#938D86] hover:border-[#C9C3BB] focus:border-[#3D3935] focus:ring-2 focus:ring-[#3D3935]/15 aria-[invalid=true]:border-[#A54B36] aria-[invalid=true]:focus:border-[#A54B36] aria-[invalid=true]:focus:ring-[#A54B36]/15 disabled:cursor-not-allowed disabled:bg-[#F5F2EC] disabled:text-[#817A72]";

export const TextField = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function TextField(
  { className, type = "text", ...props },
  ref
) {
  return <input ref={ref} type={type} data-slot="text-field" className={cn(controlClassName, className)} {...props} />;
});

export const TextareaField = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextareaField(
  { className, ...props },
  ref
) {
  return <textarea ref={ref} data-slot="textarea-field" className={cn(controlClassName, "h-auto min-h-24 resize-y py-2.5 leading-5", className)} {...props} />;
});

export const SelectField = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function SelectField(
  { className, children, ...props },
  ref
) {
  return <select ref={ref} data-slot="select-field" className={cn(controlClassName, "cursor-pointer appearance-auto pr-8", className)} {...props}>{children}</select>;
});

export const NativeSelectField = SelectField;

export const DateField = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(function DateField(
  { className, ...props },
  ref
) {
  return <input ref={ref} type="date" data-slot="date-field" className={cn(controlClassName, className)} {...props} />;
});

export const TimeField = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(function TimeField(
  { className, ...props },
  ref
) {
  return <input ref={ref} type="time" data-slot="time-field" className={cn(controlClassName, className)} {...props} />;
});

export interface MoneyFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue"> {
  currency?: string;
  /** Raw non-negative integer value. Separators are only present in the displayed value. */
  value?: string | number;
  /** Initial raw non-negative integer value for an uncontrolled field. */
  defaultValue?: string | number;
  /** Receives raw digits without Indonesian thousands separators. */
  onValueChange?: (value: string) => void;
}

function toRawMoneyValue(value: string | number | readonly string[] | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

function formatIdrInteger(value: string) {
  if (!value) return "";
  const normalized = value.replace(/^0+(?=\d)/, "");
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export const MoneyField = React.forwardRef<HTMLInputElement, MoneyFieldProps>(function MoneyField(
  { className, currency = "Rp", value, defaultValue, onChange, onValueChange, ...props },
  ref
) {
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState(() => toRawMoneyValue(defaultValue));
  const rawValue = isControlled ? toRawMoneyValue(value) : uncontrolledValue;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextRawValue = toRawMoneyValue(event.target.value);
    if (!isControlled) setUncontrolledValue(nextRawValue);
    onValueChange?.(nextRawValue);
    onChange?.(event);
  };

  return (
    <div data-slot="money-field" className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-[#706A63]">{currency}</span>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={formatIdrInteger(rawValue)}
        onChange={handleChange}
        className={cn(controlClassName, "pl-10 tabular-nums", className)}
        {...props}
      />
    </div>
  );
});

export const SearchField = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(function SearchField(
  { className, ...props },
  ref
) {
  return (
    <div data-slot="search-field" className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#817A72]" />
      <input ref={ref} type="search" className={cn(controlClassName, "pl-9", className)} {...props} />
    </div>
  );
});

export const CheckboxField = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(function CheckboxField(
  { className, ...props },
  ref
) {
  return <input ref={ref} type="checkbox" data-slot="checkbox-field" className={cn("size-4 shrink-0 rounded border-[#BDB6AE] text-[#3D3935] accent-[#3D3935] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D3935]/25 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />;
});

export const ColorField = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(function ColorField(
  { className, ...props },
  ref
) {
  return <input ref={ref} type="color" data-slot="color-field" className={cn("h-10 w-full cursor-pointer rounded-[0.625rem] border border-[#DCD8D1] bg-white p-1 outline-none focus-visible:ring-2 focus-visible:ring-[#3D3935]/25 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />;
});

export interface SubmitActionProps extends Omit<ButtonProps, "type" | "children"> {
  /** Keeps the action unavailable while its parent form processes a submission. */
  isSubmitting: boolean;
  label: React.ReactNode;
  busyLabel?: React.ReactNode;
}

/** A submit button with an explicit busy state and native double-submit prevention. */
export const SubmitAction = React.forwardRef<HTMLButtonElement, SubmitActionProps>(function SubmitAction(
  { className, disabled, isSubmitting, label, busyLabel = "Menyimpan…", onClick, ...props },
  ref
) {
  return (
    <Button
      ref={ref}
      type="submit"
      disabled={disabled || isSubmitting}
      aria-busy={isSubmitting || undefined}
      className={cn("min-w-28", className)}
      onClick={(event) => {
        if (isSubmitting) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    >
      {isSubmitting ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
      {isSubmitting ? busyLabel : label}
    </Button>
  );
});
