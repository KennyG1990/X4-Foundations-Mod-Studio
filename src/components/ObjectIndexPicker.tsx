/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';

export interface IndexItem {
  id?: string;
  label?: string;
  insertText?: string;
  name?: string;
  detail?: string;
  sourceFile?: string;
  source?: string;
  path?: string;
  selector?: string;
  exists?: boolean;
}

interface ObjectIndexPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Which object-index kind to search (ship/station/ware/faction/sound/job/macro). */
  kind: string;
  placeholder?: string;
  /**
   * Optional prefix to strip from an index id before storing/displaying it. E.g. factions
   * are indexed as `faction.argon` but the MD compiler stores the short code `argon` (it
   * emits `faction.${code}`). With stripPrefix="faction." the picker offers all real
   * factions yet stores the value the compiler expects.
   */
  stripPrefix?: string;
  /** API endpoint to query (default the object index). Must return `{ items: [{id,name}] }`
   *  and accept `?kind=&q=&limit=`. Used to reuse this picker for e.g. patch targets. */
  endpoint?: string;
  /** Canonical suggestion intent. New-definition matches are collisions, not insertions. */
  intent?: 'reference' | 'new-definition' | 'selector';
  /** Reports whether the current exact value already exists in the queried authority. */
  onExactMatchChange?: (item: IndexItem | null) => void;
  /** Action for an existing definition (for example, open XML Patching). */
  onExistingSelect?: (item: IndexItem) => void;
  existingActionLabel?: string;
  allowFreeText?: boolean;
  autoFocus?: boolean;
}

/**
 * Searchable typeahead backed by either the live installed-game object index or the
 * configured canonical corpus suggestion endpoint. The user can pick a real id instead
 * of relying on a hardcoded list, while callers may still allow expression values such
 * as `$ship` / `player.ship` where X4 permits them.
 */
export default function ObjectIndexPicker({
  value, onChange, kind, placeholder, stripPrefix, endpoint = '/api/agent/object-index',
  intent = 'reference', onExactMatchChange, onExistingSelect, existingActionLabel = 'Patch existing',
  allowFreeText = true,
  autoFocus = false,
}: ObjectIndexPickerProps) {
  const strip = useCallback((id: string) => (stripPrefix && id.startsWith(stripPrefix) ? id.slice(stripPrefix.length) : id), [stripPrefix]);
  const itemId = useCallback((item: IndexItem) => String(item.insertText || item.id || item.label || ''), []);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<IndexItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search whenever the dropdown is open and the query changes.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${endpoint}?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(query.trim())}&intent=${encodeURIComponent(intent)}&limit=25`,
          { signal: controller.signal },
        );
        const data = await res.json();
        if (!controller.signal.aborted) { setItems(Array.isArray(data.items) ? data.items : []); setActiveIndex(0); }
      } catch {
        if (!controller.signal.aborted) setItems([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 125);
    return () => { controller.abort(); clearTimeout(t); };
  }, [query, kind, open, endpoint, intent]);

  useEffect(() => {
    if (!onExactMatchChange) return;
    const normalized = value.trim().toLowerCase();
    const exact = items.find(item => strip(itemId(item)).trim().toLowerCase() === normalized) || null;
    onExactMatchChange(exact);
  }, [items, value, onExactMatchChange, strip, itemId]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (item: IndexItem) => {
    if (intent === 'new-definition' && item.exists !== false) {
      onExistingSelect?.(item);
      return;
    }
    const id = strip(itemId(item));
    onChange(id);
    setQuery(id);
    setOpen(false);
  };

  // X4 text-reference names look like "{20203,201}" — not human-readable, so hide them.
  const isTextRef = (s?: string) => !s || /^\{[\d,]+\}$/.test(s);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          autoFocus={autoFocus}
          value={value}
          spellCheck={false}
          onChange={e => { onChange(e.target.value); setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => { setQuery(value || ''); setOpen(true); }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown' && items.length) { event.preventDefault(); setOpen(true); setActiveIndex(index => (index + 1) % items.length); }
            else if (event.key === 'ArrowUp' && items.length) { event.preventDefault(); setOpen(true); setActiveIndex(index => (index - 1 + items.length) % items.length); }
            else if (event.key === 'Enter' && open && items[activeIndex]) { event.preventDefault(); pick(items[activeIndex]); }
            else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
            else if (event.key === 'Tab' && open && items[activeIndex] && !allowFreeText) { pick(items[activeIndex]); }
          }}
          placeholder={placeholder || `Search ${kind}… or type a variable`}
          className="w-full pl-6 pr-2 py-1.5 rounded bg-black/60 border border-white/10 text-white font-mono text-[11px] focus:outline-none focus:border-cyan-500"
        />
        {loading && <Loader2 className="w-3 h-3 text-cyan-400 animate-spin absolute right-2 top-1/2 -translate-y-1/2" />}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded border border-cyan-500/30 bg-[#0b0e14] shadow-2xl scrollbar-thin">
          {!loading && items.length === 0 && (
            <div className="px-2 py-1.5 text-[10px] text-slate-500">
              No canonical matches.{allowFreeText ? ' Free text is allowed.' : ''}
            </div>
          )}
          {items.map((it, index) => {
            const stored = strip(itemId(it));
            const collision = intent === 'new-definition' && it.exists !== false;
            return (
              <button
                key={`${it.source || ''}:${stored}`}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={e => { e.preventDefault(); pick(it); }}
                className={`w-full text-left px-2 py-1.5 hover:bg-cyan-500/10 border-b border-white/5 last:border-0 ${
                  index === activeIndex || stored === value ? 'bg-cyan-500/10' : ''
                }`}
              >
                <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-cyan-300">
                  <span className="truncate">{stored}</span>
                  {collision && <span className="shrink-0 inline-flex items-center gap-0.5 text-[8px] text-amber-300"><AlertTriangle className="w-2.5 h-2.5" /> EXISTS</span>}
                </span>
                {!isTextRef(it.name || it.detail) && (it.name || it.detail) !== stored && (
                  <span className="block text-[9px] text-slate-500 truncate">{it.name || it.detail}</span>
                )}
                <span className="flex items-center justify-between gap-2 text-[8px] text-slate-600">
                  <span className="truncate">{[it.source, it.path || it.sourceFile].filter(Boolean).join(' · ')}</span>
                  {collision && onExistingSelect && <span className="shrink-0 inline-flex items-center gap-0.5 text-amber-400">{existingActionLabel}<ExternalLink className="w-2.5 h-2.5" /></span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
