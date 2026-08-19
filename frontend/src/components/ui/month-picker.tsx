"use client";

import { useState, useEffect, useRef } from "react";
import { format, parse, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MonthPickerProps = {
  period: string; // YYYY-MM
  onChange: (period: string) => void;
};

export function MonthPicker({ period, onChange }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (period) {
      setYear(parseInt(period.split("-")[0], 10));
    }
  }, [period]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const currentDate = period ? parse(period, "yyyy-MM", new Date()) : new Date();

  function handlePrev() {
    onChange(format(subMonths(currentDate, 1), "yyyy-MM"));
  }

  function handleNext() {
    onChange(format(addMonths(currentDate, 1), "yyyy-MM"));
  }

  function handleSelectMonth(m: number) {
    const newPeriod = `${year}-${String(m + 1).padStart(2, "0")}`;
    onChange(newPeriod);
    setOpen(false);
  }

  function handleToday() {
    onChange(format(new Date(), "yyyy-MM"));
    setOpen(false);
  }

  return (
    <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto bg-white sm:bg-transparent border sm:border-0 border-[#E8E6E1] rounded-xl p-1.5 sm:p-0 shadow-xs sm:shadow-none">
      <button
        type="button"
        onClick={handlePrev}
        aria-label="Bulan sebelumnya"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#E8E6E1] bg-[#FAF9F5] text-[#1A1A1A] hover:bg-[#F0EEE9] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A]"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="relative flex-1 sm:flex-initial min-w-0" ref={ref}>
        <button
          type="button"
          className="w-full sm:w-auto flex-1 sm:flex-initial min-h-[44px] justify-center flex items-center gap-2 rounded-lg border border-[#E8E6E1] bg-white hover:bg-[#FAF9F5] text-sm font-bold text-[#1A1A1A] px-3.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A]"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls="month-picker-dialog"
        >
          <Calendar className="h-4 w-4 text-[#6E6D7A] shrink-0" />
          <span className="truncate">{format(currentDate, "MMMM yyyy")}</span>
        </button>

        {open && (
          <div
            id="month-picker-dialog"
            role="dialog"
            aria-label="Pilih bulan"
            className="absolute top-full left-0 sm:left-0 mt-2 w-[280px] max-w-[calc(100vw-2rem)] p-4 bg-white rounded-xl shadow-xl border border-[#E8E6E1] z-50 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-center mb-3">
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[#F0EEE9] text-[#1A1A1A] transition-colors"
                onClick={() => setYear(year - 1)}
                aria-label="Tahun sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-bold text-sm text-[#1A1A1A]">{year}</span>
              <button
                type="button"
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[#F0EEE9] text-[#1A1A1A] transition-colors"
                onClick={() => setYear(year + 1)}
                aria-label="Tahun berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }).map((_, i) => {
                const isSelected =
                  currentDate.getMonth() === i && currentDate.getFullYear() === year;
                return (
                  <button
                    key={i}
                    type="button"
                    className={cn(
                      "text-xs font-semibold py-2 px-1 rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A]",
                      isSelected
                        ? "bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-xs"
                        : "bg-[#FAF9F5] text-[#1A1A1A] border-[#E8E6E1] hover:bg-[#F0EEE9]"
                    )}
                    onClick={() => handleSelectMonth(i)}
                  >
                    {format(new Date(2000, i, 1), "MMM")}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-[#E8E6E1]">
              <Button
                variant="secondary"
                className="w-full text-xs h-8 font-semibold bg-[#F0EEE9] hover:bg-[#E5E2DC] text-[#1A1A1A] border border-[#E0DDD6] rounded-lg"
                onClick={handleToday}
              >
                Lompat ke Bulan Ini
              </Button>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleNext}
        aria-label="Bulan berikutnya"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-[#E8E6E1] bg-[#FAF9F5] text-[#1A1A1A] hover:bg-[#F0EEE9] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A]"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
