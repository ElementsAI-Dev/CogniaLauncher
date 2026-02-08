"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export interface RefItem {
  name: string;
  badges?: Array<{
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }>;
}

interface RefListSelectorProps {
  items: RefItem[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
  emptyMessage: string;
  idPrefix: string;
  height?: string;
}

export function RefListSelector({
  items,
  selectedValue,
  onSelect,
  emptyMessage,
  idPrefix,
  height = "h-[200px]",
}: RefListSelectorProps) {
  return (
    <ScrollArea className={`${height} border rounded-md`}>
      {items.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <RadioGroup
          value={selectedValue || ""}
          onValueChange={onSelect}
          className="p-2"
        >
          {items.map((item) => (
            <div
              key={item.name}
              className="flex items-center space-x-2 p-2 rounded hover:bg-muted"
            >
              <RadioGroupItem
                value={item.name}
                id={`${idPrefix}-${item.name}`}
              />
              <Label
                htmlFor={`${idPrefix}-${item.name}`}
                className="flex-1 cursor-pointer flex items-center justify-between"
              >
                <span className="font-mono">{item.name}</span>
                {item.badges && item.badges.length > 0 && (
                  <div className="flex gap-1">
                    {item.badges.map((badge) => (
                      <Badge key={badge.label} variant={badge.variant}>
                        {badge.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}
    </ScrollArea>
  );
}
