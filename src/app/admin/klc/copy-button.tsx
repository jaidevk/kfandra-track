"use client";

import { useState } from "react";

export function CopySheetButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50"
    >
      {copied ? "Copied ✓" : "Copy sheet as text"}
    </button>
  );
}
