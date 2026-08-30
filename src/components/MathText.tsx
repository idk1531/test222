"use client";

import React from "react";
import { KaTeXRenderer } from "./KaTeXRenderer";

interface MathTextProps {
  text: string;
  className?: string;
}

export const MathText: React.FC<MathTextProps> = ({ text, className = "" }) => {
  if (!text) return null;

  // Split text by $$...$$ (display math) and $...$ (inline math)
  const parts = [];
  const regex = /(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.substring(lastIndex, match.index),
      });
    }
    const token = match[0];
    if (token.startsWith("$$") && token.endsWith("$$")) {
      parts.push({
        type: "display-math",
        content: token.slice(2, -2).trim(),
      });
    } else if (token.startsWith("$") && token.endsWith("$")) {
      parts.push({
        type: "inline-math",
        content: token.slice(1, -1).trim(),
      });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.substring(lastIndex),
    });
  }

  return (
    <span className={className}>
      {parts.map((p, idx) => {
        if (p.type === "display-math") {
          return (
            <span key={idx} className="block my-1.5 overflow-x-auto text-center">
              <KaTeXRenderer latex={p.content} displayMode={true} />
            </span>
          );
        }
        if (p.type === "inline-math") {
          return (
            <KaTeXRenderer
              key={idx}
              latex={p.content}
              displayMode={false}
              className="px-0.5"
            />
          );
        }
        return <span key={idx}>{p.content}</span>;
      })}
    </span>
  );
};
