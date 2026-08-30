"use client";

import React, { useMemo } from "react";
import katex from "katex";

interface KaTeXRendererProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
}

export const KaTeXRenderer: React.FC<KaTeXRendererProps> = ({
  latex,
  displayMode = false,
  className = "",
}) => {
  const html = useMemo(() => {
    if (!latex) return "";
    try {
      return katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
      });
    } catch (e) {
      console.error("KaTeX rendering error:", e);
      return latex;
    }
  }, [latex, displayMode]);

  return (
    <span
      className={`inline-block ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
