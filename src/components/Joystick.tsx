"use client";

import React, { useRef, useState } from "react";

export interface JoystickVector {
  x: number; // −1 … +1
  y: number; // −1 … +1（正值＝往前）
}

/** 手機左下角虛擬搖桿：Pointer Events，不接管畫面拖曳環顧；只回傳行走方向。 */
export const Joystick: React.FC<{
  onChange: (v: JoystickVector) => void;
  disabled?: boolean;
}> = ({ onChange, disabled = false }) => {
  const baseRef = useRef<HTMLButtonElement | null>(null);
  const activeRef = useRef<number | null>(null);
  const keyboardKeys = useRef(new Set<string>());
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const r = base.getBoundingClientRect();
    const radius = Math.min(r.width, r.height) * 0.34;
    let dx = clientX - (r.left + r.width / 2);
    let dy = clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > radius) {
      dx = (dx / len) * radius;
      dy = (dy / len) * radius;
    }
    const nx = dx / radius;
    const ny = -dy / radius;
    setKnob({ x: dx, y: dy });
    onChange({ x: nx, y: ny });
  };

  const stop = (e?: React.PointerEvent) => {
    if (e && activeRef.current !== e.pointerId) return;
    activeRef.current = null;
    setKnob({ x: 0, y: 0 });
    onChange({ x: 0, y: 0 });
  };

  return (
    <button
      type="button"
      ref={baseRef}
      data-no-orbit="true"
      aria-label="虛擬搖桿：拖動控制房間走動，也可用方向鍵操作"
      className="study-joystick absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-4 z-40 h-[112px] w-[112px] touch-none select-none rounded-full border border-white/70 bg-[#faf5ea]/35 shadow-[inset_0_2px_14px_rgba(72,52,32,.16),0_8px_26px_rgba(40,30,20,.12)] backdrop-blur-sm"
      style={{ opacity: disabled ? 0.35 : 1, pointerEvents: disabled ? "none" : "auto" }}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        activeRef.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (activeRef.current !== e.pointerId) return;
        e.preventDefault();
        e.stopPropagation();
        update(e.clientX, e.clientY);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        const key = e.key.toLowerCase();
        if (!["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) return;
        e.preventDefault();
        keyboardKeys.current.add(key);
        const keys = keyboardKeys.current;
        const x = Number(keys.has("arrowright") || keys.has("d")) - Number(keys.has("arrowleft") || keys.has("a"));
        const y = Number(keys.has("arrowup") || keys.has("w")) - Number(keys.has("arrowdown") || keys.has("s"));
        setKnob({ x: x * 18, y: -y * 18 });
        onChange({ x, y });
      }}
      onKeyUp={(e) => {
        keyboardKeys.current.delete(e.key.toLowerCase());
        const keys = keyboardKeys.current;
        const x = Number(keys.has("arrowright") || keys.has("d")) - Number(keys.has("arrowleft") || keys.has("a"));
        const y = Number(keys.has("arrowup") || keys.has("w")) - Number(keys.has("arrowdown") || keys.has("s"));
        setKnob({ x: x * 18, y: -y * 18 });
        onChange({ x, y });
      }}
    >
      <span className="absolute inset-0 grid grid-cols-3 grid-rows-3 text-center text-[11px] text-stone-700/60" aria-hidden="true">
        <span className="col-start-2 row-start-1 pt-1">▲</span>
        <span className="col-start-2 row-start-3 self-end pb-1">▼</span>
        <span className="col-start-1 row-start-2 self-center">◀</span>
        <span className="col-start-3 row-start-2 self-center">▶</span>
      </span>
      <span
        className="absolute left-1/2 top-1/2 h-[42px] w-[42px] rounded-full border border-white/80 bg-gradient-to-br from-[#ead5b3] to-[#b98c58] shadow-[0_3px_8px_rgba(56,40,24,.35)]"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        aria-hidden="true"
      />
    </button>
  );
};
