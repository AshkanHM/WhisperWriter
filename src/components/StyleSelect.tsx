'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';

type Option = { label: string; value: string; description?: string };

type Props = {
  label?: string;
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const DESCRIPTION_MAP: Record<string, string> = {
  'simple cleanup': 'Fix grammar and remove fluff without changing your original tone.',
  'structured & clear': 'Make your text clear, well-organized, and easy to read.',
  'casual messaging & friendly chat':
    'Rewrite in a friendly, relaxed, casual, and conversational tone.',
  'semi-formal work chat (professional)':
    'Keep it professional yet approachable for workplace communication.',
  'professional email': 'Craft a formal, respectful, and business-ready email.',
  'marketing & copywriting': 'Turn your text into persuasive, expert-level copy that engages.',
};

const norm = (s?: string) => (s || '').trim().toLowerCase();

export default function StyleSelect({
  label = 'Formatting Style',
  options,
  value,
  onChange,
  disabled = false,
}: Props) {
  const groupName = `style-select-${label.replace(/\s+/g, '-').toLowerCase()}`;

  // which accordion is open
  const [openId, setOpenId] = useState<string | null>(null);
  // remember if user manually collapsed the selected one (so we don't auto-reopen)
  const manualCollapsedFor = useRef<string | null>(null);
  const prevDisabled = useRef<boolean>(disabled);

  // map for panel refs -> dynamic height
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const setPanelEl = (id: string) => (el: HTMLDivElement | null) => {
    panelRefs.current[id] = el;
  };
  const setPanelHeight = (id: string, open: boolean) => {
    const el = panelRefs.current[id];
    if (!el) return;
    // use rAF to ensure scrollHeight is measured after DOM updates
    requestAnimationFrame(() => {
      el.style.maxHeight = open ? el.scrollHeight + 'px' : '0px';
    });
  };

  // Ensure each option has the description you wanted
  const mergedOptions = useMemo(
    () =>
      options.map((opt) => {
        const key = norm(opt.value) || norm(opt.label);
        return { ...opt, description: opt.description ?? DESCRIPTION_MAP[key] ?? '' };
      }),
    [options]
  );

  // Enable/disable transitions
  useEffect(() => {
    if (disabled) {
      setOpenId(null); // close all
    } else if (prevDisabled.current) {
      // just enabled: ensure a default is selected & expanded
      const hasValid = value && options.some((o) => o.value === value);
      const target = hasValid ? (value as string) : options[0]?.value;
      if (!hasValid && options[0]) onChange(options[0].value); // select default
      if (target) {
        manualCollapsedFor.current = null;
        setOpenId(target); // expand selected/default
      }
    }
    prevDisabled.current = disabled;
  }, [disabled, value, options, onChange]);

  // When selection changes (keyboard, parent, radio), expand that item
  useEffect(() => {
    if (disabled || !value) return;
    if (manualCollapsedFor.current === value) {
      // user collapsed this one; keep it closed until they click again
      manualCollapsedFor.current = null; // one-time suppression
      return;
    }
    setOpenId(value);
  }, [value, disabled]);

  // Apply heights on open/close
  useEffect(() => {
    options.forEach((o) => setPanelHeight(o.value, !disabled && openId === o.value));
  }, [openId, disabled, options]);

  // Single click handler on the WHOLE CARD
  const onCardClick = (opt: Option) => {
    if (disabled) return;
    const isSelected = value === opt.value;
    const isOpen = openId === opt.value;

    if (isOpen) {
      // collapse but keep selection
      manualCollapsedFor.current = opt.value;
      setOpenId(null);
      return;
    }

    // open this card; select if necessary
    if (!isSelected) onChange(opt.value);
    manualCollapsedFor.current = null;
    setOpenId(opt.value);
  };

  // Keyboard accessibility (Enter/Space) on the card
  const onCardKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // find which card this is via dataset
      const value = (e.currentTarget as HTMLDivElement).dataset.value!;
      const opt = options.find((o) => o.value === value);
      if (opt) onCardClick(opt);
    }
  };

  return (
    <div className="w-full">
      <div className="glossy-badge">
        <span className={`dot ${!disabled ? 'dot-on' : ''}`} />
        {' '}{label}
      </div>

      <div className="techy-group" role="radiogroup" aria-label={label} aria-disabled={disabled}>
        {mergedOptions.map((opt, idx) => {
          const selected = value === opt.value;
          const showChecked = !disabled && selected; // lights OFF when disabled
          const isOpen = !disabled && openId === opt.value;

          return (
            <div
              key={opt.value}
              className={`ww-acc-item ${isOpen ? 'open' : ''} ${showChecked ? 'selected' : ''}`}
              role="radio"
              aria-checked={showChecked}
              aria-controls={`panel-${groupName}-${idx}`}
              aria-expanded={isOpen}
              tabIndex={0}
              data-value={opt.value}
              onClick={() => onCardClick(opt)}
              onKeyDown={onCardKeyDown}
            >
              {/* Header row (visuals only) */}
              <div className="ww-acc-header">
                {/* Your original Techy radio UI (kept for visuals) */}
                <label className="techy-label" title={opt.label}>
                <input
  type="radio"
  name={groupName}
  className="techy-input"
  checked={showChecked}
  disabled={disabled}
  onClick={(e) => e.preventDefault()}
  readOnly
  tabIndex={-1}
  aria-hidden={true}
/>

                  <span className="techy-custom" />
                  <span className="techy-text">{opt.label}</span>
                </label>

                {/* Minimal caret from VBP2 — decorative only (click handled by card) */}
                <span className={`ww-acc-toggle ${isOpen ? 'is-open' : ''}`} aria-hidden="true" />
              </div>

              {/* Collapsible body */}
              <div
                id={`panel-${groupName}-${idx}`}
                className="ww-acc-panel"
                ref={setPanelEl(opt.value)}
                aria-hidden={!isOpen}
                style={{ maxHeight: 0 }}
              >
                <div className="ww-acc-body">
                  <p className="ww-acc-text">{opt.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
