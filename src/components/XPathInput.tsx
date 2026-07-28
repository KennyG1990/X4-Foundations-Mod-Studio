/** Keystroke-latency XPath completion against the selected effective corpus document. */

import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { XPathCompletionItem } from '../lib/xpathCompletion';

interface XPathInputProps {
  targetPath: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  testId?: string;
}

export default function XPathInput({ targetPath, value, onChange, placeholder, className, testId }: XPathInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(value.length);
  const [items, setItems] = useState<XPathCompletionItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !targetPath || !value) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/reference/xpath-complete', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ path: targetPath, selector: value, cursor, limit: 50 }),
        });
        const data = await response.json();
        if (!controller.signal.aborted) { setItems(response.ok && Array.isArray(data.items) ? data.items : []); setActiveIndex(0); }
      } catch {
        if (!controller.signal.aborted) setItems([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 125);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [targetPath, value, cursor, open]);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const apply = (item: XPathCompletionItem) => {
    const next = value.slice(0, item.replaceStart) + item.insertText + value.slice(item.replaceEnd);
    const nextCursor = item.replaceStart + item.insertText.length;
    onChange(next);
    setCursor(nextCursor);
    setOpen(false);
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(nextCursor, nextCursor); });
  };

  return (
    <div ref={boxRef} className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        data-testid={testId}
        value={value}
        spellCheck={false}
        placeholder={placeholder}
        className={className}
        onFocus={event => { setCursor(event.currentTarget.selectionStart || value.length); setOpen(true); }}
        onClick={event => setCursor(event.currentTarget.selectionStart || 0)}
        onChange={event => { onChange(event.target.value); setCursor(event.target.selectionStart || event.target.value.length); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' && items.length) { event.preventDefault(); setActiveIndex(index => (index + 1) % items.length); }
          else if (event.key === 'ArrowUp' && items.length) { event.preventDefault(); setActiveIndex(index => (index - 1 + items.length) % items.length); }
          else if ((event.key === 'Enter' || event.key === 'Tab') && open && items[activeIndex]) { event.preventDefault(); apply(items[activeIndex]); }
          else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
        }}
      />
      {loading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-emerald-400" />}
      {open && items.length > 0 && (
        <div className="absolute z-[70] left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded border border-emerald-500/30 bg-[#0b0e14] shadow-2xl">
          {items.map((item, index) => (
            <button
              key={`${item.kind}:${item.label}:${index}`}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={event => { event.preventDefault(); apply(item); }}
              className={`block w-full text-left px-2 py-1.5 border-b border-white/5 last:border-0 ${index === activeIndex ? 'bg-emerald-500/10' : 'hover:bg-white/5'}`}
            >
              <span className="flex items-center justify-between gap-2 text-[10px] font-mono text-emerald-300">
                <span className="truncate">{item.label}</span><span className="text-[8px] uppercase text-slate-600">{item.kind}</span>
              </span>
              {item.detail && <span className="block truncate text-[8.5px] text-slate-500">{item.detail}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
