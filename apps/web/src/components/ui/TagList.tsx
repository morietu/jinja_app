// components/TagList.tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const tags = [
  "健康運",
  "仕事運",
  "縁結び",
  "学業成就",
  "金運",
  "厄除け",
  "家内安全",
];

export default function TagList({ onChange }: { onChange?: (tags: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleTag = (tag: string) => {
    const updated = selected.includes(tag)
      ? selected.filter((t) => t !== tag)
      : [...selected, tag];

    setSelected(updated);
    onChange?.(updated); // 親に通知
  };

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => toggleTag(tag)}
          className={cn(
            "px-3 py-1 rounded-full text-sm border transition",
            selected.includes(tag)
              ? "bg-red-600 text-white border-red-600"
              : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100"
          )}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
