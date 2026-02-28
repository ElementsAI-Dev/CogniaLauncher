'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MarkdownRenderer } from '@/components/docs/markdown-renderer';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import { Wrench } from 'lucide-react';
import type {
  UiBlock,
  UiTextBlock,
  UiHeadingBlock,
  UiCodeBlock,
  UiTableBlock,
  UiKeyValueBlock,
  UiFormBlock,
  UiActionsBlock,
  UiGroupBlock,
  UiAlertBlock,
  UiBadgeBlock,
  UiProgressBlock,
  UiImageBlock,
  UiMarkdownBlock,
  FormField,
  PluginUiAction,
} from '@/types/plugin-ui';

// ============================================================================
// Dynamic Icon (reuses pattern from tool-card.tsx)
// ============================================================================

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
  const Resolved = icons[name];
  if (!Resolved) return <Wrench className={className} />;
  return <Resolved className={className} />;
}

// ============================================================================
// Main Renderer
// ============================================================================

interface PluginUiRendererProps {
  blocks: UiBlock[];
  onAction: (action: PluginUiAction) => void;
  state?: Record<string, unknown>;
  className?: string;
}

export function PluginUiRenderer({ blocks, onAction, state, className }: PluginUiRendererProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} onAction={onAction} state={state} />
      ))}
    </div>
  );
}

// ============================================================================
// Block Dispatcher
// ============================================================================

interface BlockRendererProps {
  block: UiBlock;
  onAction: (action: PluginUiAction) => void;
  state?: Record<string, unknown>;
}

function BlockRenderer({ block, onAction, state }: BlockRendererProps) {
  switch (block.type) {
    case 'text':
      return <TextBlock block={block} />;
    case 'heading':
      return <HeadingBlock block={block} />;
    case 'markdown':
      return <MarkdownBlock block={block} />;
    case 'divider':
      return <Separator />;
    case 'alert':
      return <AlertBlock block={block} />;
    case 'badge':
      return <BadgeBlock block={block} />;
    case 'progress':
      return <ProgressBlock block={block} />;
    case 'image':
      return <ImageBlock block={block} />;
    case 'code':
      return <CodeBlockComponent block={block} />;
    case 'table':
      return <TableBlock block={block} />;
    case 'key-value':
      return <KeyValueBlock block={block} />;
    case 'form':
      return <FormBlock block={block} onAction={onAction} state={state} />;
    case 'actions':
      return <ActionsBlock block={block} onAction={onAction} state={state} />;
    case 'group':
      return <GroupBlock block={block} onAction={onAction} state={state} />;
    default:
      return null;
  }
}

// ============================================================================
// Display Blocks
// ============================================================================

function TextBlock({ block }: { block: UiTextBlock }) {
  const variantClass =
    block.variant === 'muted'
      ? 'text-muted-foreground'
      : block.variant === 'code'
        ? 'font-mono text-sm bg-muted/50 px-2 py-1 rounded'
        : '';
  return <p className={cn('text-sm', variantClass)}>{block.content}</p>;
}

function HeadingBlock({ block }: { block: UiHeadingBlock }) {
  const level = block.level ?? 2;
  const Tag = (`h${level}` as 'h1' | 'h2' | 'h3');
  const sizeClass = level === 1 ? 'text-xl font-bold' : level === 2 ? 'text-lg font-semibold' : 'text-base font-medium';
  return <Tag className={sizeClass}>{block.content}</Tag>;
}

function MarkdownBlock({ block }: { block: UiMarkdownBlock }) {
  return <MarkdownRenderer content={block.content} className="prose-sm max-w-none" />;
}

function AlertBlock({ block }: { block: UiAlertBlock }) {
  return (
    <Alert variant={block.variant === 'destructive' ? 'destructive' : 'default'}>
      {block.title && <AlertTitle>{block.title}</AlertTitle>}
      <AlertDescription>{block.message}</AlertDescription>
    </Alert>
  );
}

function BadgeBlock({ block }: { block: UiBadgeBlock }) {
  return <Badge variant={block.variant ?? 'default'}>{block.label}</Badge>;
}

function ProgressBlock({ block }: { block: UiProgressBlock }) {
  const max = block.max ?? 100;
  const pct = Math.min(100, Math.max(0, (block.value / max) * 100));
  return (
    <div className="space-y-1">
      {block.label && <span className="text-xs text-muted-foreground">{block.label}</span>}
      <Progress value={pct} />
    </div>
  );
}

function ImageBlock({ block }: { block: UiImageBlock }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={block.src}
      alt={block.alt ?? ''}
      width={block.width}
      height={block.height}
      className="rounded-md max-w-full"
    />
  );
}

function CodeBlockComponent({ block }: { block: UiCodeBlock }) {
  return (
    <div className="relative">
      {block.language && (
        <span className="absolute top-2 right-2 text-[10px] font-mono text-muted-foreground">{block.language}</span>
      )}
      <pre className="rounded-md bg-muted/50 p-4 overflow-x-auto text-sm font-mono">
        <code>{block.code}</code>
      </pre>
    </div>
  );
}

function TableBlock({ block }: { block: UiTableBlock }) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {block.headers.map((h, i) => (
              <TableHead key={i}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {block.rows.map((row, ri) => (
            <TableRow key={ri}>
              {row.map((cell, ci) => (
                <TableCell key={ci}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function KeyValueBlock({ block }: { block: UiKeyValueBlock }) {
  return (
    <div className="rounded-md border divide-y">
      {block.items.map((item, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
          <span className="text-muted-foreground">{item.key}</span>
          <span className="font-medium font-mono">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Interactive Blocks
// ============================================================================

function FormBlock({
  block,
  onAction,
  state,
}: {
  block: UiFormBlock;
  onAction: (action: PluginUiAction) => void;
  state?: Record<string, unknown>;
}) {
  const [formData, setFormData] = useState<Record<string, string | boolean | number>>(() => {
    const initial: Record<string, string | boolean | number> = {};
    for (const field of block.fields) {
      switch (field.type) {
        case 'input':
        case 'textarea':
          initial[field.id] = field.defaultValue ?? '';
          break;
        case 'select':
          initial[field.id] = field.defaultValue ?? '';
          break;
        case 'checkbox':
          initial[field.id] = field.defaultChecked ?? false;
          break;
        case 'slider':
          initial[field.id] = field.defaultValue ?? field.min;
          break;
      }
    }
    return initial;
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onAction({ action: 'form_submit', formId: block.id, formData, state });
    },
    [block.id, formData, state, onAction],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4">
      {block.fields.map((field) => (
        <FormFieldRenderer
          key={field.id}
          field={field}
          value={formData[field.id]}
          onChange={(v) => setFormData((prev) => ({ ...prev, [field.id]: v }))}
        />
      ))}
      <Button type="submit" size="sm">
        {block.submitLabel ?? 'Submit'}
      </Button>
    </form>
  );
}

function FormFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string | boolean | number;
  onChange: (v: string | boolean | number) => void;
}) {
  switch (field.type) {
    case 'input':
      return (
        <div className="space-y-1.5">
          <Label htmlFor={field.id} className="text-sm">{field.label}</Label>
          <Input
            id={field.id}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        </div>
      );
    case 'textarea':
      return (
        <div className="space-y-1.5">
          <Label htmlFor={field.id} className="text-sm">{field.label}</Label>
          <Textarea
            id={field.id}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={field.rows ?? 4}
          />
        </div>
      );
    case 'select':
      return (
        <div className="space-y-1.5">
          <Label className="text-sm">{field.label}</Label>
          <Select value={value as string} onValueChange={onChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {field.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={field.id}
            checked={value as boolean}
            onCheckedChange={(checked) => onChange(!!checked)}
          />
          <Label htmlFor={field.id} className="text-sm font-normal cursor-pointer">{field.label}</Label>
        </div>
      );
    case 'slider':
      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{field.label}</Label>
            <span className="text-xs text-muted-foreground font-mono">{value}</span>
          </div>
          <Slider
            value={[value as number]}
            onValueChange={([v]) => onChange(v)}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
          />
        </div>
      );
    default:
      return null;
  }
}

function ActionsBlock({
  block,
  onAction,
  state,
}: {
  block: UiActionsBlock;
  onAction: (action: PluginUiAction) => void;
  state?: Record<string, unknown>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {block.buttons.map((btn) => (
        <Button
          key={btn.id}
          variant={(btn.variant as 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost') ?? 'default'}
          size="sm"
          className="gap-1.5"
          onClick={() => onAction({ action: 'button_click', buttonId: btn.id, state })}
        >
          {btn.icon && <DynamicIcon name={btn.icon} className="h-3.5 w-3.5" />}
          {btn.label}
        </Button>
      ))}
    </div>
  );
}

// ============================================================================
// Layout Block
// ============================================================================

function GroupBlock({
  block,
  onAction,
  state,
}: {
  block: UiGroupBlock;
  onAction: (action: PluginUiAction) => void;
  state?: Record<string, unknown>;
}) {
  const isHorizontal = block.direction === 'horizontal';
  const gap = block.gap ?? 4;
  return (
    <div
      className={cn('flex', isHorizontal ? 'flex-row flex-wrap items-start' : 'flex-col')}
      style={{ gap: `${gap * 4}px` }}
    >
      {block.children.map((child, i) => (
        <BlockRenderer key={i} block={child} onAction={onAction} state={state} />
      ))}
    </div>
  );
}
