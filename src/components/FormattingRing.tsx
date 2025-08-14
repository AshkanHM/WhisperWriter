// src/components/FormattingRing.tsx
'use client';

import React, { useMemo, useLayoutEffect, useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const RingPicker = dynamic(
  () =>
    import('@/vendor/react-native-ring-picker').then(
      (m: any) => m.ReactNativeRingPicker
    ),
  { ssr: false }
) as React.ComponentType<any>;

type Option = { label: string; value: string };

type Props = {
  options: Option[];
  initialValue?: string;
  onConfirm: (value: string) => void;
  disabled?: boolean;

  /** portion of card width used for the visible ring (0–1). default 0.92 */
  fitPercent?: number;
  /** subtract this much (px) from the card width before fitting. default 24 */
  inset?: number;
  /** clamp the final visible size (px) */
  minDiameter?: number; // default 240
  maxDiameter?: number; // default 420
  /** tweak label centering (negative nudges left). default -2 */
  labelOffsetX?: number;
  /** scale label size relative to visible diameter. default 0.052 (5.2%) */
  labelScale?: number;
  showArrowHint?: boolean;
};

export default function FormattingRing({
  options,
  initialValue,
  onConfirm,
  disabled = false,
  fitPercent = 0.92,
  inset = 24,
  minDiameter = 240,
  maxDiameter = 420,
  labelOffsetX = -2,
  labelScale = 0.052,
  showArrowHint = true,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  // Final visible diameter inside the card
  const [diameter, setDiameter] = useState<number>(320);
  // “Natural” size the RN lib uses (based on window); we render at this then scale
  const [base, setBase] = useState<number>(600);

  // ---- sizing ---------------------------------------------------------------
  useLayoutEffect(() => {
    const update = () => {
      if (typeof window !== 'undefined') {
        // use the smaller window side to avoid over-scaling on very wide screens
        const natural = Math.min(window.innerWidth, window.innerHeight);
        setBase(Math.max(480, natural)); // floor keeps text from getting too tiny
      }
      const w = hostRef.current?.clientWidth ?? 0;
      if (w > 0) {
        const avail = Math.max(0, w * fitPercent - inset * 2);
        const clamped = Math.max(minDiameter, Math.min(avail, maxDiameter));
        setDiameter(Math.round(clamped));
      }
    };

    update();
    const ro = new ResizeObserver(update);
    if (hostRef.current) ro.observe(hostRef.current);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [fitPercent, inset, minDiameter, maxDiameter]);

  const scale = diameter / (base || 1);

  // ---- scroll lock on the ring area only -----------------------------------
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const start = () => { draggingRef.current = true; };
    const end = () => { draggingRef.current = false; };

    // While dragging on the ring, prevent page scroll
    const onTouchMove = (e: TouchEvent) => {
      if (draggingRef.current) e.preventDefault();
    };
    const onPointerDown = () => { draggingRef.current = true; };
    const onPointerUp = () => { draggingRef.current = false; };

    // iOS needs passive: false for preventDefault to work
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('pointerleave', onPointerUp);

    return () => {
      el.removeEventListener('touchstart', start as any);
      el.removeEventListener('touchend', end as any);
      el.removeEventListener('touchcancel', end as any);
      el.removeEventListener('touchmove', onTouchMove as any);

      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('pointerleave', onPointerUp);
    };
  }, []);

  // ---- data + styles --------------------------------------------------------
  const icons = useMemo(
    () => options.map((opt) => ({ id: opt.value, title: opt.label })),
    [options]
  );

  // OUTER host: reserves height & clips perfectly
  const hostStyle: React.CSSProperties = {
    width: '100%',
    height: diameter,
    position: 'relative',
    overflow: 'hidden',
    pointerEvents: disabled ? 'none' : 'auto',
    display: 'block',
  };

  // CENTER: absolute center + scale the natural-size ring
  const centerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: base,
    height: base,
    transform: `translate(-50%, -50%) scale(${scale})`,
    transformOrigin: 'center center',
    // critical: this tells the browser not to treat touches as scroll on this square
    touchAction: 'none',
  };

  // RN styles passed to the picker (natural size)
  const ringStyle: any = {
    width: base,
    height: base,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.55 : 1,
  };

  // Bigger, centered labels + tiny left nudge to cancel right bias on web
  const labelFont = Math.max(12, Math.round(diameter * labelScale));
  const labelStyle: any = {
    color: 'white',
    textAlign: 'center',
    fontSize: labelFont,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,.35)',
    textShadowRadius: 6,
    transform: [{ translateX: labelOffsetX }], // fine-centering
  };

  return (
    <div ref={hostRef} style={hostStyle}>
      <div style={centerStyle}>
        <RingPicker
          icons={icons}
          style={ringStyle}
          styleIconText={labelStyle}
          showArrowHint={!disabled && showArrowHint}
          onPress={(iconId: string) => {
            if (disabled) return;
            const picked = options.find((o) => o.value === iconId);
            if (picked) onConfirm(picked.value);
          }}
        />
      </div>
    </div>
  );
}
