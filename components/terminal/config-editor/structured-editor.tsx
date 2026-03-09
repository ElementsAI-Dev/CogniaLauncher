'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ShellConfigEntries } from '@/types/tauri';

interface TerminalConfigStructuredEditorProps {
  entries: ShellConfigEntries;
  fallbackReason?: string | null;
  onChange: (next: ShellConfigEntries) => void;
}

function updateTupleList(
  source: [string, string][],
  index: number,
  next: [string, string],
): [string, string][] {
  return source.map((item, itemIndex) => (itemIndex === index ? next : item));
}

export function TerminalConfigStructuredEditor({
  entries,
  fallbackReason = null,
  onChange,
}: TerminalConfigStructuredEditorProps) {
  if (fallbackReason) {
    return (
      <Alert>
        <AlertTitle>Structured Editing Unavailable</AlertTitle>
        <AlertDescription>{fallbackReason}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4" data-testid="terminal-config-editor-structured">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Aliases</CardTitle>
          <CardAction>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                onChange({
                  ...entries,
                  aliases: [...entries.aliases, ['', '']],
                })
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2">
          {entries.aliases.map(([name, value], index) => (
            <div key={`alias-${index}`} className="grid grid-cols-[1fr,1fr,auto] gap-2">
              <Input
                value={name}
                onChange={(event) =>
                  onChange({
                    ...entries,
                    aliases: updateTupleList(entries.aliases, index, [
                      event.target.value,
                      value,
                    ]),
                  })
                }
                placeholder="name"
              />
              <Input
                value={value}
                onChange={(event) =>
                  onChange({
                    ...entries,
                    aliases: updateTupleList(entries.aliases, index, [
                      name,
                      event.target.value,
                    ]),
                  })
                }
                placeholder="command"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() =>
                  onChange({
                    ...entries,
                    aliases: entries.aliases.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
                aria-label={`Remove alias ${name || index + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Exports</CardTitle>
          <CardAction>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                onChange({
                  ...entries,
                  exports: [...entries.exports, ['', '']],
                })
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2">
          {entries.exports.map(([name, value], index) => (
            <div key={`export-${index}`} className="grid grid-cols-[1fr,1fr,auto] gap-2">
              <Input
                value={name}
                onChange={(event) =>
                  onChange({
                    ...entries,
                    exports: updateTupleList(entries.exports, index, [
                      event.target.value,
                      value,
                    ]),
                  })
                }
                placeholder="KEY"
              />
              <Input
                value={value}
                onChange={(event) =>
                  onChange({
                    ...entries,
                    exports: updateTupleList(entries.exports, index, [
                      name,
                      event.target.value,
                    ]),
                  })
                }
                placeholder="VALUE"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() =>
                  onChange({
                    ...entries,
                    exports: entries.exports.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
                aria-label={`Remove export ${name || index + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sources</CardTitle>
          <CardAction>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                onChange({
                  ...entries,
                  sources: [...entries.sources, ''],
                })
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2">
          {entries.sources.map((source, index) => (
            <div key={`source-${index}`} className="grid grid-cols-[1fr,auto] gap-2">
              <Input
                value={source}
                onChange={(event) =>
                  onChange({
                    ...entries,
                    sources: entries.sources.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item,
                    ),
                  })
                }
                placeholder="path/to/file"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() =>
                  onChange({
                    ...entries,
                    sources: entries.sources.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
                aria-label={`Remove source ${index + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
