"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Custom listbox so the open menu has the same rounded border on every browser. */
export function RoundedSelect({ value, onValueChange, options, disabled, className, id, "aria-label": ariaLabel }: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  return <Select value={`value:${value}`} onValueChange={next => onValueChange(next.slice(6))} disabled={disabled}>
    <SelectTrigger id={id} aria-label={ariaLabel} className={cn("h-10 w-full min-w-0 rounded-xl bg-background text-[15px] [&_[data-slot=select-value]]:truncate", className)}><SelectValue /></SelectTrigger>
    <SelectContent showSearch={options.length > 8} className="rounded-xl border p-1 shadow-lg [&_input]:text-[15px]">
      {options.map(option => <SelectItem key={option.value} value={`value:${option.value}`} className="rounded-lg py-2 text-[15px]">{option.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}
