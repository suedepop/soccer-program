'use client';

import { useEffect, useRef, useState } from 'react';
import { stripMarkup, toggleMark, type MarkName } from '@/lib/richtext';

type Field = HTMLInputElement | HTMLTextAreaElement;

const BUTTONS: { mark: MarkName; label: string; title: string; style: React.CSSProperties }[] = [
  { mark: 'b', label: 'B', title: 'Bold (Ctrl+B)', style: { fontWeight: 800 } },
  { mark: 'i', label: 'I', title: 'Italic (Ctrl+I)', style: { fontStyle: 'italic' } },
  { mark: 'u', label: 'U', title: 'Underline (Ctrl+U)', style: { textDecoration: 'underline' } },
];

/**
 * A plain text field with Bold / Italic / Underline buttons that wrap the
 * current selection in the markers from src/lib/richtext.ts.
 *
 * Deliberately not a contentEditable rich-text editor: the value stays a plain
 * string all the way to the database and the print renderer, there is no HTML
 * to sanitise or paste to clean up, and the live preview beside the form shows
 * the real result immediately.
 */
export default function RichTextField({
  id,
  label,
  value,
  onChange,
  maxVisible,
  placeholder,
  multiline = false,
  minHeight,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** Cap on visible characters; the markers themselves don't count. */
  maxVisible: number;
  placeholder?: string;
  multiline?: boolean;
  minHeight?: number;
  hint?: React.ReactNode;
}) {
  const ref = useRef<Field>(null);
  const pending = useRef<{ start: number; end: number } | null>(null);
  const [tip, setTip] = useState<string | null>(null);

  // Re-apply the selection after the controlled value round-trips through React,
  // otherwise the caret jumps to the end after every formatting click.
  useEffect(() => {
    const el = ref.current;
    if (!el || !pending.current) return;
    const { start, end } = pending.current;
    pending.current = null;
    el.focus();
    el.setSelectionRange(start, end);
  }, [value]);

  const visible = stripMarkup(value).length;

  function apply(mark: MarkName) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start === end) {
      setTip('Select the words you want to change first.');
      el.focus();
      return;
    }
    setTip(null);
    const next = toggleMark(value, start, end, mark);
    pending.current = { start: next.start, end: next.end };
    onChange(next.value);
  }

  function onKeyDown(e: React.KeyboardEvent<Field>) {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    const mark = key === 'b' ? 'b' : key === 'i' ? 'i' : key === 'u' ? 'u' : null;
    if (!mark) return;
    e.preventDefault();
    apply(mark);
  }

  function handleChange(next: string) {
    // Enforce the limit on visible characters, so formatting never costs a
    // parent part of their message.
    if (stripMarkup(next).length > maxVisible && next.length > value.length) {
      setTip(`That is the ${maxVisible}-character limit for this field.`);
      return;
    }
    setTip(null);
    onChange(next);
  }

  const shared = {
    id,
    value,
    placeholder,
    onKeyDown,
    onChange: (e: React.ChangeEvent<Field>) => handleChange(e.target.value),
  };

  return (
    <div>
      <div className="field-head">
        <label htmlFor={id}>{label}</label>
        <div className="format-bar" role="group" aria-label={`${label} formatting`}>
          {BUTTONS.map((b) => (
            <button
              key={b.mark}
              type="button"
              className="format-btn"
              title={b.title}
              aria-label={b.title}
              style={b.style}
              // Keep the field's selection alive through the click.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(b.mark)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {multiline ? (
        <textarea
          {...shared}
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          style={minHeight ? { minHeight } : undefined}
        />
      ) : (
        <input {...shared} ref={ref as React.RefObject<HTMLInputElement>} type="text" />
      )}

      <div className="hint">
        {tip ? (
          <span style={{ color: 'var(--warn)' }}>{tip}</span>
        ) : (
          <>
            {visible}/{maxVisible} characters. {hint}
          </>
        )}
      </div>
    </div>
  );
}
