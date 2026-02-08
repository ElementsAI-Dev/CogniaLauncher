"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export interface ArchiveFormat {
  value: string;
  label: string;
}

interface ArchiveFormatSelectorProps {
  format: string;
  onFormatChange: (format: string) => void;
  formats: ArchiveFormat[];
  idPrefix: string;
  label: string;
}

export function ArchiveFormatSelector({
  format,
  onFormatChange,
  formats,
  idPrefix,
  label,
}: ArchiveFormatSelectorProps) {
  return (
    <div className="mt-3 flex items-center gap-4">
      <Label>{label}:</Label>
      <RadioGroup
        value={format}
        onValueChange={onFormatChange}
        className="flex gap-4"
      >
        {formats.map((fmt) => (
          <div key={fmt.value} className="flex items-center space-x-2">
            <RadioGroupItem
              value={fmt.value}
              id={`${idPrefix}-${fmt.value}`}
            />
            <Label htmlFor={`${idPrefix}-${fmt.value}`}>{fmt.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
