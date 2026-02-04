'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ValidationRule {
  min?: number;
  max?: number;
  pattern?: RegExp;
  patternMessage?: string;
}

const VALIDATION_RULES: Record<string, ValidationRule> = {
  'general.parallel_downloads': { min: 1, max: 16 },
  'general.metadata_cache_ttl': { min: 60, max: 86400 },
  'network.timeout': { min: 5, max: 300 },
  'network.retries': { min: 0, max: 10 },
  'network.proxy': { pattern: /^(https?:\/\/.*)?$/, patternMessage: 'Must be a valid URL or empty' },
  'mirrors.npm': { pattern: /^https?:\/\/.+$/, patternMessage: 'Must be a valid URL' },
  'mirrors.pypi': { pattern: /^https?:\/\/.+$/, patternMessage: 'Must be a valid URL' },
  'mirrors.crates': { pattern: /^https?:\/\/.+$/, patternMessage: 'Must be a valid URL' },
  'mirrors.go': { pattern: /^https?:\/\/.+$/, patternMessage: 'Must be a valid URL' },
};

export function validateField(key: string, value: string, t: (key: string, params?: Record<string, string | number>) => string): string | null {
  const rules = VALIDATION_RULES[key];
  if (!rules) return null;

  if (rules.min !== undefined || rules.max !== undefined) {
    const num = Number(value);
    if (isNaN(num)) return t('validation.mustBeNumber');
    if (rules.min !== undefined && num < rules.min) {
      return t('validation.min', { min: rules.min });
    }
    if (rules.max !== undefined && num > rules.max) {
      return t('validation.max', { max: rules.max });
    }
  }

  if (rules.pattern && value && !rules.pattern.test(value)) {
    return rules.patternMessage || t('validation.invalidFormat');
  }

  return null;
}

export interface SettingItemProps {
  id: string;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  min?: number;
  max?: number;
  placeholder?: string;
  error?: string | null;
  disabled?: boolean;
  originalValue?: string;
  highlightMatch?: boolean;
}

export function SettingItem({
  id,
  label,
  description,
  value,
  onChange,
  type = 'text',
  min,
  max,
  placeholder,
  error,
  disabled = false,
  originalValue,
  highlightMatch = false,
}: SettingItemProps) {
  const descId = `${id}-desc`;
  const errorId = `${id}-error`;
  const isModified = originalValue !== undefined && value !== originalValue;

  return (
    <div
      className={cn(
        'flex items-center justify-between py-3 rounded-md transition-colors',
        highlightMatch && 'bg-yellow-50 dark:bg-yellow-900/20 px-3 -mx-3'
      )}
    >
      <div className="space-y-0.5 flex-1 mr-4">
        <Label htmlFor={id} className="font-medium flex items-center gap-2">
          {label}
          {isModified && (
            <span
              className="h-2 w-2 rounded-full bg-amber-500"
              title="Modified"
              aria-label="This setting has been modified"
            />
          )}
        </Label>
        <p id={descId} className="text-sm text-muted-foreground">
          {description}
        </p>
        {error && (
          <p id={errorId} className="text-sm text-destructive mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={error ? `${descId} ${errorId}` : descId}
        aria-invalid={!!error}
        min={min}
        max={max}
        placeholder={placeholder}
        disabled={disabled}
        className={cn('w-48', error && 'border-destructive', isModified && 'border-amber-500')}
      />
    </div>
  );
}
