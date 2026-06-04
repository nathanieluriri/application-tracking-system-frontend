"use client";

import { Button } from "@/components/ui/button";

interface SuggestionChipsProps {
  suggestions: string[];
  onPick: (text: string) => void;
}

export function SuggestionChips({ suggestions, onPick }: SuggestionChipsProps) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((text, i) => (
        <Button
          key={`${i}-${text}`}
          type="button"
          variant="outline"
          size="sm"
          className="h-auto rounded-full px-3 py-1 text-xs font-normal"
          onClick={() => onPick(text)}
        >
          {text}
        </Button>
      ))}
    </div>
  );
}
