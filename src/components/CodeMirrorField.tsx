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
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, foldGutter } from '@codemirror/language';
import { xml } from '@codemirror/lang-xml';
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

function baseExtensions(readOnly: boolean) {
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
  ];
}

export default function CodeMirrorField({
  value,
  onChange,
  readOnly,
  diffOriginal,
  diffMode = 'split',
  diagnostics = [],
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
        state: EditorState.create({ doc: value, extensions: [...baseExtensions(!editable), updateListener] }),
      });
    }

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // Deliberately NOT keyed on `value` — value-sync is handled below to preserve cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDiff, diffMode, diffOriginal, editable, readOnly]);

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
