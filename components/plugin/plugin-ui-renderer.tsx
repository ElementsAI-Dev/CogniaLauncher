'use client';

import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { writeClipboard } from '@/lib/clipboard';
import { useLocale } from '@/components/providers/locale-provider';
import { DynamicIcon } from '@/components/ui/dynamic-icon';
import { Copy, Check, Upload } from 'lucide-react';
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
  UiTabsBlock,
  UiAccordionBlock,
  UiCopyButtonBlock,
  UiFileInputBlock,
  UiJsonViewBlock,
  UiDescriptionListBlock,
  UiStatCardsBlock,
  UiResultBlock,
  FormField,
  PluginUiAction,
} from '@/types/plugin-ui';

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
    case 'tabs':
      return <TabsBlock block={block} onAction={onAction} state={state} />;
    case 'accordion':
      return <AccordionBlock block={block} onAction={onAction} state={state} />;
    case 'copy-button':
      return <CopyButtonBlock block={block} />;
    case 'file-input':
      return <FileInputBlock block={block} onAction={onAction} state={state} />;
    case 'json-view':
      return <JsonViewBlock block={block} />;
    case 'description-list':
      return <DescriptionListBlock block={block} />;
    case 'stat-cards':
      return <StatCardsBlock block={block} />;
    case 'result':
      return <ResultBlock block={block} />;
    case 'group':
      return <GroupBlock block={block} onAction={onAction} state={state} />;
    default:
      return <UnsupportedBlockFallback type={(block as { type?: string }).type ?? 'unknown'} />;
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

function JsonViewBlock({ block }: { block: UiJsonViewBlock }) {
  const pretty = JSON.stringify(block.data, null, 2);
  return (
    <div className="space-y-2">
      {block.label && <span className="text-sm font-medium">{block.label}</span>}
      <pre className="rounded-md bg-muted/50 p-4 overflow-x-auto text-sm font-mono">
        <code>{pretty}</code>
      </pre>
    </div>
  );
}

function DescriptionListBlock({ block }: { block: UiDescriptionListBlock }) {
  return (
    <dl className="rounded-md border divide-y">
      {block.items.map((item, i) => (
        <div key={i} className="grid grid-cols-[140px_1fr] gap-3 px-3 py-2 text-sm">
          <dt className="text-muted-foreground">{item.term}</dt>
          <dd className="font-medium">{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatCardsBlock({ block }: { block: UiStatCardsBlock }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {block.stats.map((stat) => (
        <div key={stat.id} className="rounded-md border p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{stat.label}</span>
            {stat.status && stat.status !== 'default' && (
              <Badge
                variant={
                  stat.status === 'error'
                    ? 'destructive'
                    : stat.status === 'warning'
                      ? 'outline'
                      : 'secondary'
                }
              >
                {stat.status}
              </Badge>
            )}
          </div>
          <p className="text-2xl font-semibold leading-none">{stat.value}</p>
          {stat.helpText && <p className="text-xs text-muted-foreground">{stat.helpText}</p>}
        </div>
      ))}
    </div>
  );
}

function ResultBlock({ block }: { block: UiResultBlock }) {
  const variant = block.status === 'error' ? 'destructive' : 'default';
  return (
    <Alert variant={variant}>
      {block.title && <AlertTitle>{block.title}</AlertTitle>}
      <AlertDescription>
        <div className="space-y-1">
          <p>{block.message}</p>
          {block.details && (
            <p className="text-xs text-muted-foreground">{block.details}</p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

function UnsupportedBlockFallback({ type }: { type: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Unsupported block type</AlertTitle>
      <AlertDescription className="font-mono text-xs">{String(type)}</AlertDescription>
    </Alert>
  );
}

// ============================================================================
// i18n Helper Components
// ============================================================================

function SubmitButton({ label }: { label?: string }) {
  const { t } = useLocale();
  return (
    <Button type="submit" size="sm">
      {label ?? t('toolbox.plugin.defaultSubmit')}
    </Button>
  );
}

function ChooseFileButton({ onClick }: { onClick: () => void }) {
  const { t } = useLocale();
  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={onClick}>
      <Upload className="h-3.5 w-3.5" />
      {t('toolbox.plugin.chooseFile')}
    </Button>
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
  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const field of block.fields) {
      switch (field.type) {
        case 'input':
        case 'password':
        case 'textarea':
          initial[field.id] = field.defaultValue ?? '';
          break;
        case 'date-time':
          initial[field.id] = field.defaultValue ?? '';
          break;
        case 'number':
          initial[field.id] = field.defaultValue ?? 0;
          break;
        case 'select':
        case 'radio-group':
          initial[field.id] = field.defaultValue ?? '';
          break;
        case 'multi-select':
          initial[field.id] = field.defaultValues ?? [];
          break;
        case 'checkbox':
        case 'switch':
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
      const formDataTypes = Object.fromEntries(
        block.fields.map((field) => [field.id, field.type]),
      );
      onAction({
        action: 'form_submit',
        version: 2,
        sourceType: 'form',
        sourceId: block.id,
        formId: block.id,
        formData,
        formDataTypes,
        state,
      });
    },
    [block, formData, state, onAction],
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
      <SubmitButton label={block.submitLabel} />
    </form>
  );
}

function FormFieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
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
    case 'number':
      return (
        <div className="space-y-1.5">
          <Label htmlFor={field.id} className="text-sm">{field.label}</Label>
          <Input
            id={field.id}
            type="number"
            value={typeof value === 'number' ? String(value) : ''}
            onChange={(e) => {
              const next = e.target.value === '' ? '' : Number(e.target.value);
              onChange(next === '' || Number.isNaN(next) ? 0 : next);
            }}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            step={field.step}
            required={field.required}
          />
        </div>
      );
    case 'password':
      return (
        <div className="space-y-1.5">
          <Label htmlFor={field.id} className="text-sm">{field.label}</Label>
          <Input
            id={field.id}
            type="password"
            value={typeof value === 'string' ? value : ''}
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
    case 'radio-group':
      return (
        <div className="space-y-1.5">
          <Label className="text-sm">{field.label}</Label>
          <RadioGroup
            value={typeof value === 'string' ? value : ''}
            onValueChange={onChange}
            className="space-y-1.5"
          >
            {field.options.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupItem id={`${field.id}-${opt.value}`} value={opt.value} />
                <Label htmlFor={`${field.id}-${opt.value}`} className="text-sm font-normal cursor-pointer">
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      );
    case 'checkbox':
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={field.id}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(!!checked)}
          />
          <Label htmlFor={field.id} className="text-sm font-normal cursor-pointer">{field.label}</Label>
        </div>
      );
    case 'switch':
      return (
        <div className="flex items-center justify-between gap-2 rounded-md border p-3">
          <Label htmlFor={field.id} className="text-sm font-normal cursor-pointer">{field.label}</Label>
          <Switch
            id={field.id}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(!!checked)}
          />
        </div>
      );
    case 'date-time':
      return (
        <div className="space-y-1.5">
          <Label htmlFor={field.id} className="text-sm">{field.label}</Label>
          <Input
            id={field.id}
            type="datetime-local"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            min={field.min}
            max={field.max}
          />
        </div>
      );
    case 'multi-select': {
      const current = Array.isArray(value) ? value.map(String) : [];
      return (
        <div className="space-y-2">
          <Label className="text-sm">{field.label}</Label>
          <div className="space-y-1.5 rounded-md border p-3">
            {field.options.map((opt) => {
              const checked = current.includes(opt.value);
              return (
                <div key={opt.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`${field.id}-${opt.value}`}
                    checked={checked}
                    onCheckedChange={(isChecked) => {
                      if (isChecked) {
                        onChange([...current, opt.value]);
                        return;
                      }
                      onChange(current.filter((item) => item !== opt.value));
                    }}
                  />
                  <Label htmlFor={`${field.id}-${opt.value}`} className="text-sm font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    case 'slider':
      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{field.label}</Label>
            <span className="text-xs text-muted-foreground font-mono">{typeof value === 'number' ? value : 0}</span>
          </div>
          <Slider
            value={[typeof value === 'number' ? value : field.min]}
            onValueChange={([v]) => onChange(v)}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
          />
        </div>
      );
    default:
      return (
        <Alert variant="destructive">
          <AlertTitle>Unsupported field type</AlertTitle>
          <AlertDescription className="font-mono text-xs">
            {(field as { type?: string }).type ?? 'unknown'}
          </AlertDescription>
        </Alert>
      );
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
          onClick={() =>
            onAction({
              action: 'button_click',
              version: 2,
              sourceType: 'actions',
              sourceId: btn.id,
              buttonId: btn.id,
              state,
            })
          }
        >
          {btn.icon && <DynamicIcon name={btn.icon} className="h-3.5 w-3.5" />}
          {btn.label}
        </Button>
      ))}
    </div>
  );
}

// ============================================================================
// Extended Blocks
// ============================================================================

function TabsBlock({
  block,
  onAction,
  state,
}: {
  block: UiTabsBlock;
  onAction: (action: PluginUiAction) => void;
  state?: Record<string, unknown>;
}) {
  const defaultTab = block.defaultTab ?? block.tabs[0]?.id;
  return (
    <Tabs defaultValue={defaultTab} onValueChange={(tabId) => {
      onAction({
        action: 'tab_change',
        version: 2,
        sourceType: 'tabs',
        sourceId: tabId,
        tabId,
        state,
      });
    }}>
      <TabsList>
        {block.tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>
        ))}
      </TabsList>
      {block.tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="space-y-4 pt-2">
          {tab.children.map((child, i) => (
            <BlockRenderer key={i} block={child} onAction={onAction} state={state} />
          ))}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function AccordionBlock({
  block,
  onAction,
  state,
}: {
  block: UiAccordionBlock;
  onAction: (action: PluginUiAction) => void;
  state?: Record<string, unknown>;
}) {
  return (
    <Accordion type="multiple" className="w-full">
      {block.items.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger>{item.title}</AccordionTrigger>
          <AccordionContent className="space-y-4">
            {item.children.map((child, i) => (
              <BlockRenderer key={i} block={child} onAction={onAction} state={state} />
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function CopyButtonBlock({ block }: { block: UiCopyButtonBlock }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await writeClipboard(block.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      await navigator.clipboard.writeText(block.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [block.content]);
  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopy}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {block.label ?? (copied ? t('toolbox.actions.copied') : t('toolbox.actions.copy'))}
    </Button>
  );
}

function FileInputBlock({
  block,
  onAction,
  state,
}: {
  block: UiFileInputBlock;
  onAction: (action: PluginUiAction) => void;
  state?: Record<string, unknown>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;
      const includeDataUrl = block.includeDataUrl ?? false;
      const files: { name: string; size: number; type: string; dataUrl?: string; lastModified?: number }[] = [];
      for (const file of Array.from(fileList)) {
        let dataUrl: string | undefined;
        if (includeDataUrl) {
          dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        }
        files.push({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          ...(dataUrl ? { dataUrl } : {}),
        });
      }
      onAction({
        action: 'file_selected',
        version: 2,
        sourceType: 'file-input',
        sourceId: block.id,
        fileInputId: block.id,
        files,
        state,
      });
    },
    [block.id, block.includeDataUrl, onAction, state],
  );
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{block.label}</Label>
      <div className="flex items-center gap-2">
        <ChooseFileButton onClick={() => inputRef.current?.click()} />
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={block.accept}
          multiple={block.multiple}
          onChange={handleChange}
        />
      </div>
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
