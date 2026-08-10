"use client";

import { useState, useEffect, useRef } from "react";
import { format, parse, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="flex items-center space-x-2">
      <Button variant="outline" size="icon" onClick={handlePrev} aria-label="Bulan sebelumnya">
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="relative" ref={ref}>
        <Button variant="outline" className="min-w-[150px] flex gap-2" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog" aria-controls="month-picker-dialog">
          <Calendar className="h-4 w-4" />
          <span>{format(currentDate, "MMMM yyyy")}</span>
        </Button>
        
        {open && (
          <div id="month-picker-dialog" role="dialog" aria-label="Pilih bulan" className="absolute top-full left-0 mt-2 w-[280px] p-4 bg-white rounded-md shadow-lg border border-gray-200 z-50">
            <div className="flex justify-between items-center mb-4">
              <Button variant="ghost" size="icon" onClick={() => setYear(year - 1)} aria-label="Tahun sebelumnya">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-bold">{year}</span>
              <Button variant="ghost" size="icon" onClick={() => setYear(year + 1)} aria-label="Tahun berikutnya">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <Button
                  key={i}
                  variant={currentDate.getMonth() === i && currentDate.getFullYear() === year ? "default" : "outline"}
                  className="text-sm py-1 h-8"
                  onClick={() => handleSelectMonth(i)}
                >
                  {format(new Date(2000, i, 1), "MMM")}
                </Button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <Button variant="secondary" className="w-full text-xs h-8" onClick={handleToday}>
                Lompat ke Bulan Ini
              </Button>
            </div>
          </div>
        )}
      </div>

      <Button variant="outline" size="icon" onClick={handleNext} aria-label="Bulan berikutnya">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
