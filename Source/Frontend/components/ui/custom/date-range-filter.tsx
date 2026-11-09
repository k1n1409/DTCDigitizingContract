"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DatePickerCalendar } from "@/components/ui/custom/date-picker-calendar";
import { CalendarDays, Delete } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";

function focusCalendarPanel(event: Event) {
  // Keep focus in the popover for keyboard navigation without selecting the
  // day input before the user actually chooses to type.
  event.preventDefault();
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.focus({ preventScroll: true });
  }
}

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface DateRangeFilterProps {
  dateRange: DateRange;
  onChange: (range: DateRange) => void;
  buttonClassName?: string;
  confirmOnDaySelect?: boolean;
  compact?: boolean;
}

export function DateRangeFilter({
  dateRange,
  onChange,
  buttonClassName = "bg-background",
  confirmOnDaySelect = false,
  compact = false,
}: DateRangeFilterProps) {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  return (
    <div className={cn("flex items-center gap-2", isMobile && "flex-1", compact && "flex-wrap")}>
      <Popover open={fromOpen} onOpenChange={setFromOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label={dateRange.from ? `Từ ngày ${format(dateRange.from, "dd/MM/yyyy")}` : "Chọn ngày bắt đầu"}
            className={cn(
              "justify-start text-left font-normal flex-1 bg-transparent",
              compact && "basis-28 gap-1.5 px-2",
              buttonClassName,
              !dateRange.from && "text-muted-foreground",
            )}
          >
            <CalendarDays className={cn("size-4", !compact && "mr-2")} />
            {dateRange.from ? (
              format(dateRange.from, "dd/MM/yyyy")
            ) : (
              <span>Từ ngày</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={confirmOnDaySelect ? focusCalendarPanel : undefined}>
          <DatePickerCalendar
            label="Từ ngày"
            date={dateRange.from}
            onChange={(date) => onChange({ ...dateRange, from: date })}
            onConfirm={() => setFromOpen(false)}
            confirmOnDaySelect={confirmOnDaySelect}
            maxDate={dateRange.to}
          />
        </PopoverContent>
      </Popover>

      <span aria-hidden className={cn("text-muted-foreground", compact && "hidden sm:inline")}>-</span>

      <Popover open={toOpen} onOpenChange={setToOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label={dateRange.to ? `Đến ngày ${format(dateRange.to, "dd/MM/yyyy")}` : "Chọn ngày kết thúc"}
            className={cn(
              "justify-start text-left font-normal flex-1",
              compact && "basis-28 gap-1.5 px-2",
              buttonClassName,
              !dateRange.to && "text-muted-foreground",
            )}
          >
            <CalendarDays className={cn("size-4", !compact && "mr-2")} />
            {dateRange.to ? (
              format(dateRange.to, "dd/MM/yyyy")
            ) : (
              <span>Đến ngày</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={confirmOnDaySelect ? focusCalendarPanel : undefined}>
          <DatePickerCalendar
            label="Đến ngày"
            date={dateRange.to}
            onChange={(date) => onChange({ ...dateRange, to: date })}
            onConfirm={() => setToOpen(false)}
            confirmOnDaySelect={confirmOnDaySelect}
            minDate={dateRange.from}
          />
        </PopoverContent>
      </Popover>

      {(dateRange.from || dateRange.to) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Xóa khoảng ngày"
          className="h-8 text-xs text-muted-foreground px-2 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onChange({ from: undefined, to: undefined })}
        >
          <Delete className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
