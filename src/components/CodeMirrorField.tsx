/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * B48 — CodeMirror 6 editing surface. Replaces the hand-rolled transparent-textarea-over-<pre>
 * editor and the custom line-diff renderer inside CodePreview with a real editor engine
 * (fast, virtualized, proper XML highlighting). CSP-clean and worker-free, so it runs inside
 * the studio webview under the extension's strict CSP.
 *
 * Behavior parity with the code it replaces:
 *  - Plain mode: an EDITABLE editor (when onChange is given and not readOnly).
 *  - Diff modes: READ-ONLY comparison (the old diff branches had no textarea either) —
 *    'split' = side-by-side (MergeView), 'unified' = inline (unifiedMergeView).
 * The surrounding chrome (tabs, toolbar, status bar, minimap, apply/compile) stays in
 * CodePreview and is untouched.
 */

import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, hoverTooltip, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, foldGutter } from '@codemirror/language';
import { xml } from '@codemirror/lang-xml';
import { autocompletion, snippet, type CompletionContext } from '@codemirror/autocomplete';
import { oneDark } from '@codemirror/theme-one-dark';
import { MergeView, unifiedMergeView } from '@codemirror/merge';
import { lintGutter, setDiagnostics, type Diagnostic as CodeMirrorDiagnostic } from '@codemirror/lint';
import type { PackageDiagnostic } from '../types';

export interface CodeMirrorFieldProps {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  /** When set, render a READ-ONLY diff of `value` (current) against this (original). */
  diffOriginal?: string | null;
  diffMode?: 'split' | 'unified';
  /** Current-file findings from the Forge's continuous full-project validator. */
  diagnostics?: PackageDiagnostic[];
  /** Mod-relative path used to route XSD grammar and corpus-aware completion/hover. */
  filePath?: string;
  className?: string;
}

// Blend CodeMirror into the app's near-black surface (oneDark ships a lighter #282c34).
const appTheme = EditorView.theme(
  {
    '&': { backgroundColor: 'transparent', height: '100%', fontSize: '12px' },
    '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.5' },
    '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: '#4b5563' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,0.03)' },
    '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.03)' },
    '.cm-content': { caretColor: '#22d3ee' },
    '&.cm-focused': { outline: 'none' },
  },
  { dark: true },
);

type ReferenceCompletionPayload = {
  label: string;
  kind: 'Element' | 'Attribute' | 'Enum' | 'Reference' | 'Property' | 'Function';
  detail?: string;
  insertText: string;
  documentation?: string;
  sortText?: string;
};

type ReferenceHoverPayload = {
  signature: string;
  documentation?: string;
  detail?: string;
};

function completionStart(context: CompletionContext, kind: ReferenceCompletionPayload['kind']): number {
  const text = context.state.doc.sliceString(0, context.pos);
  const pattern = kind === 'Property' || kind === 'Function' ? /[A-Za-z0-9_?:-]*$/ : /[A-Za-z0-9_$?.:-]*$/;
  return context.pos - (text.match(pattern)?.[0].length || 0);
}

function referenceLanguageExtensions(filePath: string) {
  const completion = autocompletion({
    activateOnTyping: true,
    override: [async (context: CompletionContext) => {
      const last = context.state.doc.sliceString(Math.max(0, context.pos - 1), context.pos);
      if (!context.explicit && !/[A-Za-z0-9_.$?:<@'"-]/.test(last)) return null;
      const line = context.state.doc.lineAt(context.pos);
      const controller = new AbortController();
      context.addEventListener('abort', () => controller.abort(), { onDocChange: true });
      try {
        const response = await fetch('/api/reference/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath, content: context.state.doc.toString(), line: line.number - 1, column: context.pos - line.from }),
          signal: controller.signal,
        });
        if (!response.ok || context.aborted) return null;
        const items = await response.json() as ReferenceCompletionPayload[];
        if (!items.length || context.aborted) return null;
        const from = completionStart(context, items[0].kind);
        return {
          from,
          validFor: /^[A-Za-z0-9_$?.:-]*$/,
          options: items.map((item, index) => ({
            label: item.label,
            type: item.kind === 'Element' ? 'class' : item.kind === 'Attribute' || item.kind === 'Property' ? 'property' : item.kind === 'Function' ? 'function' : item.kind === 'Enum' ? 'enum' : 'variable',
            detail: item.detail,
            info: item.documentation,
            boost: -index,
            apply: item.insertText.includes('${') ? snippet(item.insertText) : item.insertText,
          })),
        };
      } catch { return null; }
    }],
  });
  const hover = hoverTooltip(async (view, pos) => {
    const line = view.state.doc.lineAt(pos);
    try {
      const response = await fetch('/api/reference/hover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content: view.state.doc.toString(), line: line.number - 1, column: pos - line.from }),
      });
      if (!response.ok) return null;
      const item = await response.json() as ReferenceHoverPayload | null;
      if (!item?.signature) return null;
      const around = view.state.wordAt(pos);
      return {
        pos: around?.from ?? pos,
        end: around?.to ?? pos,
        above: true,
        create() {
          const dom = document.createElement('div');
          dom.className = 'x4-reference-hover';
          const signature = document.createElement('div');
          signature.textContent = item.signature;
          signature.style.cssText = 'font:600 11px ui-monospace,monospace;color:#67e8f9;margin-bottom:4px';
          dom.appendChild(signature);
          const docs = document.createElement('div');
          docs.textContent = item.documentation || item.detail || '';
          docs.style.cssText = 'max-width:420px;white-space:pre-wrap;font:10px ui-monospace,monospace;color:#cbd5e1';
          dom.appendChild(docs);
          return { dom };
        },
      };
    } catch { return null; }
  }, { hoverTime: 300 });
  return [completion, hover];
}

function baseExtensions(readOnly: boolean, filePath?: string) {
  return [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    foldGutter(),
    lintGutter(),
    bracketMatching(),
    indentOnInput(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    xml(),
    oneDark,
    appTheme,
    EditorView.lineWrapping,
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    ...(!readOnly && filePath ? referenceLanguageExtensions(filePath) : []),
  ];
}

export default function CodeMirrorField({
  value,
  onChange,
  readOnly,
  diffOriginal,
  diffMode = 'split',
  diagnostics = [],
  filePath,
  className,
}: CodeMirrorFieldProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | MergeView | null>(null);
  // Latest value/onChange without forcing a full rebuild on every keystroke.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const isDiff = diffOriginal != null;
  const editable = !readOnly && !isDiff && !!onChange;

  // (Re)build the view when the STRUCTURAL inputs change (mode/diff/readOnly), not on keystrokes.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    viewRef.current?.destroy();
    host.innerHTML = '';
    valueRef.current = value;

    if (isDiff && diffMode === 'split') {
      viewRef.current = new MergeView({
        parent: host,
        a: { doc: diffOriginal ?? '', extensions: [...baseExtensions(true)] },
        b: { doc: value, extensions: [...baseExtensions(true)] },
        gutter: true,
        highlightChanges: true,
        collapseUnchanged: { margin: 3, minSize: 4 },
      });
    } else if (isDiff) {
      // unified: single read-only editor with inline change markers.
      viewRef.current = new EditorView({
        parent: host,
        state: EditorState.create({
          doc: value,
          extensions: [...baseExtensions(true), unifiedMergeView({ original: diffOriginal ?? '' })],
        }),
      });
    } else {
      const updateListener = EditorView.updateListener.of((u) => {
        if (u.docChanged) {
          const text = u.state.doc.toString();
          valueRef.current = text;
          onChangeRef.current?.(text);
        }
      });
      viewRef.current = new EditorView({
        parent: host,
        state: EditorState.create({ doc: value, extensions: [...baseExtensions(!editable, filePath), updateListener] }),
      });
    }

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // Deliberately NOT keyed on `value` — value-sync is handled below to preserve cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDiff, diffMode, diffOriginal, editable, readOnly, filePath]);

  // Sync EXTERNAL value changes (file switch, workspace regen) into the plain editor without
  // rebuilding — only when it differs from what the editor already holds (avoids the
  // onChange→setState→value feedback loop clobbering the cursor).
  useEffect(() => {
    const view = viewRef.current;
    if (!view || view instanceof MergeView || isDiff) return;
    if (value === valueRef.current) return;
    valueRef.current = value;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value, isDiff]);

  // Project diagnostics are pushed into CodeMirror's native lint layer. Findings without
  // a line remain in Diagnostics; inventing a squiggle location would mislead the author.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || view instanceof MergeView || isDiff) return;
    const mapped: CodeMirrorDiagnostic[] = diagnostics.flatMap((finding) => {
      if (!finding.line || finding.line < 1) return [];
      const number = Math.min(Math.max(1, Math.floor(finding.line)), view.state.doc.lines);
      const line = view.state.doc.line(number);
      return [{
        from: line.from,
        to: line.to,
        severity: finding.severity === 'error' ? 'error' : finding.severity === 'warning' ? 'warning' : 'info',
        message: finding.message,
        source: finding.code ? `X4 Forge · ${finding.code}` : 'X4 Forge',
      } satisfies CodeMirrorDiagnostic];
    });
    view.dispatch(setDiagnostics(view.state, mapped));
  }, [diagnostics, isDiff, value]);

  return <div ref={hostRef} className={className} style={{ height: '100%', overflow: 'auto' }} />;
}
