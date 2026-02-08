"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface RepoValidationInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidate: () => void;
  isValidating: boolean;
  isValid: boolean | null;
  placeholder: string;
  label: string;
  fetchLabel: string;
  validMessage?: React.ReactNode;
}

export function RepoValidationInput({
  value,
  onChange,
  onValidate,
  isValidating,
  isValid,
  placeholder,
  label,
  fetchLabel,
  validMessage,
}: RepoValidationInputProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onValidate()}
            className="pr-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : isValid === true ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : isValid === false ? (
              <XCircle className="h-4 w-4 text-destructive" />
            ) : null}
          </div>
        </div>
        <Button
          onClick={onValidate}
          disabled={isValidating || !value.trim()}
        >
          <Search className="h-4 w-4 mr-2" />
          {fetchLabel}
        </Button>
      </div>
      {validMessage}
    </div>
  );
}
