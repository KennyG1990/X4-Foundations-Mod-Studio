import React from 'react';
import { ExternalLink, File, FileDown, FileWarning, GitCompare, RefreshCw } from 'lucide-react';
import type { ModWorkspace } from '../types';
import { openInNativeEditor, openOrMaterializeInNativeEditor, openSourceVsGeneratedDiff } from '../lib/nativeEditor';

interface InventoryEntry {
  path: string;
  state: 'source' | 'synchronized-generated' | 'generated-only' | 'conflict';
  size: number;
  text: boolean;
  openable: boolean;
  materializable: boolean;
}

interface InventoryResponse {
  ok: boolean;
  sourceAvailable: boolean;
  entries: InventoryEntry[];
  excludedCount: number;
  sourceFolder?: string | null;
  errors?: string[];
  error?: string;
}

export default function NativeProjectFiles({ workspace }: { workspace: ModWorkspace }) {
  const [inventory, setInventory] = React.useState<InventoryResponse | null>(null);
  const [selected, setSelected] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [materializing, setMaterializing] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/agent/project/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace }),
      });
      const data = await response.json() as InventoryResponse;
      if (!response.ok && !data.entries) throw new Error(data.error || data.errors?.join(' ') || `HTTP ${response.status}`);
      setInventory(data);
      setSelected((current) => data.entries.some(entry => entry.path === current)
        ? current
        : data.entries.find(entry => entry.openable)?.path || data.entries[0]?.path || '');
    } catch (error) {
      setInventory(null);
      setMessage(error instanceof Error ? error.message : 'Could not load project files.');
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 500);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const entry = inventory?.entries.find(candidate => candidate.path === selected);
  const open = () => {
    if (!entry?.openable) {
      setMessage(entry?.text
        ? 'This generated file is not materialized in the Mod Workspace yet.'
        : 'Binary payloads are preserved but are not opened as text.');
      return;
    }
    if (!openInNativeEditor(entry.path, undefined, inventory?.sourceFolder || undefined)) {
      setMessage('Native tabs are available in the installed Antigravity/VS Code extension.');
    }
  };

  const materialize = async () => {
    if (!entry) return;
    setMaterializing(true);
    setMessage('');
    try {
      const result = await openOrMaterializeInNativeEditor(workspace, entry.path);
      setMessage(result.message);
      await refresh();
    } finally {
      setMaterializing(false);
    }
  };

  const compare = async () => {
    if (!entry) return;
    setMessage('');
    const result = await openSourceVsGeneratedDiff(workspace, entry.path);
    setMessage(result.message);
  };

  return (
    <div data-testid="native-project-files" className="flex items-center gap-1 rounded border border-cyan-500/20 bg-black/30 px-1.5 py-1 min-w-0">
      <File className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
      <select
        value={selected}
        onChange={(event) => { setSelected(event.target.value); setMessage(''); }}
        title={message || `${inventory?.entries.length || 0} packaged project files`}
        className="max-w-[260px] min-w-[150px] bg-[#0f131b] border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
      >
        {!inventory?.entries.length && <option value="">{loading ? 'Scanning project files…' : 'No project files'}</option>}
        {inventory?.entries.map(file => (
          <option key={file.path} value={file.path}>
            {file.path}{file.text ? '' : ' [binary]'}{file.state === 'conflict' ? ' [conflict]' : file.state === 'generated-only' ? ' [not materialized]' : ''}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={open}
        disabled={!entry || loading}
        title={entry?.openable ? `Open ${entry.path} in Antigravity` : message || 'Select a materialized text file'}
        className="p-1.5 rounded text-cyan-400 hover:bg-cyan-400/10 hover:text-cyan-200 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {entry && !entry.openable ? <FileWarning className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
      </button>
      {entry?.state === 'conflict' && entry.text && entry.openable && (
        <button
          type="button"
          onClick={() => void compare()}
          title={`Compare workspace source with Forge-generated ${entry.path}`}
          className="p-1.5 rounded text-fuchsia-400 hover:bg-fuchsia-400/10 hover:text-fuchsia-200"
        >
          <GitCompare className="w-3.5 h-3.5" />
        </button>
      )}
      {entry?.materializable && (
        <button
          type="button"
          onClick={() => void materialize()}
          disabled={materializing || entry.state === 'conflict'}
          title={entry.state === 'conflict' ? 'Generated and source bytes differ; review instead of overwriting' : `Materialize ${entry.path} into the Mod Workspace`}
          className="p-1.5 rounded text-amber-400 hover:bg-amber-400/10 hover:text-amber-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <FileDown className={`w-3.5 h-3.5 ${materializing ? 'animate-pulse' : ''}`} />
        </button>
      )}
      <button type="button" onClick={() => void refresh()} disabled={loading} title="Refresh project file inventory" className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-30">
        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
      </button>
      {message && <span className="sr-only" role="status">{message}</span>}
    </div>
  );
}
