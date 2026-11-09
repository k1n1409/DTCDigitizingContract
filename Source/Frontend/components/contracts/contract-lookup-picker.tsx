"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ContractLookupOption = {
  id: string;
  label: string;
  detail?: string;
};

export function ContractLookupPicker({
  id, label, value, selectedLabel, options, searchPlaceholder, search,
  onSearchChange, onSelect, loading = false, error, invalid = false,
}: {
  id: string;
  label: string;
  value: string;
  selectedLabel?: string;
  options: ContractLookupOption[];
  searchPlaceholder: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  loading?: boolean;
  error?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value);
  const text = selected?.label || selectedLabel;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={text ? `${label}: ${text}` : label}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-auto min-h-11 w-full min-w-0 justify-between bg-background px-3 text-left",
            !text && "text-muted-foreground",
            invalid && "border-destructive",
          )}
        >
          <span className="min-w-0 truncate">{text || `Chọn ${label.toLocaleLowerCase("vi")}`}</span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-0 rounded-xl p-0">
        <Command label={label} shouldFilter={false}>
          <CommandInput
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={onSearchChange}
          />
          <CommandList aria-busy={loading} className="max-h-[min(17rem,var(--radix-popover-content-available-height))]">
            {loading ? (
              <div role="status" className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Đang tìm…
              </div>
            ) : error ? (
              <p role="alert" className="px-4 py-4 text-sm text-destructive">{error}</p>
            ) : (
              <>
                <CommandEmpty>{search.trim() ? "Không tìm thấy kết quả phù hợp." : "Chưa có lựa chọn."}</CommandEmpty>
                {options.map((option) => (
                  <CommandItem key={option.id} value={option.id} className="mx-1 my-1 min-h-11 cursor-pointer px-3" onSelect={() => {
                    onSelect(option.id);
                    setOpen(false);
                    onSearchChange("");
                  }}>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-medium">{option.label}</span>
                      {option.detail && <span className="mt-0.5 block break-words text-xs text-muted-foreground">{option.detail}</span>}
                    </span>
                    {value === option.id && <Check aria-hidden className="size-4 text-primary" />}
                  </CommandItem>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
