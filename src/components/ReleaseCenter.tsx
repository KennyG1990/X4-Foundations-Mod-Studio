import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Download, ExternalLink, PackageCheck, UploadCloud, XCircle } from 'lucide-react';
import type { ModWorkspace } from '../types';
import type { ReleasePreferences } from '../lib/releasePreferences';
import { hasNativeReleaseHost, requestNativeReleaseAction } from '../lib/nativeEditor';

type Platform = 'nexus' | 'steam';
type Bump = 'none' | 'patch' | 'minor';

interface ReleaseStage {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'pass' | 'warning' | 'fail' | 'skipped';
  detail: string;
}

interface ReleaseResult {
  success?: boolean;
  status?: string;
  code?: string;
  error?: string;
  platform?: Platform;
  modId?: string;
  folderName?: string;
  version?: string;
  zipPath?: string;
  sha256?: string;
  sizeBytes?: number;
  backupPath?: string;
  backupHash?: string;
  backupSizeBytes?: number;
  targetPath?: string;
  reportPath?: string;
  readyForUpload?: boolean;
  command?: { display: string; mode: 'publishx4' | 'update'; executable: string; args: string[] } | null;
  workshopId?: string;
  sourceManifestAdoptionRequired?: boolean;
  sourceManifestAdoptionAvailable?: boolean;
  stages?: ReleaseStage[];
  failedStages?: string[];
}

interface SteamAdoptionResult {
  success?: boolean;
  status?: string;
  code?: string;
  error?: string;
  sourceManifestPath?: string;
  workshopId?: string;
  version?: string;
  beforeSha256?: string;
  afterSha256?: string;
  beforeContent?: string;
  afterContent?: string;
  sourceWritePerformed?: boolean;
  sourceReimportRequired?: boolean;
  stages?: ReleaseStage[];
  failedStages?: string[];
}

interface ReleaseCenterProps {
  workspace: ModWorkspace;
  preferences: ReleasePreferences;
}

function stageIcon(status: ReleaseStage['status']) {
  if (status === 'pass') return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
  if (status === 'fail') return <XCircle className="w-3 h-3 text-red-400" />;
  return <Circle className={`w-3 h-3 ${status === 'warning' ? 'text-amber-400' : 'text-slate-600'}`} />;
}

async function responseJson(response: Response): Promise<ReleaseResult> {
  const body = await response.json().catch(() => ({})) as ReleaseResult;
  if (!response.ok && !body.error) body.error = `Release request failed (${response.status}).`;
  return body;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function recordExportReceipt(input: { platform: Platform; modId: string; method: 'native-save' | 'browser-save'; destination: string; artifactPath: string; sha256: string; sizeBytes: number }) {
  const response = await fetch('/api/agent/release/export/receipt', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `Export receipt failed (${response.status}).`);
}

export default function ReleaseCenter({ workspace, preferences }: ReleaseCenterProps) {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [bump, setBump] = useState<Bump>('patch');
  const [previewPath, setPreviewPath] = useState('');
  const [toolPath, setToolPath] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [minorUpdate, setMinorUpdate] = useState(false);
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<ReleaseResult | null>(null);
  const [adoption, setAdoption] = useState<SteamAdoptionResult | null>(null);
  const [exportMessage, setExportMessage] = useState('');

  const guided = preferences.mode === 'guided';
  const artifact = useMemo(() => result?.platform === 'nexus'
    ? { path: result.zipPath, hash: result.sha256, size: result.sizeBytes }
    : result?.platform === 'steam'
      ? { path: result.backupPath, hash: result.backupHash, size: result.backupSizeBytes }
      : null, [result]);

  const chooseNativePath = async (kind: 'preview' | 'tool') => {
    setExportMessage('');
    const native = await requestNativeReleaseAction(kind === 'preview' ? { action: 'select-preview' } : { action: 'select-workshop-tool' });
    if (!native) {
      setExportMessage('Standalone mode: paste the full local path into the field. Installed Antigravity provides a native file picker.');
      return;
    }
    if (native.ok && native.path) {
      if (kind === 'preview') setPreviewPath(native.path);
      else setToolPath(native.path);
    } else setExportMessage(native.message);
  };

  const prepare = async (selected: Platform) => {
    setBusy(`prepare-${selected}`);
    setResult(null);
    setAdoption(null);
    setExportMessage('');
    try {
      const response = await fetch(`/api/agent/release/${selected}/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace,
          bump,
          ...(selected === 'steam' ? { previewPath: previewPath.trim(), toolPath: toolPath.trim(), changeNote: changeNote.trim(), minorUpdate } : {}),
        }),
      });
      setResult(await responseJson(response));
    } catch (error) {
      setResult({ success: false, status: 'FAILED', platform: selected, code: 'RELEASE_REQUEST_FAILED', error: error instanceof Error ? error.message : 'Release request failed.' });
    } finally {
      setBusy('');
    }
  };

  const selectPlatform = (selected: Platform) => {
    setPlatform(selected);
    setResult(null);
    setAdoption(null);
    setExportMessage('');
    if (!guided) void prepare(selected);
  };

  const exportArtifact = async () => {
    if (!result?.modId || !result.platform || !artifact?.path || !artifact.hash || !artifact.size) return;
    setBusy('export');
    setExportMessage('');
    const suggestedName = artifact.path.replace(/\\/g, '/').split('/').pop() || `${result.modId}.zip`;
    try {
      const native = await requestNativeReleaseAction({ action: 'export-artifact', platform: result.platform, sourcePath: artifact.path, suggestedName, sha256: artifact.hash, sizeBytes: artifact.size });
      if (native) {
        if (!native.ok) {
          setExportMessage(native.message);
          return;
        }
        if (!native.path || !native.sha256 || !native.sizeBytes) {
          setExportMessage('The native host reported a save without the required path/hash receipt. Treat the export as unverified and save it again.');
          return;
        }
        try {
          await recordExportReceipt({ platform: result.platform, modId: result.modId, method: 'native-save', destination: native.path, artifactPath: artifact.path, sha256: native.sha256, sizeBytes: native.sizeBytes });
          setExportMessage(native.message);
        } catch (receiptError) {
          setExportMessage(`${native.message} The file save was verified, but Forge could not record its audit receipt: ${receiptError instanceof Error ? receiptError.message : String(receiptError)}`);
        }
        return;
      }
      const response = await fetch('/api/agent/release/artifact/download', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: result.platform, modId: result.modId, artifactPath: artifact.path }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `Artifact export failed (${response.status}).`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== artifact.size || await sha256Hex(bytes) !== artifact.hash) throw new Error('Downloaded bytes did not match the verified release receipt. Nothing was saved.');
      const picker = (window as Window & { showSaveFilePicker?: (options: unknown) => Promise<{ name?: string; getFile(): Promise<File>; createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }> }).showSaveFilePicker;
      if (picker) {
        const handle = await picker({ suggestedName, types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }] });
        const writable = await handle.createWritable();
        await writable.write(new Blob([bytes], { type: 'application/zip' }));
        await writable.close();
        const savedBytes = await (await handle.getFile()).arrayBuffer();
        const savedHash = await sha256Hex(savedBytes);
        if (savedBytes.byteLength !== artifact.size || savedHash !== artifact.hash) throw new Error('The saved output did not match the verified release receipt.');
        const savedMessage = `Saved ${handle.name || suggestedName}; ${savedBytes.byteLength} bytes and SHA-256 reverified after the write.`;
        try {
          await recordExportReceipt({ platform: result.platform, modId: result.modId, method: 'browser-save', destination: handle.name || suggestedName, artifactPath: artifact.path, sha256: savedHash, sizeBytes: savedBytes.byteLength });
          setExportMessage(savedMessage);
        } catch (receiptError) {
          setExportMessage(`${savedMessage} Forge could not record its audit receipt: ${receiptError instanceof Error ? receiptError.message : String(receiptError)}`);
        }
      } else {
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = suggestedName;
        link.click();
        URL.revokeObjectURL(url);
        setExportMessage(`Verified ${suggestedName} was handed to the browser download manager. Your browser controls the final destination, so Forge cannot re-open or receipt that final save.`);
      }
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === 'AbortError';
      setExportMessage(cancelled ? 'Save cancelled; the verified internal artifact was not changed.' : error instanceof Error ? error.message : 'Artifact export failed.');
    } finally {
      setBusy('');
    }
  };

  const openSteamTerminal = async () => {
    if (!result?.command?.display || !result.targetPath) return;
    setBusy('terminal');
    try {
      const native = await requestNativeReleaseAction({ action: 'open-steam-terminal', command: result.command.display, stagedModPath: result.targetPath, toolPath: result.command.executable });
      if (native) setExportMessage(native.message);
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(result.command.display);
        setExportMessage('Standalone mode cannot open a trusted terminal. The command was copied; review it and run it manually in PowerShell.');
      } else {
        setExportMessage('Standalone mode cannot open a trusted terminal or access the clipboard. Select and copy the visible command manually.');
      }
    } catch (error) {
      setExportMessage(`The Steam command was not opened or copied: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy('');
    }
  };

  const verifySteam = async () => {
    if (!result?.modId) return;
    setBusy('verify-steam');
    setAdoption(null);
    try {
      const response = await fetch('/api/agent/release/steam/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modId: result.modId }) });
      setResult(await responseJson(response));
    } catch (error) {
      setResult(previous => ({
        success: false, status: 'FAILED', platform: 'steam', modId: previous?.modId,
        code: 'STEAM_VERIFY_REQUEST_FAILED', error: error instanceof Error ? error.message : 'Steam verification request failed.',
        stages: [...(previous?.stages || []), { id: 'post-tool', label: 'Verify Workshop result', status: 'fail', detail: 'Forge could not reach the verification route. No Workshop success was recorded.' }],
        failedStages: ['post-tool'],
      }));
    } finally {
      setBusy('');
    }
  };

  const requestSteamAdoption = async (apply: boolean) => {
    if (!result?.modId) return;
    if (apply && (!adoption?.beforeSha256 || !adoption.workshopId)) return;
    if (apply && !window.confirm(`Write verified Workshop id ${adoption?.workshopId} and release version ${adoption?.version || ''} to ${adoption?.sourceManifestPath || 'source content.xml'}? Forge will require a re-import afterward.`)) return;
    setBusy(apply ? 'apply-adoption' : 'preview-adoption');
    setExportMessage('');
    try {
      const response = await fetch('/api/agent/release/steam/adopt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          modId: result.modId,
          apply,
          ...(apply ? { expectedSourceSha256: adoption?.beforeSha256, expectedWorkshopId: adoption?.workshopId } : {}),
        }),
      });
      const next = await response.json().catch(() => ({})) as SteamAdoptionResult;
      if (!response.ok && !next.error) next.error = `Workshop metadata adoption failed (${response.status}).`;
      setAdoption(previous => ({ ...previous, ...next }));
      if (next.status === 'VERIFIED_AND_ADOPTED' || next.sourceWritePerformed === true) {
        setResult(previous => previous ? { ...previous, status: next.status || 'PARTIAL', sourceManifestAdoptionRequired: false } : previous);
        setExportMessage(next.status === 'VERIFIED_AND_ADOPTED'
          ? `Verified Workshop metadata was written to ${next.sourceManifestPath}. Re-import the mod before packaging again.`
          : `Source metadata was written and verified, but its report update failed. Re-import the mod and do not repeat the adoption write.`);
      }
    } catch (error) {
      setAdoption(previous => ({ ...previous, success: false, status: 'FAILED', code: 'STEAM_ADOPTION_REQUEST_FAILED', error: error instanceof Error ? error.message : 'Workshop metadata adoption request failed.' }));
    } finally {
      setBusy('');
    }
  };

  const stages = result?.stages || [];
  return (
    <section data-testid="release-center" className="pt-2 border-t border-white/5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold text-slate-200 uppercase">Release Center</div>
          <div className="text-[9px] text-slate-500">Separate, verified platform flows · {guided ? 'Guided' : 'Express'} mode</div>
        </div>
        <span className="text-[8px] text-slate-600">Change mode in Settings</span>
      </div>
      {!platform && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" data-testid="package-nexus-btn" onClick={() => selectPlatform('nexus')} className="rounded border border-violet-500/40 bg-violet-500/10 p-2 text-left hover:bg-violet-500/20">
            <PackageCheck className="w-4 h-4 text-violet-300 mb-1" /><span className="block text-[10px] font-bold text-violet-200">Package for Nexus Mods</span><span className="text-[8.5px] text-slate-500">Verified ZIP with one install root</span>
          </button>
          <button type="button" data-testid="package-steam-btn" onClick={() => selectPlatform('steam')} className="rounded border border-sky-500/40 bg-sky-500/10 p-2 text-left hover:bg-sky-500/20">
            <UploadCloud className="w-4 h-4 text-sky-300 mb-1" /><span className="block text-[10px] font-bold text-sky-200">Package for Steam Workshop</span><span className="text-[8.5px] text-slate-500">CAT/DAT staging + official tool handoff</span>
          </button>
        </div>
      )}
      {platform && (
        <div className="rounded border border-white/10 bg-black/20 p-2 space-y-2" data-testid={`${platform}-release-guide`}>
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold text-white">{platform === 'nexus' ? 'Nexus Mods guide' : 'Steam Workshop guide'}</span><button type="button" disabled={Boolean(busy)} onClick={() => { setPlatform(null); setResult(null); setExportMessage(''); }} className="text-[9px] text-slate-500 hover:text-white disabled:opacity-40">Choose platform</button></div>
          {guided && <ol className="list-decimal pl-4 text-[9px] text-slate-400 space-y-1">
            <li>Forge resolves the complete imported source and refuses stale or omitted binary data.</li>
            <li>Project validation and required `content.xml` metadata must pass.</li>
            {platform === 'nexus' ? <><li>Forge validates `content.xml` id, name, integer version, author, and description.</li><li>Forge builds one `{workspace.sourceFolder?.replace(/\\/g, '/').split('/').pop() || workspace.name || 'mod'}/` ZIP and reopens every entry.</li><li>You choose where to save the independently hash-verified output.</li><li>Extract that ZIP into a scratch folder and confirm it contains exactly one mod root before uploading it on the Nexus X4 Foundations Files page.</li><li>Add installation text, a 1920x1080 or 960x540 hero image, and 2–5 representative in-game screenshots; Forge does not publish to your account.</li></> : <><li>Forge preserves the imported extension folder separately from the `ws_&lt;id&gt;` Workshop identity, then verifies that folder is lowercase, no more than 32 characters, and uses only Steam's allowed letters, digits, space, `.`, `_`, and `-`.</li><li>Select a widescreen preview (Egosoft recommends at least 640x360) for the first publish; on an update, leave it blank to preserve the current Workshop preview.</li><li>Select Egosoft `WorkshopTool.exe` from the separate X Tools installation when ready to upload.</li><li>Forge builds CAT/DAT staging and a verified rollback ZIP.</li><li>You review the visible `publishx4`/`update` command; Forge inserts it but never presses Enter or uploads.</li><li>Authenticate in Steam, resolve any legal-agreement prompt, then return here after WorkshopTool finishes.</li><li>Verify the written `ws_&lt;id&gt;` and unchanged payload before adopting that Workshop identity into source.</li></>}
          </ol>}
          {guided && <div className="flex gap-2 text-[8.5px]">
            {platform === 'nexus'
              ? <a href="https://www.nexusmods.com/x4foundations" target="_blank" rel="noreferrer" className="text-violet-300 hover:underline">Open Nexus X4 Foundations</a>
              : <a href="https://wiki.egosoft.com/X%20Rebirth%20Wiki/Modding%20support/Steam%20Workshop%20for%20X%20Rebirth%20and%20X4/?language=en" target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">Open Egosoft Workshop guide</a>}
          </div>}
          <label className="block text-[9px] text-slate-500">Release version<select data-testid="release-bump-select" value={bump} onChange={event => setBump(event.target.value as Bump)} className="settings-select mt-1 w-full"><option value="none">Keep current version</option><option value="patch">Bump patch (+1)</option><option value="minor">Bump minor (+10)</option></select></label>
          {platform === 'steam' && <div className="space-y-1.5">
            <label className="block text-[9px] text-slate-500">Workshop preview (required first publish; optional update; PNG/JPG, max 1 MB)<div className="flex gap-1 mt-1"><input data-testid="steam-preview-path" value={previewPath} onChange={event => setPreviewPath(event.target.value)} placeholder="Leave blank on update to keep the current preview" className="flex-1 min-w-0 px-2 py-1 rounded bg-[#08090d] border border-white/10 text-slate-300"/><button type="button" onClick={() => void chooseNativePath('preview')} className="settings-button">Choose…</button></div></label>
            <label className="block text-[9px] text-slate-500">Egosoft WorkshopTool.exe (optional until upload)<div className="flex gap-1 mt-1"><input data-testid="steam-tool-path" value={toolPath} onChange={event => setToolPath(event.target.value)} placeholder="Path from Egosoft X Tools" className="flex-1 min-w-0 px-2 py-1 rounded bg-[#08090d] border border-white/10 text-slate-300"/><button type="button" onClick={() => void chooseNativePath('tool')} className="settings-button">Choose…</button></div></label>
            <label className="block text-[9px] text-slate-500">Update change note<input data-testid="steam-change-note" value={changeNote} onChange={event => setChangeNote(event.target.value)} placeholder="Required only when updating an existing Workshop item" className="mt-1 w-full px-2 py-1 rounded bg-[#08090d] border border-white/10 text-slate-300"/></label>
            <label className="flex items-start gap-2 rounded border border-amber-500/20 bg-amber-500/5 p-1.5 text-[9px] text-amber-100"><input data-testid="steam-minor-update" type="checkbox" checked={minorUpdate} onChange={event => setMinorUpdate(event.target.checked)} className="mt-0.5"/><span><span className="font-bold">Existing update only:</span> I deliberately did not increase the version already published on Workshop. Add Egosoft's `-minor` switch. Do not select this merely because Forge's automatic bump is set to “Keep current version.”</span></label>
          </div>}
          <button type="button" data-testid={`prepare-${platform}-btn`} disabled={Boolean(busy)} onClick={() => void prepare(platform)} className={`w-full px-3 py-1.5 rounded text-[10px] font-bold text-black disabled:opacity-40 ${platform === 'nexus' ? 'bg-violet-400' : 'bg-sky-400'}`}>{busy === `prepare-${platform}` ? 'Running verified stages…' : platform === 'nexus' ? 'Build and verify Nexus ZIP' : 'Build and verify Steam staging'}</button>
          {result && <div data-testid="release-result" className={`rounded border p-2 space-y-1 ${result.status === 'PARTIAL' ? 'border-amber-500/40' : result.success ? 'border-emerald-500/30' : 'border-red-500/40'}`}>
            <div className={`text-[10px] font-bold ${result.status === 'PARTIAL' ? 'text-amber-300' : result.success ? 'text-emerald-300' : 'text-red-300'}`}>{result.status || (result.success ? 'READY' : 'FAILED')}{result.code ? ` · ${result.code}` : ''}</div>
            {result.error && <div className="text-[9px] text-red-300">{result.error}</div>}
            {stages.map(stage => <details key={`${stage.id}-${stage.status}`} open={guided || stage.status === 'fail' || stage.status === 'warning'} className="text-[9px]"><summary className="flex items-center gap-1 cursor-pointer text-slate-300">{stageIcon(stage.status)}<span>{stage.label}</span><span className="ml-auto uppercase text-[8px] text-slate-600">{stage.status}</span></summary><div className="pl-4 text-slate-500 break-words">{stage.detail}</div></details>)}
            {artifact?.path && <button type="button" data-testid="export-release-artifact" disabled={Boolean(busy)} onClick={() => void exportArtifact()} className="w-full settings-button justify-center"><Download className="w-3 h-3" /> {busy === 'export' ? 'Verifying output…' : `Choose output file for ${result.platform === 'nexus' ? 'Nexus ZIP' : 'Steam rollback ZIP'}`}</button>}
            {result.platform === 'steam' && result.command?.display && <button type="button" data-testid="open-steam-terminal" disabled={Boolean(busy)} onClick={() => void openSteamTerminal()} className="w-full settings-button justify-center"><ExternalLink className="w-3 h-3" /> Open visible terminal with command (do not run)</button>}
            {result.platform === 'steam' && result.command?.display && <pre data-testid="steam-command" className="whitespace-pre-wrap break-all rounded bg-black/40 p-1 text-[8px] text-slate-400 select-all">{result.command.display}</pre>}
            {result.platform === 'steam' && result.targetPath && <button type="button" data-testid="verify-steam-result" disabled={Boolean(busy)} onClick={() => void verifySteam()} className="w-full settings-button justify-center">Verify after WorkshopTool finishes</button>}
            {result.platform === 'steam' && result.sourceManifestAdoptionRequired && <button type="button" data-testid="preview-steam-adoption" disabled={Boolean(busy)} onClick={() => void requestSteamAdoption(false)} className="w-full settings-button justify-center">Preview guarded source metadata adoption</button>}
            {adoption && <div data-testid="steam-adoption-result" className={`rounded border p-1.5 space-y-1 ${adoption.status === 'READY_TO_ADOPT' || adoption.status === 'PARTIAL' ? 'border-amber-500/30' : adoption.success ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
              <div className="text-[9px] font-bold text-slate-200">{adoption.status || 'ADOPTION'}{adoption.code ? ` · ${adoption.code}` : ''}</div>
              {adoption.error && <div className="text-[9px] text-red-300">{adoption.error}</div>}
              {adoption.sourceManifestPath && <div className="text-[8px] text-slate-500 break-all">Source: {adoption.sourceManifestPath}</div>}
              {adoption.workshopId && <div className="text-[8px] text-slate-400">Workshop id {adoption.workshopId} · version {adoption.version}</div>}
              {adoption.beforeContent !== undefined && adoption.afterContent !== undefined && <details open className="text-[8px]"><summary className="cursor-pointer text-amber-200">Review content.xml before/after</summary><div className="grid grid-cols-2 gap-1 mt-1"><pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded bg-black/40 p-1 text-slate-500">{adoption.beforeContent}</pre><pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded bg-black/40 p-1 text-emerald-300">{adoption.afterContent}</pre></div></details>}
              {adoption.status === 'READY_TO_ADOPT' && <button type="button" data-testid="confirm-steam-adoption" disabled={Boolean(busy)} onClick={() => void requestSteamAdoption(true)} className="w-full settings-button justify-center">Confirm write to source content.xml</button>}
              {adoption.sourceReimportRequired && <div className="text-[8px] text-amber-200">Re-import the source mod before any further package or deploy operation.</div>}
            </div>}
          </div>}
          {exportMessage && <div data-testid="release-export-message" className="rounded border border-amber-500/20 bg-amber-500/5 p-1.5 text-[9px] text-amber-200">{exportMessage}</div>}
          {!hasNativeReleaseHost() && <div className="text-[8px] text-slate-600">Standalone browser: local path fields stay manual. Installed Antigravity adds native pickers, verified Save As, and a visible non-executing terminal handoff.</div>}
        </div>
      )}
    </section>
  );
}
