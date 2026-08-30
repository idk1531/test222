"use client";

import React, { useState, useRef, useEffect } from "react";
import { Type, Check } from "lucide-react";

export const HANDWRITING_FONTS = [
  { key: "caveat", label: "Caveat", css: "'Caveat', cursive" },
  { key: "indie", label: "Indie Flower", css: "'Indie Flower', cursive" },
  { key: "dancing", label: "Dancing Script", css: "'Dancing Script', cursive" },
  { key: "quicksand", label: "Quicksand", css: "'Quicksand', sans-serif" },
  { key: "comfortaa", label: "Comfortaa", css: "'Comfortaa', cursive" },
  { key: "varela", label: "Varela Round", css: "'Varela Round', sans-serif" },
  { key: "satisfy", label: "Satisfy", css: "'Satisfy', cursive" },
  { key: "pacifico", label: "Pacifico", css: "'Pacifico', cursive" },
  { key: "sacramento", label: "Sacramento", css: "'Sacramento', cursive" },
  { key: "fredoka", label: "Fredoka One", css: "'Fredoka One', cursive" },
  { key: "brush", label: "Caveat Brush", css: "'Caveat Brush', cursive" },
  { key: "playwrite", label: "Playwrite GB", css: "'Playwrite GB S', cursive" },
];

interface FontSelectorProps {
  currentFont?: string;
  onSelect: (fontKey: string) => void;
}

export const FontSelector: React.FC<FontSelectorProps> = ({
  currentFont = "quicksand",
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        title="字體"
      >
        <Type className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 right-0 z-50 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden w-52">
          <div className="max-h-72 overflow-y-auto py-1">
            {HANDWRITING_FONTS.map((font) => (
              <button
                key={font.key}
                onClick={() => { onSelect(font.key); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between transition-colors ${
                  currentFont === font.key ? "bg-blue-50" : ""
                }`}
              >
                <span className="text-base text-slate-800" style={{ fontFamily: font.css }}>
                  {font.label}
                </span>
                {currentFont === font.key && <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
