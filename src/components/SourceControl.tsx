import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  GitBranch,
  GitCommit,
  Sparkles,
  Check,
  ChevronDown,
  RefreshCw,
  FileText,
  Github,
  ArrowUp,
  ArrowDown,
  Settings,
  Terminal,
  Eye,
  X,
  ChevronRight,
  Info,
  GitCompare,
  Plus
} from 'lucide-react';
import { parseXMLToWorkspace } from '../lib/xmlParser';
import { ModWorkspace, generateMDXML, generateUIXML } from '../types';
import { toTFileName } from '../lib/modCompiler';
import { getAIHeaders } from '../lib/apiHelper';
import { capLocalHistory } from '../lib/localWorkspaceCache';
import { nextGithubDevicePollIntervalMs } from '../lib/githubDeviceFlow';

// Baseline layout of commits matching user screenshot exactly
interface GitCommitItem {
  sha: string;
  message: string;
  author: string;
  email: string;
  timestamp: string;
  branch: string;
  track: number; // 0=main, 1=wiki, 2=hybrid
  activeTracks: number[]; // active vertical lines in this row
  mergeFromTrack?: number;
  branchFromTrack?: number;
  summary?: string; // AI-generated plain-English diff summary for this commit
  filesChanged?: { path: string; status: 'added' | 'modified' | 'deleted'; diffLines: { type: 'addition' | 'deletion' | 'normal'; value: string }[] }[];
}

interface SourceControlProps {
  workspace: ModWorkspace;
  setWorkspace: (updater: ModWorkspace | ((prev: ModWorkspace) => ModWorkspace)) => void;
  onOpenEditorFile?: (file: { name: string; path: string; content: string }) => void;
  saveCheckpoint?: (customTarget?: ModWorkspace) => void;
  setWorkspaceView?: (view: 'blueprint' | 'ui-designer' | 'aiscripts' | 'libraries' | 'xmlpatch' | 'contracts' | 'translation' | 'wiki' | 'project' | 'galaxy') => void;
}

// Simple line diff helper
interface DiffLine {
  type: 'addition' | 'deletion' | 'normal';
  value: string;
}

interface GitHubCreateResult {
  error?: string;
  owner?: string;
  repo?: string;
  full_name?: string;
}

interface RemoteLoadResult {
  error?: string;
  content?: string;
}

interface RemoteCommitResponse {
  error?: string;
  commits?: {
    sha: string;
    message: string;
    author: string;
    email: string;
    date: string;
    body?: string;
  }[];
}

function messageFromUnknown(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function computeSimpleDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = (oldStr || '').split('\n');
  const newLines = (newStr || '').split('\n');
  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  
  while (i < oldLines.length || j < newLines.length) {
    const oldLine = oldLines[i];
    const newLine = newLines[j];
    
    if (oldLine !== undefined && newLine !== undefined && oldLine.trim() === newLine.trim()) {
      result.push({ type: 'normal', value: oldLine });
      i++;
      j++;
    } else {
      let foundMatch = false;
      for (let offset = 1; offset <= 5; offset++) {
        const lookaheadOld = oldLines[i + offset];
        const lookaheadNew = newLines[j + offset];
        
        if (lookaheadOld !== undefined && newLine !== undefined && lookaheadOld.trim() === newLine.trim()) {
          for (let k = 0; k < offset; k++) {
            if (oldLines[i + k] !== undefined) {
              result.push({ type: 'deletion', value: oldLines[i + k] });
            }
          }
          i += offset;
          foundMatch = true;
          break;
        } else if (lookaheadNew !== undefined && oldLine !== undefined && oldLine.trim() === lookaheadNew.trim()) {
          for (let k = 0; k < offset; k++) {
            if (newLines[j + k] !== undefined) {
              result.push({ type: 'addition', value: newLines[j + k] });
            }
          }
          j += offset;
          foundMatch = true;
          break;
        }
      }
      if (!foundMatch) {
        if (oldLine !== undefined && newLine !== undefined) {
          result.push({ type: 'deletion', value: oldLine });
          result.push({ type: 'addition', value: newLine });
          i++;
          j++;
        } else if (oldLine !== undefined) {
          result.push({ type: 'deletion', value: oldLine });
          i++;
        } else if (newLine !== undefined) {
          result.push({ type: 'addition', value: newLine });
          j++;
        }
      }
    }
  }
  return result;
}

export default function SourceControl({
  workspace,
  setWorkspace,
  onOpenEditorFile: _onOpenEditorFile,
  saveCheckpoint,
  setWorkspaceView
}: SourceControlProps) {
  // Remote GitHub metadata may live in localStorage; the credential itself is server-owned.
  const [gitPat, setGitPat] = useState<string>(() => localStorage.getItem('x4_github_pat') || '');
  const [gitOwner, setGitOwner] = useState<string>(() => localStorage.getItem('x4_github_owner') || '');
  const [gitRepo, setGitRepo] = useState<string>(() => localStorage.getItem('x4_github_repo') || '');
  const [activeBranch, setActiveBranch] = useState<string>(() => localStorage.getItem('x4_github_branch') || 'main');
  
  const [isGitHubConnected, setIsGitHubConnected] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [syncLoading, setSyncLoading] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');

  // OAuth Device Flow (one-click "Connect with GitHub") state
  const [gitClientId] = useState<string>(() => localStorage.getItem('x4_github_client_id') || '');
  const [deviceFlow, setDeviceFlow] = useState<{ userCode: string; verificationUri: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviceFlowGenerationRef = useRef(0);
  const deviceRequestAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const legacy = localStorage.getItem('x4_github_pat') || '';
      try {
        const response = legacy
          ? await fetch('/api/github/credential', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: legacy }),
            })
          : await fetch('/api/github/credential');
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || `Credential status failed (${response.status}).`);
        if (legacy) localStorage.removeItem('x4_github_pat');
        if (!cancelled) {
          setGitPat('');
          setIsGitHubConnected(body?.configured === true);
          localStorage.setItem('x4_github_connected', body?.configured === true ? 'true' : 'false');
        }
      } catch (error) {
        if (!cancelled) setSyncStatusMsg(`GitHub credential status unavailable: ${messageFromUnknown(error, String(error))}`);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Local workspace diffing / staging baseline
  const [gitBaseline, setGitBaseline] = useState<ModWorkspace | null>(() => {
    const raw = localStorage.getItem('x4_git_baseline');
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  });

  const [activeTab, setActiveTab2] = useState<'sourceControl' | 'remotes' | 'graph'>('sourceControl');

  // GITHUB REPO MANAGER FILE LOAD AND MULTI-SNAP SYNC STATE
  const [filePathToLoad, setFilePathToLoad] = useState<string>('ais_workspace.json');
  const [pushSelectedFiles, setPushSelectedFiles] = useState({
    workspace: true,
    md_xml: true,
    ui_xml: true,
    readme: true
  });
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const [commitMessage, setCommitMessage] = useState<string>('');
  const [generatingMessage, setGeneratingMessage] = useState<boolean>(false);
  const [commitMessageError, setCommitMessageError] = useState<string>('');

  // Create-repo + remote-diff + AI diff-summary state
  const [creatingRepo, setCreatingRepo] = useState<boolean>(false);
  const [diffItems, setDiffItems] = useState<{ type: 'add' | 'remove' | 'modify'; text: string }[]>([]);
  const [isDiffLoading, setIsDiffLoading] = useState<boolean>(false);
  const [remoteDiffChecked, setRemoteDiffChecked] = useState<boolean>(false);
  const [diffSummary, setDiffSummary] = useState<string>('');
  const [generatingSummary, setGeneratingSummary] = useState<boolean>(false);

  // Track full dynamic commit history (hybrid layout: starting with seeded list, and expanding as user commits!)
  const [localHistory, setLocalHistory] = useState<GitCommitItem[]>(() => {
    const rawHistory = localStorage.getItem('x4_git_local_history');
    if (rawHistory) {
      try {
        const parsed = JSON.parse(rawHistory);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          return capLocalHistory(parsed);
        }
      } catch {}
    }
    return [];
  });

  // Modal inspection variables
  const [isDiffModalOpen, setIsDiffModalOpen] = useState<boolean>(false);
  const [selectedCommit, setSelectedCommit] = useState<GitCommitItem | null>(null);
  const [inspectionFile, setInspectionFile] = useState<string>('');

  // Initial setup: save baseline on mount if none exists
  useEffect(() => {
    if (!gitBaseline) {
      const stringified = JSON.stringify(workspace);
      localStorage.setItem('x4_git_baseline', stringified);
      setGitBaseline(workspace);
    }
  }, [workspace, gitBaseline]);

  // Persists local history on changes
  const saveHistory = (history: GitCommitItem[]) => {
    const capped = capLocalHistory(history);
    setLocalHistory(capped);
    try { localStorage.setItem('x4_git_local_history', JSON.stringify(capped)); }
    catch { /* the server/workspace cache remains authoritative */ }
  };

  // 1. Calculate Changed Files dynamically by comparing active workspace with baseline
  const workingChanges = useMemo(() => {
    if (!gitBaseline) return [];
    const changes: { path: string; status: 'added' | 'modified' | 'deleted'; label: string; diffCount: { additions: number; deletions: number }; oldContent: string; newContent: string }[] = [];

    // Compare content.xml variables (Mod identity metadata)
    const isMetaDifferent = 
      workspace.name !== gitBaseline.name ||
      workspace.version !== gitBaseline.version ||
      workspace.author !== gitBaseline.author ||
      workspace.description !== gitBaseline.description;
    
    if (isMetaDifferent) {
      const oldMeta = `<?xml version="1.0" encoding="utf-8"?>
<content id="${gitBaseline.name}" name="${gitBaseline.name}" author="${gitBaseline.author || ''}" version="${gitBaseline.version || '1.0.0'}" description="${gitBaseline.description || ''}">
</content>`;
      const newMeta = `<?xml version="1.0" encoding="utf-8"?>
<content id="${workspace.name}" name="${workspace.name}" author="${workspace.author || ''}" version="${workspace.version || '1.0.0'}" description="${workspace.description || ''}">
</content>`;
      const lines = computeSimpleDiff(oldMeta, newMeta);
      changes.push({
        path: "content.xml",
        status: "modified",
        label: "Mod XML Descriptor",
        diffCount: {
          additions: lines.filter(l => l.type === 'addition').length,
          deletions: lines.filter(l => l.type === 'deletion').length
        },
        oldContent: oldMeta,
        newContent: newMeta
      });
    }

    // Compare md script logical nodesXML diff
    const oldMDXml = generateMDXML(gitBaseline);
    const newMDXml = generateMDXML(workspace);
    if (oldMDXml !== newMDXml) {
      const lines = computeSimpleDiff(oldMDXml, newMDXml);
      changes.push({
        path: `md/${workspace.name || 'mod'}.xml`,
        status: "modified",
        label: "Egosoft Mission Script",
        diffCount: {
          additions: lines.filter(l => l.type === 'addition').length,
          deletions: lines.filter(l => l.type === 'deletion').length
        },
        oldContent: oldMDXml,
        newContent: newMDXml
      });
    }

    // Compare HUD UI widget overlay structure
    const oldUIXml = generateUIXML(gitBaseline);
    const newUIXml = generateUIXML(workspace);
    if (oldUIXml !== newUIXml) {
      const lines = computeSimpleDiff(oldUIXml, newUIXml);
      changes.push({
        path: "ui/hud_menu.xml",
        status: "modified",
        label: "Custom HUD Widget Layout",
        diffCount: {
          additions: lines.filter(l => l.type === 'addition').length,
          deletions: lines.filter(l => l.type === 'deletion').length
        },
        oldContent: oldUIXml,
        newContent: newUIXml
      });
    }

    return changes;
  }, [workspace, gitBaseline]);

  // Generates AI Powered commit messages based on our diff data
  const handleGenerateCommitMessageAI = async () => {
    if (workingChanges.length === 0) {
      setCommitMessageError('No changes detected to analyze.');
      return;
    }
    setCommitMessageError('');
    setGeneratingMessage(true);
    setCommitMessage('Analyzing changeset...');

    try {
      // Describe changes to model concisely
      const summarySegments = workingChanges.map(change => {
        return `File adjusted: "${change.path}". Additions: +${change.diffCount.additions}, Deletions: -${change.diffCount.deletions}.`;
      });

      const bodyPayload = {
        prompt: `Create a brief, standard conventional commits git message based on these file adjustments:
${summarySegments.join('\n')}

Guidelines:
- Prefer lower-case prefixes like "feat:", "fix:", "refactor:", "docs:"
- Keep it under 60 characters
- Do not markdown-wrap, output ONLY the single raw title line!`,
        currentWorkspace: {
          name: workspace.name,
          description: workspace.description,
          nodes: workspace.nodes.map(n => ({ id: n.id, label: n.label, xmlTag: n.xmlTag, properties: n.properties })),
          links: workspace.links,
          uiWidgets: workspace.uiWidgets
        }
      };

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: getAIHeaders(),
        body: JSON.stringify(bodyPayload)
      });

      if (!res.ok) {
        throw new Error('AI Server responded with warning code.');
      }

      const data = await res.json();
      const textVal = data.text?.trim() || '';
      // Clean any potential quotes
      const cleaned = textVal.replace(/^["']|["']$/g, '');
      setCommitMessage(cleaned || 'feat: finalize mod updates');
    } catch (e) {
      console.error(e);
      setCommitMessage('feat: update tactical script elements');
    } finally {
      setGeneratingMessage(false);
    }
  };

  // Triggers committing visual workspace files to active local commit log
  const handlePerformCommit = async () => {
    if (!commitMessage.trim()) {
      setCommitMessageError('Commit message is required.');
      return;
    }
    if (workingChanges.length === 0) {
      setCommitMessageError('No modified structures staged.');
      return;
    }

    setCommitMessageError('');

    // Ensure the commit carries an AI diff summary (auto-generate if the user didn't make one)
    let summary = diffSummary.trim();
    if (!summary) {
      summary = await handleGenerateDiffSummary();
    }

    // Prepare full diff state to be persisted inside history commit node for direct auditing!
    const commitFiles = workingChanges.map(c => ({
      path: c.path,
      status: c.status,
      diffLines: computeSimpleDiff(c.oldContent, c.newContent)
    }));

    const nextSha = Math.random().toString(16).substring(2, 9);
    const newCommit: GitCommitItem = {
      sha: nextSha,
      message: commitMessage.trim(),
      author: workspace.author || "EliteModder",
      email: "KennySmith.1911@gmail.com",
      timestamp: "Just now",
      branch: activeBranch,
      track: 0,
      activeTracks: [0],
      summary: summary || undefined,
      filesChanged: commitFiles
    };

    // Prepend new commit at top of log stack, updating links
    const nextHistory = [newCommit, ...localHistory];
    saveHistory(nextHistory);

    // Save baseline snapshot to clear changes
    const stringified = JSON.stringify(workspace);
    localStorage.setItem('x4_git_baseline', stringified);
    setGitBaseline(workspace);

    // Reset input message + summary; allow the next remote diff to re-run
    setCommitMessage('');
    setDiffSummary('');
    setRemoteDiffChecked(false);
  };

  const addLog = (text: string) => {
    setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${text}`]);
  };

  // Clean up any in-flight device-flow polling when the panel unmounts
  useEffect(() => {
    return () => {
      deviceFlowGenerationRef.current += 1;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
      deviceRequestAbortRef.current?.abort();
      deviceRequestAbortRef.current = null;
    };
  }, []);

  const cancelDeviceFlow = () => {
    deviceFlowGenerationRef.current += 1;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
    deviceRequestAbortRef.current?.abort();
    deviceRequestAbortRef.current = null;
    setIsConnecting(false);
    setDeviceFlow(null);
    setSyncStatusMsg('Cancelled GitHub sign-in.');
  };

  // One-click GitHub sign-in via OAuth Device Flow: opens the browser, polls for the token,
  // then stores it exactly like a PAT so all existing load/push/create logic keeps working.
  const handleConnectWithGitHub = async () => {
    const clientId = gitClientId.trim(); // optional override; the server falls back to its configured GITHUB_CLIENT_ID
    deviceFlowGenerationRef.current += 1;
    const generation = deviceFlowGenerationRef.current;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
    deviceRequestAbortRef.current?.abort();
    const startController = new AbortController();
    deviceRequestAbortRef.current = startController;
    setIsConnecting(true);
    setSyncStatusMsg('Starting GitHub authorization…');
    try {
      const startRes = await fetch('/api/github/device/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientId ? { client_id: clientId, scope: 'repo' } : { scope: 'repo' }),
        signal: startController.signal,
      });
      let start: { error?: string; device_code?: string; user_code?: string; verification_uri?: string; interval?: number; expires_in?: number } | null = null;
      try { start = await startRes.json(); } catch { start = null; }
      if (deviceRequestAbortRef.current === startController) deviceRequestAbortRef.current = null;
      if (deviceFlowGenerationRef.current !== generation) return;

      if (!start) {
        throw new Error(startRes.status === 404
          ? 'GitHub route not found (404). Fully stop the dev server (Ctrl+C) and run "npm run dev" again so it loads the new endpoints.'
          : `GitHub sign-in failed: server returned ${startRes.status}.`);
      }
      if (start.error || !start.device_code) {
        throw new Error(start.error || 'GitHub sign-in is not configured. Add GITHUB_CLIENT_ID to .env.local and restart the dev server.');
      }

      if (clientId) localStorage.setItem('x4_github_client_id', clientId);
      setDeviceFlow({ userCode: start.user_code, verificationUri: start.verification_uri });
      setSyncStatusMsg('Opening GitHub in your browser — enter the code to authorize.');
      try { window.open(start.verification_uri, '_blank', 'noopener'); } catch { /* popup blocked; link still shown */ }

      let currentIntervalMs = Math.max(start.interval || 5, 5) * 1000;
      const deadline = Date.now() + (start.expires_in || 900) * 1000;

      const poll = async () => {
        pollTimerRef.current = null;
        if (deviceFlowGenerationRef.current !== generation) return;
        if (Date.now() > deadline) {
          setIsConnecting(false);
          setDeviceFlow(null);
          setSyncStatusMsg('GitHub authorization timed out. Try connecting again.');
          return;
        }
        const pollController = new AbortController();
        deviceRequestAbortRef.current = pollController;
        try {
          const res = await fetch('/api/github/device/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientId ? { client_id: clientId, device_code: start.device_code } : { device_code: start.device_code }),
            signal: pollController.signal,
          }).then(r => r.json());
          if (deviceRequestAbortRef.current === pollController) deviceRequestAbortRef.current = null;
          if (deviceFlowGenerationRef.current !== generation) return;

          if (res.connected) {
            if (res.login) {
              setGitOwner(res.login);
              localStorage.setItem('x4_github_owner', res.login);
            }
            localStorage.setItem('x4_github_branch', activeBranch);
            localStorage.setItem('x4_github_connected', 'true');
            setIsGitHubConnected(true);
            setIsConnecting(false);
            setDeviceFlow(null);
            setSyncStatusMsg(`Connected to GitHub as ${res.login || 'your account'}!`);
            return;
          }

          if (res.error === 'access_denied') {
            setIsConnecting(false);
            setDeviceFlow(null);
            setSyncStatusMsg('GitHub authorization was denied.');
            return;
          }
          if (res.error === 'expired_token') {
            setIsConnecting(false);
            setDeviceFlow(null);
            setSyncStatusMsg('The authorization code expired. Try again.');
            return;
          }
          // authorization_pending / slow_down → keep waiting
          currentIntervalMs = nextGithubDevicePollIntervalMs(currentIntervalMs, res.error);
          if (deviceFlowGenerationRef.current === generation) {
            pollTimerRef.current = setTimeout(poll, currentIntervalMs);
          }
        } catch {
          if (deviceRequestAbortRef.current === pollController) deviceRequestAbortRef.current = null;
          if (deviceFlowGenerationRef.current === generation) {
            pollTimerRef.current = setTimeout(poll, currentIntervalMs);
          }
        }
      };

      pollTimerRef.current = setTimeout(poll, currentIntervalMs);
    } catch (e) {
      if (deviceRequestAbortRef.current === startController) deviceRequestAbortRef.current = null;
      if (deviceFlowGenerationRef.current !== generation) return;
      setIsConnecting(false);
      setDeviceFlow(null);
      setSyncStatusMsg(`Connect failed: ${messageFromUnknown(e, String(e))}`);
    }
  };

  // Connects GitHub Credentials
  const handleConnectGitHub = async () => {
    if (!gitPat.trim()) {
      setSyncStatusMsg('Enter a GitHub Personal Access Token first.');
      return;
    }
    try {
      const response = await fetch('/api/github/credential', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: gitPat }),
      });
      const body = await response.json();
      if (!response.ok || body?.configured !== true) throw new Error(body?.error || 'Credential was not stored.');
      localStorage.removeItem('x4_github_pat');
      localStorage.setItem('x4_github_owner', gitOwner);
      localStorage.setItem('x4_github_repo', gitRepo);
      localStorage.setItem('x4_github_branch', activeBranch);
      localStorage.setItem('x4_github_connected', 'true');
      setGitPat('');
      setIsGitHubConnected(true);
      setShowConfig(false);
      setSyncStatusMsg('Linked with GitHub Repository successfully!');
    } catch (error) {
      setSyncStatusMsg(`Connect failed: ${messageFromUnknown(error, String(error))}`);
    }
  };

  const handleDisconnectGitHub = async () => {
    try {
      const response = await fetch('/api/github/credential', { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok || body?.configured !== false) throw new Error(body?.error || 'Credential deletion failed.');
      localStorage.removeItem('x4_github_pat');
      localStorage.setItem('x4_github_connected', 'false');
      setGitPat('');
      setIsGitHubConnected(false);
      setSyncStatusMsg('Disconnected from GitHub and deleted the stored credential.');
    } catch (error) {
      setSyncStatusMsg(`Disconnect failed: ${messageFromUnknown(error, String(error))}`);
    }
  };

  // Pushes active files to real linked GitHub repository using custom express proxy endpoint
  // Builds the commit message used for pushes: the user's typed commit message as the title,
  // with the AI diff summary as the body. Falls back to an override or a sensible default.
  const buildCommitMessage = (override?: string): string => {
    const title = (override?.trim() || commitMessage.trim() || 'Update mod files from X4 Forge');
    const body = diffSummary.trim();
    return body ? `${title}\n\n${body}` : title;
  };

  const handlePushGitWorkspace = async () => {
    if (!isGitHubConnected) {
      setSyncStatusMsg('Source control is not authenticated. Open settings to link GitHub.');
      return;
    }

    setSyncLoading(true);
    setSyncStatusMsg('Pushing modified snapshots to remote...');

    try {
      // Pack full XML and HUD files
      const mdCode = generateMDXML(workspace);
      const uiCode = generateUIXML(workspace);
      const contentXml = `<?xml version="1.0" encoding="utf-8"?>
<content id="${workspace.name}" name="${workspace.name}" author="${workspace.author || 'Author'}" version="${workspace.version || '1.0.0'}" description="${workspace.description || ''}">
</content>`;

      const payload = {
        owner: gitOwner,
        repo: gitRepo,
        branch: activeBranch,
        commitMessage: buildCommitMessage(),
        files: [
          { path: 'content.xml', content: contentXml },
          { path: `md/${workspace.name || 'mod'}.xml`, content: mdCode },
          { path: 'ui/hud_menu.xml', content: uiCode }
        ]
      };

      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to push repository files.');
      }

      setSyncStatusMsg(`Success! Synchronized files to branch: ${activeBranch}`);
    } catch (err) {
      setSyncStatusMsg(`Push failed: ${messageFromUnknown(err, String(err))}`);
    } finally {
      setSyncLoading(false);
    }
  };

  // ADVANCED GITHUB LOADER & MULTI-SNAP SYNCHRONIZER (Consolidated from SyncModal)
  const handleGitHubLoad = async () => {
    if (!isGitHubConnected || !gitOwner || !gitRepo) {
      setSyncStatusMsg('Please enter your GitHub Credentials in settings first.');
      return;
    }
    setIsProcessing(true);
    setTerminalLogs([]);
    addLog(`Initiating connection to api.github.com...`);
    addLog(`Remote target: ${gitOwner}/${gitRepo} on branch [${activeBranch}]`);
    addLog(`Target file descriptor requested: "${filePathToLoad}"`);

    try {
      const response = await fetch('/api/github/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: gitOwner,
          repo: gitRepo,
          branch: activeBranch,
          path: filePathToLoad
        })
      });

      const result: RemoteLoadResult = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Server returned error status ${response.status}`);
      }

      const contentText = result.content;
      if (!contentText) {
        throw new Error("File retrieved is blank or missing valid payload.");
      }

      const contentSize = new Blob([contentText]).size;
      addLog(`🎉 File content retrieved successfully (${contentSize} bytes)`);
      addLog(`Parsing content according to format rules...`);

      // Determine parse format dynamically
      const format = filePathToLoad.toLowerCase().endsWith('.xml') ? 'xml' : 'json';

      if (format === 'json') {
        const parsed = JSON.parse(contentText);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.nodes)) {
          if (saveCheckpoint) saveCheckpoint();
          setWorkspace(parsed);
          addLog(`Success: Restored workspace state "${parsed.name || 'mod'}".`);
          addLog(`Loaded visual node layout structure containing ${parsed.nodes.length} nodes.`);
          setSyncStatusMsg(`Successfully loaded Remote JSON workspace!`);
        } else {
          throw new Error("Retrieved JSON is missing valid visual flow 'nodes' structure.");
        }
      } else {
        // XML parsing logic matches SyncModal exactly
        const isTFile = contentText.includes('<language');
        const isAIScript = contentText.includes('<aiscript');
        const isLibrary = contentText.includes('<diff');

        if (isTFile) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(contentText, "application/xml");
          const langEl = doc.getElementsByTagName("language")[0];
          if (langEl) {
            const languageId = langEl.getAttribute("id") || "44";
            const pagesList = langEl.getElementsByTagName("page");
            const pages: { id: string; title: string; items: { id: string; value: string; description: string }[] }[] = [];
            
            for (let i = 0; i < pagesList.length; i++) {
              const pEl = pagesList[i];
              const pageId = pEl.getAttribute("id") || "20001";
              const pageTitle = pEl.getAttribute("title") || `Page ${pageId}`;
              const itemsList = pEl.getElementsByTagName("t");
              const items: { id: string; value: string; description: string }[] = [];
              
              for (let j = 0; j < itemsList.length; j++) {
                const tEl = itemsList[j];
                const tId = tEl.getAttribute("id") || "1";
                items.push({
                  id: tId,
                  value: tEl.textContent || "",
                  description: ""
                });
              }
              pages.push({ id: pageId, title: pageTitle, items });
            }
            
            const targetTFile = {
              languageId,
              fileName: toTFileName({ languageId }),
              pages
            };
            
            if (saveCheckpoint) saveCheckpoint();
            setWorkspace(prev => {
              const currentTFiles = prev.tFiles || [];
              const existsIdx = currentTFiles.findIndex(f => f.languageId === languageId);
              const newTFiles = [...currentTFiles];
              if (existsIdx !== -1) {
                newTFiles[existsIdx] = targetTFile;
              } else {
                newTFiles.push(targetTFile);
              }
              return { ...prev, tFiles: newTFiles };
            });

            if (setWorkspaceView) {
              setWorkspaceView('translation');
            }
            addLog(`🎉 SUCCESS: Language catalog loaded on translation view.`);
            setSyncStatusMsg(`Language translation catalog successfully loaded.`);
          } else {
            throw new Error("XML structure does not map language tags.");
          }
        } else if (isAIScript) {
          if (setWorkspaceView) {
            setWorkspaceView('aiscripts');
          }
          addLog(`🎉 SUCCESS: AIScript routed to Behavior Tree builder.`);
          setSyncStatusMsg(`AIScript imported.`);
        } else if (isLibrary) {
          if (setWorkspaceView) {
            setWorkspaceView('xmlpatch');
          }
          addLog(`🎉 SUCCESS: X4 library diff xml routed to XML Patching workspace.`);
          setSyncStatusMsg(`X4 library XML patch imported.`);
        } else {
          // Reconstruct workspace from Egosoft Script Parser
          const reconstructed = parseXMLToWorkspace(contentText);
          if (reconstructed && reconstructed.nodes.length > 0) {
            if (saveCheckpoint) saveCheckpoint();
            setWorkspace(reconstructed);
            if (setWorkspaceView) {
              setWorkspaceView('blueprint');
            }
            addLog(`🎉 SUCCESS: XML script compiled! visual diagram generated.`);
            addLog(`Loaded: ${reconstructed.nodes.length} functional visual nodes.`);
            setSyncStatusMsg(`Mission script XML parsed successfully.`);
          } else {
            throw new Error("Target file XML does not contain compatible game cues, variables or action tags.");
          }
        }
      }
    } catch (err) {
      addLog(`❌ ERROR: Fetch operation failed.`);
      const message = messageFromUnknown(err, String(err));
      addLog(`Details: ${message}`);
      setSyncStatusMsg(`Fetch Failed: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGithubPushMulti = async (customCommitMsg?: string) => {
    if (!isGitHubConnected || !gitOwner || !gitRepo) {
      setSyncStatusMsg('Authenticate GitHub peer in settings first.');
      return;
    }

    setIsProcessing(true);
    setTerminalLogs([]);
    addLog(`Packing mod configuration files...`);

    const workspaceJson = JSON.stringify(workspace, null, 2);
    const mdScriptXML = generateMDXML(workspace);
    const uiLayoutXML = generateUIXML(workspace);
    const readmeMD = `# ${workspace.name || 'X4 Foundations Mod'}
*Author: ${workspace.author || 'Anonymous'}*
*Version: ${workspace.version || '1.0.0'}*

## Description
${workspace.description || 'Custom mod developed inside X4 Forge Visual Node Editor.'}

## Visual Graph Layout
This mod is generated with \`${workspace.nodes.length}\` logic gates and \`${workspace.links.length}\` wiring layouts. Redefine dynamically.
`;

    const filesToPush = [];
    if (pushSelectedFiles.workspace) {
      filesToPush.push({ path: 'ais_workspace.json', content: workspaceJson });
    }
    if (pushSelectedFiles.md_xml) {
      filesToPush.push({ path: `md/${workspace.name || 'ais_mod'}.xml`, content: mdScriptXML });
    }
    if (pushSelectedFiles.ui_xml) {
      filesToPush.push({ path: 'ui/ais_ui_layout.xml', content: uiLayoutXML });
    }
    if (pushSelectedFiles.readme) {
      filesToPush.push({ path: 'README.md', content: readmeMD });
    }

    if (filesToPush.length === 0) {
      setIsProcessing(false);
      setSyncStatusMsg('Select at least one file to push.');
      return;
    }

    const finalCommitMsg = buildCommitMessage(customCommitMsg);
    addLog(`Syncing ${filesToPush.length} checked mod structures...`);
    addLog(`Commit message context: "${finalCommitMsg}"`);

    try {
      const response = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: gitOwner,
          repo: gitRepo,
          branch: activeBranch,
          commitMessage: finalCommitMsg,
          files: filesToPush
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Push operation failed with status ${response.status}`);
      }

      addLog(`Merged changes recursively to GitHub!`);
      result.results?.forEach(f => {
        addLog(` => [COMMITTED] ${f.path}`);
      });
      addLog(`🎉 SUCCESS: All sources merged cleanly! Mod update is live.`);
      setSyncStatusMsg(`Successfully pushed ${filesToPush.length} files to GitHub!`);

      // Baseline our changes locally
      const stringified = JSON.stringify(workspace);
      localStorage.setItem('x4_git_baseline', stringified);
      setGitBaseline(workspace);
    } catch (err) {
      addLog(`❌ ERROR: Push operation failed.`);
      const message = messageFromUnknown(err, String(err));
      addLog(`Details: ${message}`);
      setSyncStatusMsg(`Sync Push Failed: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Sanitize a mod name into a valid GitHub repository name
  const toRepoName = (name: string): string => {
    const safe = (name || '')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    return safe || 'x4-mod';
  };

  // Create a brand-new GitHub repo from the active mod, then push its initial files
  const handleCreateRepoFromMod = async () => {
    if (!isGitHubConnected) {
      setSyncStatusMsg('Connect GitHub in settings first.');
      setShowConfig(true);
      return;
    }
    const repoName = gitRepo.trim() || toRepoName(workspace.name);
    setCreatingRepo(true);
    setTerminalLogs([]);
    addLog(`Creating new GitHub repository "${repoName}"...`);
    try {
      const res: GitHubCreateResult = await fetch('/api/github/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: repoName,
          description: workspace.description || `X4 Foundations mod: ${workspace.name || repoName}`
        })
      }).then(r => r.json());

      if (res.error) throw new Error(res.error);

      setGitOwner(res.owner);
      setGitRepo(res.repo);
      localStorage.setItem('x4_github_owner', res.owner);
      localStorage.setItem('x4_github_repo', res.repo);
      localStorage.setItem('x4_github_branch', activeBranch);
      localStorage.setItem('x4_github_connected', 'true');
      setIsGitHubConnected(true);
      addLog(`🎉 Repository created: ${res.full_name}`);
      addLog(`Pushing initial mod files to ${activeBranch}...`);
      setSyncStatusMsg(`Repo "${res.full_name}" created. Pushing initial files...`);
      await handleGithubPushMulti(`chore: initial commit of ${workspace.name || repoName} from X4 Forge`);
    } catch (e) {
      const message = messageFromUnknown(e, String(e));
      addLog(`❌ ERROR: ${message}`);
      setSyncStatusMsg(`Create failed: ${message}`);
    } finally {
      setCreatingRepo(false);
    }
  };

  // Load the targeted repo's files and summarize how they differ from the active workspace
  const handleScanRemoteDiff = async () => {
    if (!isGitHubConnected || !gitOwner || !gitRepo) return;
    setIsDiffLoading(true);
    setRemoteDiffChecked(true);
    try {
      const remote: RemoteLoadResult = await fetch('/api/github/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: gitOwner, repo: gitRepo, branch: activeBranch, path: 'ais_workspace.json' })
      }).then(r => r.json());

      const items: { type: 'add' | 'remove' | 'modify'; text: string }[] = [];

      if (remote.error || !remote.content) {
        items.push({ type: 'add', text: 'ais_workspace.json not found on remote — a push will create it.' });
      } else {
        let remoteWs: ModWorkspace | null = null;
        try { remoteWs = JSON.parse(remote.content) as ModWorkspace; } catch { /* not json */ }
        if (!remoteWs || !Array.isArray(remoteWs.nodes)) {
          items.push({ type: 'modify', text: 'Remote workspace file is unreadable; a push will overwrite it.' });
        } else {
          if ((remoteWs.nodes?.length || 0) !== workspace.nodes.length) {
            items.push({ type: 'modify', text: `Nodes: remote ${remoteWs.nodes?.length || 0} → local ${workspace.nodes.length}` });
          }
          if ((remoteWs.links?.length || 0) !== workspace.links.length) {
            items.push({ type: 'modify', text: `Links: remote ${remoteWs.links?.length || 0} → local ${workspace.links.length}` });
          }
          if ((remoteWs.uiWidgets?.length || 0) !== (workspace.uiWidgets?.length || 0)) {
            items.push({ type: 'modify', text: `UI widgets: remote ${remoteWs.uiWidgets?.length || 0} → local ${workspace.uiWidgets?.length || 0}` });
          }
          if ((remoteWs.name || '') !== (workspace.name || '')) {
            items.push({ type: 'modify', text: `Mod name: "${remoteWs.name || ''}" → "${workspace.name || ''}"` });
          }
          const md = computeSimpleDiff(generateMDXML(remoteWs), generateMDXML(workspace));
          const adds = md.filter(l => l.type === 'addition').length;
          const dels = md.filter(l => l.type === 'deletion').length;
          if (adds || dels) {
            items.push({ type: 'modify', text: `md/${workspace.name || 'mod'}.xml: +${adds} / -${dels} lines` });
          }
        }
      }

      if (items.length === 0) {
        items.push({ type: 'modify', text: 'In sync — local workspace matches the remote repository.' });
      }
      setDiffItems(items);
    } catch (e) {
      setSyncStatusMsg(`Remote diff failed: ${messageFromUnknown(e, String(e))}`);
    } finally {
      setIsDiffLoading(false);
    }
  };

  // Auto-run the remote diff once when the Remotes tab is opened while connected to the mod's repo
  useEffect(() => {
    if (activeTab === 'remotes' && isGitHubConnected && gitRepo && !remoteDiffChecked && !isDiffLoading) {
      handleScanRemoteDiff();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isGitHubConnected, gitRepo]);

  // Generate a plain-English diff summary using whichever AI provider the app is configured with
  const handleGenerateDiffSummary = async (): Promise<string> => {
    if (workingChanges.length === 0) {
      setSyncStatusMsg('No working changes to summarize.');
      return '';
    }
    setGeneratingSummary(true);
    try {
      const detail = workingChanges
        .map(c => `File "${c.path}" (${c.status}): +${c.diffCount.additions} / -${c.diffCount.deletions} lines.`)
        .join('\n');

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: getAIHeaders(),
        body: JSON.stringify({
          prompt: `Summarize the following X4 Foundations mod changes for a git commit, in 1-3 short plain-English sentences. No markdown, no preamble, just the summary:\n${detail}`,
          currentWorkspace: {
            name: workspace.name,
            description: workspace.description,
            nodes: workspace.nodes.map(n => ({ id: n.id, label: n.label, xmlTag: n.xmlTag })),
            links: workspace.links
          }
        })
      });
      const data = await res.json();
      const text = (data.text || '').trim().replace(/^["']|["']$/g, '');
      setDiffSummary(text);
      return text;
    } catch (e) {
      setSyncStatusMsg(`Summary generation failed: ${messageFromUnknown(e, String(e))}`);
      return '';
    } finally {
      setGeneratingSummary(false);
    }
  };

  // Relative "x mins ago" formatter for commit timestamps
  const timeAgo = (iso: string): string => {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (isNaN(t)) return iso;
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60); if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
    const d = Math.floor(h / 24); if (d < 30) return `${d} day${d > 1 ? 's' : ''} ago`;
    const mo = Math.floor(d / 30); if (mo < 12) return `${mo} month${mo > 1 ? 's' : ''} ago`;
    return `${Math.floor(mo / 12)} year(s) ago`;
  };

  // Fetch the REAL commit history of the connected repo (replaces the seeded placeholder log)
  const handleFetchRemoteCommits = async () => {
    if (!isGitHubConnected || !gitOwner || !gitRepo) {
      setSyncStatusMsg('Authenticate GitHub peer in settings first.');
      return;
    }
    setSyncStatusMsg(`Fetching commit history from ${gitOwner}/${gitRepo}…`);
    try {
      const res: RemoteCommitResponse = await fetch('/api/github/commits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: gitOwner, repo: gitRepo, branch: activeBranch })
      }).then(r => r.json());
      if (res.error) throw new Error(res.error);

      const mapped: GitCommitItem[] = (res.commits || []).map(c => {
        const bodyLines = (c.body || '').split('\n').slice(1).join(' ').trim();
        return {
          sha: c.sha,
          message: c.message,
          author: c.author,
          email: c.email,
          timestamp: timeAgo(c.date),
          branch: activeBranch,
          track: 0,
          activeTracks: [0],
          summary: bodyLines || undefined
        } as GitCommitItem;
      });

      saveHistory(mapped);
      setSyncStatusMsg(mapped.length
        ? `Loaded ${mapped.length} commits from ${gitOwner}/${gitRepo}.`
        : 'No commits on this branch yet.');
    } catch (e) {
      setSyncStatusMsg(`Fetch commits failed: ${messageFromUnknown(e, String(e))}`);
    }
  };

  // Auto-load real commit history when the Graph Log opens (or repo/branch changes) while connected
  useEffect(() => {
    if (activeTab === 'graph' && isGitHubConnected && gitRepo) {
      handleFetchRemoteCommits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isGitHubConnected, gitRepo, activeBranch]);

  // Master line render coordinates calculator for perfect connection lines between commits in graph tab
  const computedGraphTracks = useMemo(() => {
    const trackWidth = 14;
    const paddingLeft = 14;
    const rowHeight = 44;

    const paths: { d: string; color: string }[] = [];

    // Let's connect commits in sequence
    for (let i = 0; i < localHistory.length; i++) {
      const current = localHistory[i];
      const next = localHistory[i + 1];

      if (!next) continue;

      const yCurrent = i * rowHeight + 22;

      // Vertical line for active track continuation
      (current.activeTracks || []).forEach(t => {
        const hasTInNext = (next.activeTracks || []).includes(t);
        if (hasTInNext) {
          const xT = paddingLeft + t * trackWidth;
          paths.push({
            d: `M ${xT} ${yCurrent} L ${xT} ${(i + 1) * rowHeight + 22}`,
            color: t === 0 ? '#06b6d4' : (t === 1 ? '#f97316' : '#ec4899')
          });
        }
      });

      // Special branching line
      if (next.branchFromTrack !== undefined) {
        const xParent = paddingLeft + next.branchFromTrack * trackWidth;
        const xChild = paddingLeft + next.track * trackWidth;
        const yChild = (i + 1) * rowHeight + 22;

        paths.push({
          d: `M ${xParent} ${yCurrent} Q ${xParent} ${yCurrent + 18}, ${xChild} ${yChild}`,
          color: next.track === 1 ? '#f97316' : '#ec4899'
        });
      }

      // Special merge line
      if (current.mergeFromTrack !== undefined) {
        const xMerged = paddingLeft + current.mergeFromTrack * trackWidth;
        const xMain = paddingLeft + current.track * trackWidth;
        const yMerged = (i + 1) * rowHeight + 22;

        paths.push({
          d: `M ${xMerged} ${yCurrent} Q ${xMain} ${yCurrent + 18}, ${xMain} ${yMerged}`,
          color: current.mergeFromTrack === 1 ? '#f97316' : '#ec4899'
        });
      }
    }

    return paths;
  }, [localHistory]);

  return (
    <div className="flex flex-col h-full bg-transparent select-none text-slate-300 font-sans" id="source_control_system">
      
      {/* Tab Nav Controls */}
      <div className="flex border-b border-white/5 bg-transparent">
        <button
          onClick={() => setActiveTab2('sourceControl')}
          title="Diff between the current workspace and the loaded baseline snapshot, regenerated from your nodes/layout. This is a compiled diff, not git working-tree status."
          className={`flex-1 py-2 text-[9.5px] font-mono font-bold tracking-tight uppercase border-b-2 flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'sourceControl'
              ? 'border-cyan-500 text-white bg-cyan-600/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitCommit className="w-3.5 h-3.5" />
          Diff ({workingChanges.length})
        </button>
        <button
          onClick={() => setActiveTab2('remotes')}
          className={`flex-1 py-2 text-[9.5px] font-mono font-bold tracking-tight uppercase border-b-2 flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'remotes'
              ? 'border-violet-500 text-white bg-violet-600/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Github className="w-3.5 h-3.5 text-violet-400" />
          Remotes
        </button>
        <button
          onClick={() => setActiveTab2('graph')}
          className={`flex-1 py-2 text-[9.5px] font-mono font-bold tracking-tight uppercase border-b-2 flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'graph'
              ? 'border-cyan-500 text-white bg-cyan-600/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
          Graph Log
        </button>

        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`px-3 border-l border-white/5 hover:text-white flex items-center justify-center cursor-pointer ${
            isGitHubConnected ? 'text-emerald-400' : 'text-slate-500'
          }`}
          title="GitHub Peer Settings"
        >
          <Settings className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
        </button>
      </div>

      {/* GitHub Config Modal/Slide Pane */}
      {showConfig && (
        <div className="p-3 bg-[#0c1017] border-b border-white/10 space-y-3 font-mono text-[10px]">
          <div className="flex items-center justify-between">
            <span className="font-bold text-cyan-400 flex items-center gap-1">
              <Github className="w-3.5 h-3.5" />
              PEER REPOSITORY SETUP
            </span>
            <button onClick={() => setShowConfig(false)} className="text-slate-400 hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-slate-500 block mb-0.5 uppercase text-[9px]">GitHub Personal Access Token (PAT)</label>
              <input 
                type="password"
                value={gitPat}
                onChange={e => setGitPat(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxx"
                className="w-full p-1.5 bg-black/60 border border-white/10 rounded focus:outline-none focus:border-cyan-500 text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 block mb-0.5 uppercase text-[9px]">Owner / Nick</label>
                <input 
                  type="text"
                  value={gitOwner}
                  onChange={e => setGitOwner(e.target.value)}
                  placeholder="e.g. KennyG1990"
                  className="w-full p-1.5 bg-black/60 border border-white/10 rounded focus:outline-none focus:border-cyan-500 text-white font-mono"
                />
              </div>
              <div>
                <label className="text-slate-500 block mb-0.5 uppercase text-[9px]">Repository Name</label>
                <input 
                  type="text"
                  value={gitRepo}
                  onChange={e => setGitRepo(e.target.value)}
                  placeholder="e.g. elite-escort-mod"
                  className="w-full p-1.5 bg-black/60 border border-white/10 rounded focus:outline-none focus:border-cyan-500 text-white font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              {isGitHubConnected ? (
                <button
                  onClick={handleDisconnectGitHub}
                  className="px-2 py-1 bg-red-600/25 border border-red-500/30 hover:bg-red-600 hover:text-white text-red-300 font-bold transition-all rounded cursor-pointer"
                >
                  DISCONNECT
                </button>
              ) : (
                <button
                  onClick={handleConnectGitHub}
                  className="px-2.5 py-1 bg-cyan-600/20 border border-cyan-500/40 hover:bg-cyan-500 hover:text-black text-cyan-300 font-bold transition-all rounded cursor-pointer uppercase"
                >
                  LINK PEER REMOTE
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Synchronizer Status Msg */}
      {syncStatusMsg && (
        <div className="px-3 py-1 bg-cyan-500/5 border-b border-cyan-500/10 text-[9px] font-mono text-cyan-300 uppercase flex items-center justify-between">
          <span className="truncate">{syncStatusMsg}</span>
          <button onClick={() => setSyncStatusMsg('')} className="hover:text-white cursor-pointer ml-1">×</button>
        </div>
      )}

      {/* SOURCE CONTROL TAB VIEW */}
      {activeTab === 'sourceControl' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-3 space-y-4">
          
          {/* Active changes lists */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-400 font-sans font-bold uppercase text-[9.5px] tracking-wider border-b border-white/5 pb-1">
              <span className="flex items-center gap-1" title="Files whose compiled XML differs from the loaded baseline snapshot — not git's working tree.">
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                Working Changeset
              </span>
              <span className="bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono text-[8px]">{workingChanges.length} Files</span>
            </div>

            {workingChanges.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-slate-550 border border-dashed border-white/5 rounded-lg bg-black/10">
                <Check className="w-6 h-6 text-emerald-500/40 mb-1" />
                <p className="text-[10px] font-mono font-bold text-slate-400">NO DIFF VS BASELINE</p>
                <p className="text-[9px] text-slate-500 leading-normal mt-0.5">Compiled XML matches the loaded baseline. Edit nodes or layout menus to draft commit diffs.</p>
              </div>
            ) : (
              <div className="space-y-1 font-mono text-[10.5px]">
                {workingChanges.map(change => (
                  <div 
                    key={change.path}
                    className="flex items-center justify-between p-2 rounded bg-black/20 hover:bg-white/[0.02] border border-white/5 group transition-all"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <div className="truncate">
                        <span className="text-slate-200 block font-sans truncate">{change.label}</span>
                        <span className="text-[8.5px] text-slate-500 italic block">{change.path}</span>
                      </div>
                    </div>
                    
                    {/* Diff lines counts */}
                    <div className="flex items-center gap-2">
                      <div className="text-[8.5px] flex items-center gap-1 font-mono">
                        <span className="text-emerald-400 font-bold">+{change.diffCount.additions}</span>
                        <span className="text-red-400 font-bold">-{change.diffCount.deletions}</span>
                      </div>
                      <button 
                        onClick={() => {
                          const mockCommit: GitCommitItem = {
                            sha: "PENDING",
                            message: "Working staged edits",
                            author: workspace.author || "Active Dev",
                            email: "KennySmith.1911@gmail.com",
                            timestamp: "Now",
                            branch: "main",
                            track: 0,
                            activeTracks: [0],
                            filesChanged: [{
                              path: change.path,
                              status: change.status,
                              diffLines: []
                            }]
                          };
                          // Replace diffLines directly to load on audit popup
                          mockCommit.filesChanged![0].diffLines = computeSimpleDiff(change.oldContent, change.newContent);
                          setSelectedCommit(mockCommit);
                          setInspectionFile(change.path);
                          setIsDiffModalOpen(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-black transition-all rounded cursor-pointer"
                        title="Audits code difference"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Staging actions and Commit Input */}
          <div className="p-3 bg-black/30 border border-white/5 rounded-lg space-y-3">
            <label className="text-[9px] font-mono font-bold uppercase text-slate-400 block tracking-wider">Commit drafting desk</label>
            
            <div className="relative">
              <textarea
                value={commitMessage}
                onChange={e => setCommitMessage(e.target.value)}
                placeholder="Message (Ctrl+Enter to commit...)"
                rows={2}
                disabled={generatingMessage}
                className="w-full bg-[#07090d] border border-white/10 rounded-md p-2 text-[10.5px] font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-none max-h-16 disabled:opacity-50"
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handlePerformCommit();
                  }
                }}
              />
              <button
                onClick={handleGenerateCommitMessageAI}
                disabled={generatingMessage || workingChanges.length === 0}
                className="absolute right-2 bottom-2 p-1.5 rounded-md bg-cyan-600/10 hover:bg-cyan-500 border border-cyan-500/20 hover:border-transparent text-cyan-400 hover:text-black transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                title="AI Generate ✨ Commit Message"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>

            {commitMessageError && (
              <p className="text-[9px] text-red-400 font-mono italic">{commitMessageError}</p>
            )}

            {/* AI diff summary (auto-attached on commit, or generate now) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono font-bold uppercase text-slate-450 tracking-wider">
                  Diff summary {diffSummary ? '' : <span className="text-slate-500 normal-case font-normal">(auto on commit)</span>}
                </span>
                <button
                  onClick={handleGenerateDiffSummary}
                  disabled={generatingSummary || workingChanges.length === 0}
                  className="px-1.5 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-300 disabled:opacity-30 transition-all cursor-pointer flex items-center gap-1 text-[9px] border border-cyan-500/20 font-mono uppercase"
                  title="Generate a plain-English summary of the staged changes using the configured AI"
                >
                  {generatingSummary ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
                  Generate
                </button>
              </div>
              {diffSummary && (
                <p className="text-[10px] text-slate-300 leading-relaxed bg-black/30 border border-white/5 rounded p-2 font-sans">
                  {diffSummary}
                </p>
              )}
            </div>

            <div className="flex gap-1.5 h-8">
              <button
                onClick={handlePerformCommit}
                disabled={workingChanges.length === 0}
                className="flex-1 py-1 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-black font-mono font-bold text-[10.5px] rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed uppercase"
              >
                <Check className="w-3.5 h-3.5" />
                Commit files
              </button>
              
              <button
                onClick={handlePushGitWorkspace}
                disabled={!isGitHubConnected || syncLoading}
                className="px-3 bg-[#0e121a] hover:bg-[#161c29] border border-white/10 disabled:opacity-35 text-slate-300 hover:text-white rounded transition-all cursor-pointer flex items-center justify-center"
                title="Saves commit logs to peer repository"
              >
                {syncLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Connected GitHub Overview footer inside pending tab */}
          {isGitHubConnected && (
            <div className="p-2.5 rounded bg-emerald-500/5 border border-emerald-500/10 space-y-1.5 font-mono text-[9px]">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1 font-bold uppercase text-[8px] text-emerald-400 animate-pulse">● Linked with Remote</span>
                <span>Active path: {activeBranch}</span>
              </div>
              <div className="text-white truncate flex items-center gap-1">
                <Github className="w-3 h-3 text-cyan-400 shrink-0" />
                {gitOwner}/{gitRepo}
              </div>
            </div>
          )}
        </div>
      )}

      {/* REMOTES TAB VIEW */}
      {activeTab === 'remotes' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-3 space-y-4 font-mono text-xs">

          {/* One-click GitHub sign-in (OAuth Device Flow) */}
          {!isGitHubConnected && (
            <div className="bg-gradient-to-b from-[#111622] to-[#0c1017] p-3 rounded-lg border border-cyan-500/25 space-y-2.5">
              <div className="text-white font-bold text-xs uppercase tracking-wide flex items-center gap-1.5">
                <Github className="w-4 h-4 text-cyan-400" />
                Connect with GitHub
              </div>
              {deviceFlow ? (
                <div className="space-y-2 text-center">
                  <p className="text-[10px] text-slate-400 leading-relaxed">In the GitHub tab that just opened, enter this code:</p>
                  <div className="text-xl font-mono font-bold tracking-[0.3em] text-cyan-300 bg-black/40 border border-cyan-500/30 rounded py-2 select-all">
                    {deviceFlow.userCode}
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <a href={deviceFlow.verificationUri} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 underline">Open github.com/login/device</a>
                    <button onClick={cancelDeviceFlow} className="text-[10px] text-slate-400 hover:text-white cursor-pointer">Cancel</button>
                  </div>
                  <p className="text-[9px] text-emerald-400 animate-pulse flex items-center justify-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Waiting for you to authorize…
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    One-click sign-in through your browser — no token copy-paste. Opens GitHub, you approve, and you're connected.
                  </p>
                  <button
                    onClick={handleConnectWithGitHub}
                    disabled={isConnecting}
                    className="w-full py-2 bg-cyan-600 hover:bg-cyan-400 hover:text-black text-slate-900 font-bold text-xs rounded transition-all cursor-pointer uppercase flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    {isConnecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Github className="w-3.5 h-3.5" />}
                    Connect with GitHub
                  </button>
                  <div className="text-center text-[9px] text-slate-600 uppercase tracking-wider">— or enter a token manually below —</div>
                </>
              )}
            </div>
          )}

          {/* GitHub Credentials Section inline if not connected, or general summary if connected */}
          {!isGitHubConnected ? (
            <div className="bg-slate-900/40 p-3 rounded-lg border border-dashed border-white/10 space-y-3">
              <div className="text-white font-mono font-semibold text-xs tracking-wide uppercase flex items-center gap-1.5 border-b border-white/5 pb-1.5">
                <Github className="w-4 h-4 text-slate-400" />
                Configure Remote GitHub Peer
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-slate-400 text-[10px] uppercase block mb-1 tracking-wider">Personal Access Token (PAT)</label>
                  <input
                    type="password"
                    value={gitPat}
                    onChange={e => setGitPat(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full p-2 rounded bg-black/60 border border-white/10 text-white focus:outline-none focus:border-cyan-500 text-xs text-slate-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-slate-400 text-[10px] uppercase block mb-1 tracking-wider">Owner</label>
                    <input
                      type="text"
                      value={gitOwner}
                      onChange={e => setGitOwner(e.target.value)}
                      placeholder="e.g. KennyG1990"
                      className="w-full p-2 bg-black/60 border border-white/10 rounded focus:outline-none focus:border-cyan-500 text-xs text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px] uppercase block mb-1 tracking-wider">Repository</label>
                    <input
                      type="text"
                      value={gitRepo}
                      onChange={e => setGitRepo(e.target.value)}
                      placeholder="e.g. x4-elite-escort"
                      className="w-full p-2 bg-black/60 border border-white/10 rounded focus:outline-none focus:border-cyan-500 text-xs text-slate-200"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 text-[10px] uppercase block mb-1 tracking-wider">Branch</label>
                  <input
                    type="text"
                    value={activeBranch}
                    onChange={e => setActiveBranch(e.target.value)}
                    placeholder="main"
                    className="w-full p-2 bg-black/60 border border-white/10 rounded focus:outline-none focus:border-cyan-505 text-xs text-slate-200"
                  />
                </div>
                <button
                  onClick={handleConnectGitHub}
                  className="w-full mt-1.5 py-1.5 bg-cyan-600 hover:bg-cyan-505 hover:text-black text-slate-900 font-mono font-bold text-xs rounded transition-all cursor-pointer uppercase flex items-center justify-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Link GitHub Repo
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#111622] p-3 rounded-lg border border-emerald-500/10 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                <span className="text-emerald-400 font-bold uppercase text-[10px] flex items-center gap-1 tracking-wider">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" />
                  Connected Peer
                </span>
                <button
                  onClick={handleDisconnectGitHub}
                  className="px-2 py-0.5 text-[9px] text-red-300 hover:text-red-205 bg-red-950/20 hover:bg-red-900/30 border border-red-900/30 rounded cursor-pointer font-bold"
                >
                  DISCONNECT
                </button>
              </div>
              <div className="space-y-1 text-[10.5px]">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold text-[9.5px]">Repository:</span>
                  <span className="text-white font-medium font-sans truncate max-w-[150px]">{gitOwner}/{gitRepo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold text-[9.5px]">Branch:</span>
                  <span className="text-cyan-400 italic">"{activeBranch}"</span>
                </div>
              </div>
            </div>
          )}

          {/* Create a brand-new repo from the active mod */}
          <div className="bg-black/20 p-3 rounded-lg border border-emerald-500/15 space-y-2">
            <h3 className="text-emerald-400 font-bold uppercase text-[10.5px] tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-1.5">
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              CREATE REPO FROM THIS MOD
            </h3>
            <p className="text-[10px] text-slate-400 leading-normal">
              Publishes "{workspace.name || 'this mod'}" as a new GitHub repository (named{' '}
              <span className="text-emerald-300 font-mono">{toRepoName(workspace.name)}</span>) and pushes its initial files. Requires a connected GitHub account.
            </p>
            <button
              onClick={handleCreateRepoFromMod}
              disabled={creatingRepo || !isGitHubConnected}
              className="w-full py-1.5 bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 hover:border-transparent text-emerald-300 hover:text-black font-bold uppercase rounded transition-all cursor-pointer disabled:opacity-30 flex items-center justify-center gap-1.5"
              title={isGitHubConnected ? 'Create and publish a new GitHub repository for this mod' : 'Connect GitHub in settings first'}
            >
              {creatingRepo ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Github className="w-3.5 h-3.5" />}
              Create &amp; Publish Repo
            </button>
          </div>

          {/* Loader Panel (LOAD) */}
          <div className="bg-black/20 p-3 rounded-lg border border-cyan-500/15 space-y-3">
            <h3 className="text-cyan-400 font-bold uppercase text-[10.5px] tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-1.5">
              <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
              LOAD SCRIPT FROM GITHUB
            </h3>
            <p className="text-[10px] text-slate-400 leading-normal">
              Download a workspace state json or Egosoft game XML script directly from the remote repository to load it into the workspace graph.
            </p>
            <div className="space-y-2">
              <div>
                <label className="text-slate-505 text-[10px] block mb-1">Target File to Load</label>
                <input
                  type="text"
                  value={filePathToLoad}
                  onChange={e => setFilePathToLoad(e.target.value)}
                  placeholder="e.g. ais_workspace.json"
                  className="w-full p-2 rounded bg-black/60 border border-white/10 text-white text-[11px] focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
              <button
                disabled={isProcessing || !isGitHubConnected}
                onClick={handleGitHubLoad}
                className="w-full py-1.5 bg-cyan-600/20 hover:bg-cyan-600 border border-cyan-500/30 hover:border-transparent text-cyan-300 hover:text-black font-bold uppercase rounded transition-all cursor-pointer disabled:opacity-20 flex items-center justify-center gap-1"
              >
                {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Fetch & Load remote file
              </button>
            </div>
          </div>

          {/* MULTI SNAPSHOT SOURCE SYNCHRONIZER (PUSH) */}
          <div className="bg-[#0e121a] p-3 rounded-lg border border-violet-500/15 space-y-3 animate-fade-in">
            <h3 className="text-violet-400 font-bold uppercase text-[10.5px] tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-1.5">
              <ChevronRight className="w-3.5 h-3.5 text-violet-400" />
              Sync & Push Pack targets
            </h3>
            <p className="text-[10px] text-slate-400 leading-normal">
              Package your visual flowchart designs and compiled Egosoft script codes back into a bundle and push to the remote repository recursively.
            </p>

            {/* Remote vs local diff overview (auto-scans when this tab opens while connected) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between border-b border-white/5 pb-1">
                <span className="text-[9.5px] text-slate-400 uppercase tracking-wider flex items-center gap-1 font-bold">
                  <GitCompare className="w-3.5 h-3.5 text-violet-400" />
                  Remote vs Local
                </span>
                <button
                  onClick={handleScanRemoteDiff}
                  disabled={isDiffLoading || !isGitHubConnected}
                  className="px-1.5 py-0.5 rounded bg-violet-500/10 hover:bg-violet-500/25 text-violet-300 disabled:opacity-30 transition-all cursor-pointer flex items-center gap-1 text-[9px] border border-violet-500/20"
                  title="Compare the active workspace against the remote repository"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${isDiffLoading ? 'animate-spin' : ''}`} />
                  Rescan
                </button>
              </div>
              <div className="bg-black/40 p-2 max-h-28 overflow-y-auto rounded border border-white/5 space-y-1 font-mono text-[10px]">
                {isDiffLoading ? (
                  <div className="text-slate-400 text-center py-3 animate-pulse">Comparing with remote…</div>
                ) : diffItems.length === 0 ? (
                  <div className="text-slate-500 text-center py-3 leading-normal">
                    {isGitHubConnected ? 'Auto-compares when opened; or press Rescan.' : 'Connect a repo to compare.'}
                  </div>
                ) : (
                  diffItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-1 ${item.type === 'add' ? 'text-emerald-400' : item.type === 'remove' ? 'text-red-400' : 'text-amber-400'}`}
                    >
                      <span className="font-bold font-sans shrink-0">{item.type === 'add' ? '+' : item.type === 'remove' ? '-' : '~'}</span>
                      <span className="text-slate-300">{item.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2 font-mono text-[10px] bg-black/30 p-2 rounded border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ais_workspace.json (Visual graph layout JSON)</span>
                <input
                  type="checkbox"
                  checked={pushSelectedFiles.workspace}
                  onChange={e => setPushSelectedFiles(prev => ({ ...prev, workspace: e.target.checked }))}
                  className="accent-violet-550 cursor-pointer h-3.5 w-3.5"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">md/{workspace.name || 'ais_mod'}.xml (Egosoft MD cues script)</span>
                <input
                  type="checkbox"
                  checked={pushSelectedFiles.md_xml}
                  onChange={e => setPushSelectedFiles(prev => ({ ...prev, md_xml: e.target.checked }))}
                  className="accent-violet-550 cursor-pointer h-3.5 w-3.5"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ui/ais_ui_layout.xml (HUD menu lua config)</span>
                <input
                  type="checkbox"
                  checked={pushSelectedFiles.ui_xml}
                  onChange={e => setPushSelectedFiles(prev => ({ ...prev, ui_xml: e.target.checked }))}
                  className="accent-violet-550 cursor-pointer h-3.5 w-3.5"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">README.md (Mod documentation log)</span>
                <input
                  type="checkbox"
                  checked={pushSelectedFiles.readme}
                  onChange={e => setPushSelectedFiles(prev => ({ ...prev, readme: e.target.checked }))}
                  className="accent-violet-550 cursor-pointer h-3.5 w-3.5"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-slate-500 text-[10px] block mb-1">Staging commit context message</label>
                <input
                  type="text"
                  placeholder="feat: customize active mission logical flows"
                  className="w-full p-1.5 rounded bg-black/60 border border-white/10 text-white text-[11px] focus:outline-none focus:border-violet-500 font-mono placeholder-slate-650"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleGithubPushMulti((e.target as HTMLInputElement).value);
                    }
                  }}
                />
              </div>
              <button
                disabled={isProcessing || !isGitHubConnected}
                onClick={() => handleGithubPushMulti()}
                className="w-full py-1.5 bg-violet-600/20 hover:bg-violet-600 border border-violet-500/30 hover:border-transparent text-violet-300 hover:text-black font-bold uppercase rounded transition-all cursor-pointer disabled:opacity-20 flex items-center justify-center gap-1.5"
              >
                {isProcessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-3.5 h-3.5" />}
                Sync & Push Updates
              </button>
            </div>
          </div>

          {/* Live Terminal Activity Log Console */}
          {terminalLogs.length > 0 && (
            <div className="space-y-1.5 font-mono">
              <div className="text-[9.5px] text-slate-400 uppercase tracking-wider flex items-center gap-1 md:gap-1.5 pb-0.5 border-b border-white/5">
                <Terminal className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                Live Synchronization Activity Logs
              </div>
              <div className="w-full max-h-36 overflow-y-auto bg-black p-2 rounded text-[10px] leading-relaxed text-slate-400 space-y-1 h-32 font-mono">
                {terminalLogs.map((log, idx) => {
                  let cls = '';
                  if (log.includes('❌')) cls = 'text-red-400 font-bold';
                  if (log.includes('🎉') || log.includes('SUCCESS')) cls = 'text-emerald-400 font-bold';
                  if (log.includes('[COMMITTED]')) cls = 'text-purple-400';
                  return (
                    <div key={idx} className={cls}>
                      {log}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Technical footer card info panel */}
          <div className="p-2 border border-slate-800 rounded bg-[#10141e]/50 flex items-center justify-between text-[9px] text-slate-500 font-mono">
            <span className="flex items-center gap-1">
              <Info className="w-3 h-3 text-cyan-400 animate-pulse" />
              Secure Proxy Connected
            </span>
            <span>API v3</span>
          </div>

        </div>
      )}

      {/* GRAPH TAB VIEW */}
      {activeTab === 'graph' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          
          {/* Action Row */}
          <div className="p-2 border-b border-white/5 bg-[#0d1117] flex items-center justify-end text-[9px] font-mono text-slate-400 shrink-0 select-none">
            <div className="flex items-center gap-2">
              <button onClick={handleFetchRemoteCommits} className="hover:text-cyan-400 flex items-center gap-0.5" title="Reload commit history from the remote repo">
                <ArrowDown className="w-3 h-3" />
                Pull
              </button>
              <button onClick={handlePushGitWorkspace} className="hover:text-cyan-400 flex items-center gap-0.5" title="Push staging logs">
                <ArrowUp className="w-3 h-3" />
                Push
              </button>
              <button onClick={handleFetchRemoteCommits} className="hover:text-cyan-400 flex items-center gap-0.5" title="Refresh commit history">
                <RefreshCw className="w-2.5 h-2.5" />
                Fetch
              </button>
            </div>
          </div>

          {/* List panel */}
          <div className="flex-1 overflow-y-auto relative min-h-0">
            
            {/* Absolute SVG overlays representing beautiful Git connecting branching paths */}
            <div className="absolute top-0 bottom-0 left-0 w-16 pointer-events-none z-0">
              <svg 
                className="w-full h-full"
                style={{ height: `${localHistory.length * 44}px` }}
              >
                {computedGraphTracks.map((path, index) => (
                  <path 
                    key={index}
                    d={path.d}
                    fill="none"
                    stroke={path.color}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.80"
                  />
                ))}
              </svg>
            </div>

            {/* Commit Log row items list */}
            <div className="relative z-10">
              {localHistory.length === 0 && (
                <div className="p-6 text-center text-[10px] text-slate-500 leading-relaxed font-sans">
                  {isGitHubConnected
                    ? 'No commits on this branch yet — push your mod to populate the history.'
                    : 'Connect a GitHub repo in the Remotes tab to view its commit history here.'}
                </div>
              )}
              {localHistory.map((commit) => {
                const nodeX = 14 + commit.track * 14;
                const nodeY = 22;
                const strokeColor = commit.track === 0 ? '#06b6d4' : (commit.track === 1 ? '#f97316' : '#ec4899');
                
                return (
                  <div 
                    key={commit.sha}
                    onClick={() => {
                      setSelectedCommit(commit);
                      if (commit.filesChanged && commit.filesChanged.length > 0) {
                        setInspectionFile(commit.filesChanged[0].path);
                      } else {
                        setInspectionFile('');
                      }
                      setIsDiffModalOpen(true);
                    }}
                    className="h-11 flex items-center hover:bg-white/5 border-b border-white/5 pl-16 pr-3 cursor-pointer group transition-all"
                  >
                    {/* Little relative node overlay precisely aligned within track coordinates */}
                    <div className="absolute left-0 w-16 h-11 pointer-events-none">
                      <svg className="w-full h-full">
                        <circle 
                          cx={nodeX} 
                          cy={nodeY} 
                          r="4.5" 
                          fill="#0a0c10" 
                          stroke={strokeColor} 
                          strokeWidth="2" 
                        />
                        {/* Inner micro ring if selected or author matches */}
                        {commit.sha === 'df8a12c' && (
                          <circle cx={nodeX} cy={nodeY} r="1.5" fill={strokeColor} />
                        )}
                      </svg>
                    </div>

                    {/* Commit specs */}
                    <div className="min-w-0 flex-1 pl-1 text-[10px] font-sans">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-100 font-medium truncate group-hover:text-cyan-400 transition-colors block leading-tight">
                          {commit.message}
                        </span>
                        
                        {/* Branch badging capsules */}
                        {commit.sha === 'df8a12c' && (
                          <span className="px-1 text-[7.5px] font-mono leading-none bg-cyan-950 border border-cyan-800 text-cyan-400 rounded shrink-0 font-bold">
                            main
                          </span>
                        )}
                        {commit.sha === 'cf017fa' && (
                          <span className="px-1 text-[7.5px] font-mono leading-none bg-orange-950 border border-orange-800 text-orange-400 rounded shrink-0 font-bold">
                            feature-wiki
                          </span>
                        )}
                        {commit.sha === '10fb2a0' && (
                          <span className="px-1 text-[7.5px] font-mono leading-none bg-pink-950 border border-pink-800 text-pink-400 rounded shrink-0 font-bold">
                            feature-hybrid
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[8.5px] text-slate-500 font-mono mt-0.5 leading-none">
                        <span className="text-slate-400 truncate max-w-[80px]">{commit.author}</span>
                        <span>•</span>
                        <span>{commit.timestamp}</span>
                        <span>•</span>
                        <span className="text-cyan-500">{commit.sha}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Active branch footer status strip */}
          <div className="p-1 px-2.5 border-t border-white/5 bg-[#080a0f] flex items-center justify-between text-[9px] font-mono text-slate-500 shrink-0">
            <div className="flex items-center gap-1.5">
              <GitBranch className="w-3 h-3 text-cyan-400" />
              <span className="text-slate-300 font-bold uppercase">main</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Linked
              </span>
            </div>
          </div>

        </div>
      )}

      {/* CODE DIFFERENCES POPUP MODAL (100% compliant with dynamic split-views) */}
      {isDiffModalOpen && selectedCommit && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm select-text">
          <div className="w-full max-w-4xl h-[70vh] bg-[#0c1017] border border-slate-800 rounded-lg shadow-2xl flex flex-col overflow-hidden font-sans">
            
            {/* Modal Header bar */}
            <div className="p-3.5 bg-[#0d121c] border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 px-1.5 rounded bg-slate-900 border border-white/10 font-mono text-[9.5px] text-cyan-400">{selectedCommit.sha}</span>
                <div className="text-xs">
                  <h3 className="font-bold text-white font-mono leading-tight">{selectedCommit.message}</h3>
                  <p className="text-[10px] text-slate-400 font-mono leading-normal mt-0.5">
                    Committed by <span className="text-cyan-300">{selectedCommit.author}</span> ({selectedCommit.email}) • {selectedCommit.timestamp}
                  </p>
                  {selectedCommit.summary && (
                    <p className="text-[10px] text-slate-300 leading-relaxed mt-1 max-w-2xl font-sans border-l-2 border-cyan-500/40 pl-2">
                      {selectedCommit.summary}
                    </p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setIsDiffModalOpen(false)}
                className="p-1 bg-slate-900 border border-white/5 hover:border-white/20 text-slate-400 hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal layout */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
              
              {/* Files list left tab column */}
              <div className="w-56 border-r border-white/5 bg-[#0a0c10] p-2 space-y-1 overflow-y-auto select-none">
                <h4 className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider p-1">Commit changeset Files</h4>
                
                {(!selectedCommit.filesChanged || selectedCommit.filesChanged.length === 0) ? (
                  <div className="p-2 text-[9.5px] text-slate-500 italic leading-relaxed">
                    No actual files affected (metadata alignment commit or synthetic commit log placeholder check).
                  </div>
                ) : (
                  selectedCommit.filesChanged.map(f => (
                    <button
                      key={f.path}
                      onClick={() => setInspectionFile(f.path)}
                      className={`w-full text-left p-2 rounded text-[10.5px] font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                        inspectionFile === f.path 
                          ? 'bg-cyan-600/15 border border-cyan-500/20 text-white' 
                          : 'hover:bg-white/5 border border-transparent text-slate-400'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">{f.path}</span>
                    </button>
                  ))
                )}
              </div>

              {/* Code viewer split panel right */}
              <div className="flex-1 bg-[#07090d] overflow-y-auto p-4 min-w-0">
                {(() => {
                  const activeFileObj = selectedCommit.filesChanged?.find(f => f.path === inspectionFile);
                  if (!activeFileObj) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                        <Terminal className="w-8 h-8 text-slate-700 mb-2" />
                        <h4 className="font-mono text-xs font-bold text-slate-400">SELECT CHANGED FILE</h4>
                        <p className="text-[10px] text-slate-500 mt-1 max-w-xs leading-normal">Pick a file from the repository changes checklist to audit the line-by-line diff of that commit.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-1 font-mono text-[11px] leading-relaxed select-text pr-2">
                      <div className="p-2 border border-slate-800/60 rounded bg-slate-900/50 mb-3 text-[10px] flex items-center justify-between text-slate-400">
                        <span>Auditing details for: <code className="text-cyan-400">{inspectionFile}</code></span>
                        <span className="text-slate-500 italic font-medium uppercase">Unified Diff view</span>
                      </div>

                      {activeFileObj.diffLines.map((line, idx) => {
                        let lineBg = 'hover:bg-white/5 text-slate-350';
                        let prefix = ' ';
                        if (line.type === 'addition') {
                          lineBg = 'bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-300';
                          prefix = '+';
                        } else if (line.type === 'deletion') {
                          lineBg = 'bg-red-500/10 hover:bg-red-500/15 text-red-300 line-through';
                          prefix = '-';
                        }

                        return (
                          <div 
                            key={idx} 
                            className={`flex min-w-full p-0.5 rounded px-2 whitespace-pre-wrap break-all ${lineBg}`}
                          >
                            <span className="w-6 text-slate-600 block shrink-0 select-none text-right pr-2 text-[10px]">{idx + 1}</span>
                            <span className="w-4 text-slate-500 block shrink-0 select-none font-bold text-[10px]">{prefix}</span>
                            <span className="flex-1 font-mono">{line.value}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* PopFooter status strip */}
            <div className="p-2 px-3 bg-[#0a0c10] border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>Branch context: <code className="text-slate-400">{selectedCommit.branch}</code></span>
              <span>SHA-256: <code>{selectedCommit.sha === 'PENDING' ? 'Uncommitted Workspace Diffs' : `e3f4a3028fb08c${selectedCommit.sha}`}</code></span>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
