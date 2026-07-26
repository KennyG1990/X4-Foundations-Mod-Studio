/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderIcon,
  ChevronRight,
  ChevronDown,
  FileJson,
  FileCode,
  FileText,
  Search,
  Save,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { ModWorkspace, sanitizeWorkspace, TranslationItem, TranslationPage, TFile } from '../types';
import { parseXMLToWorkspace } from '../lib/xmlParser';
import { confirmDialog, promptDialog } from '../lib/uiDialogs';
import { generateMDXML } from '../types';

export interface FSItem {
  name: string;
  kind: 'file' | 'directory';
  path: string;
  handle?: unknown; // FileSystemFileHandle or FileSystemDirectoryHandle
  children?: FSItem[];
  isMock?: boolean;
  content?: string; // For mock files
}

// QoL panel cache: the FILES tree survives panel switches (background-refreshed
// on mount instead of refetched with a visible empty state).
const FILE_TREE_CACHE: { tree: FSItem[] | null } = { tree: null };

interface FileReadResponse {
  content?: unknown;
}

interface ErrorResponse {
  error?: unknown;
}

const messageFromUnknown = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const responseErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  const body = await response.json().catch((): ErrorResponse => ({})) as ErrorResponse;
  return typeof body.error === 'string' ? body.error : fallback;
};

interface DirectoryExplorerProps {
  modWorkspacePath: string;
  filesystemPath: string;
  workspace: ModWorkspace;
  setWorkspace: React.Dispatch<React.SetStateAction<ModWorkspace>>;
  saveCheckpoint: (customTarget?: ModWorkspace) => void;
  workspaceView?: 'blueprint' | 'ui-designer' | 'aiscripts' | 'libraries' | 'xmlpatch' | 'contracts' | 'translation' | 'wiki' | 'project' | 'galaxy';
  setWorkspaceView?: (view: 'blueprint' | 'ui-designer' | 'aiscripts' | 'libraries' | 'xmlpatch' | 'contracts' | 'translation' | 'wiki' | 'project' | 'galaxy') => void;
  onOpenEditorFile?: (file: {
    name: string;
    path: string;
    content: string;
    handle?: unknown;
    isMock?: boolean;
  }) => void;
}



export default function DirectoryExplorer({
  modWorkspacePath,
  filesystemPath,
  workspace,
  setWorkspace,
  saveCheckpoint,
  workspaceView: _workspaceView,
  setWorkspaceView,
  onOpenEditorFile
}: DirectoryExplorerProps) {
  const [fileFilter, setFileFilter] = useState('');
  const [fileTree, setFileTree] = useState<FSItem[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleRefreshDirectory = useCallback(async () => {
    if (!filesystemPath && !modWorkspacePath) {
      setFileTree([]);
      return;
    }

    try {
      const response = await fetch('/api/fs/list');
      if (response.ok) {
        const tree = await response.json() as unknown;
        if (!Array.isArray(tree)) {
          throw new Error("Filesystem tree response was not an array.");
        }
        FILE_TREE_CACHE.tree = tree;
        setFileTree(tree);
        setStatusMessage({ type: 'success', text: "Synced project filesystem!" });
      } else {
        throw new Error("Failed to load filesystem tree.");
      }
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (error: unknown) {
      setStatusMessage({ type: 'error', text: `Sync failed: ${messageFromUnknown(error)}` });
    }
  }, [filesystemPath, modWorkspacePath]);

  // Re-scan whenever configured paths change. Serve the cached tree instantly
  // (panel switches), then refresh in the background.
  useEffect(() => {
    if (FILE_TREE_CACHE.tree) setFileTree(FILE_TREE_CACHE.tree);
    handleRefreshDirectory();
  }, [handleRefreshDirectory]);

  const toggleFolder = (path: string) => {
    setExpandedPaths(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // 4. File Click and Content Loader
  const handleFileClick = async (file: FSItem) => {
    try {
      saveCheckpoint();
      setActiveFilePath(file.path);

      const response = await fetch(`/api/fs/read?root=filesystem&path=${encodeURIComponent(file.path)}`);
      if (!response.ok) {
        throw new Error("Could not read file from server.");
      }
      const data = await response.json() as FileReadResponse;
      const fileText = typeof data.content === 'string' ? data.content : '';

      onOpenEditorFile?.({
        name: file.name,
        path: file.path,
        content: fileText
      });

      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'json') {
        try {
          const parsed = JSON.parse(fileText);
          if (parsed && typeof parsed === 'object') {
            const sanitized = sanitizeWorkspace(parsed);
            setWorkspace(sanitized);
            setStatusMessage({ type: 'success', text: `Opened Blueprint: ${file.name}` });
            setTimeout(() => setStatusMessage(null), 2000);
          } else {
            throw new Error("Invalid Mod Workspace configuration root.");
          }
        } catch (error: unknown) {
          setStatusMessage({ type: 'error', text: `JSON parse failed: ${messageFromUnknown(error)}` });
        }
      } else if (fileExtension === 'xml') {
        const isTFile = file.path.includes('/t/') || fileText.includes('<language');
        const isAIScript = file.path.includes('/aiscripts/') || fileText.includes('<aiscript');
        const isLibrary = file.path.includes('/libraries/') || fileText.includes('<diff');

        if (isTFile) {
          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(fileText, "application/xml");
            const langEl = doc.getElementsByTagName("language")[0];
            if (langEl) {
              const languageId = langEl.getAttribute("id") || "44";
              const pagesList = langEl.getElementsByTagName("page");
              const pages: TranslationPage[] = [];
              
              for (let i = 0; i < pagesList.length; i++) {
                const pEl = pagesList[i];
                const pageId = pEl.getAttribute("id") || "20001";
                const pageTitle = pEl.getAttribute("title") || `Page ${pageId}`;
                const itemsList = pEl.getElementsByTagName("t");
                const items: TranslationItem[] = [];
                
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
              
              const targetTFile: TFile = {
                languageId,
                fileName: file.name,
                pages
              };
              
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
              setStatusMessage({ type: 'success', text: `Loaded Language t-file (${languageId}): ${file.name}` });
            } else {
              throw new Error("No language root tag identified.");
            }
          } catch (error: unknown) {
            setStatusMessage({ type: 'error', text: `Could not parse Language XML: ${messageFromUnknown(error)}` });
          }
          setTimeout(() => setStatusMessage(null), 2500);
        } else if (isAIScript) {
          if (setWorkspaceView) {
            setWorkspaceView('aiscripts');
          }
          setStatusMessage({ type: 'success', text: `Loaded AIScript Behavior: ${file.name}` });
          setTimeout(() => setStatusMessage(null), 2500);
        } else if (isLibrary) {
          if (setWorkspaceView) {
            setWorkspaceView('xmlpatch');
          }
          setStatusMessage({ type: 'success', text: `Opened Library XML Patch: ${file.name}` });
          setTimeout(() => setStatusMessage(null), 2500);
        } else {
          // Fallback to standard MD script parser
          const decoded = parseXMLToWorkspace(fileText);
          if (decoded && decoded.nodes.length > 0) {
            setWorkspace(decoded);
            if (setWorkspaceView) {
              setWorkspaceView('blueprint');
            }
            setStatusMessage({ type: 'success', text: `Imported XML Script: ${file.name}` });
            setTimeout(() => setStatusMessage(null), 2500);
          } else {
            setStatusMessage({ 
              type: 'error', 
              text: "Could not find compatible cues or actions nodes inside this XML script." 
            });
          }
        }
      } else {
        // Non-node standard text file
        setStatusMessage({ type: 'info', text: `Inspected text: ${file.name} (Opening in graph is restricted)` });
        setTimeout(() => setStatusMessage(null), 2000);
      }
    } catch (error: unknown) {
      console.error(error);
      setStatusMessage({ type: 'error', text: `Failed opening file: ${messageFromUnknown(error)}` });
    }
  };

  // 5. Save Workspace back to active target file
  const handleSaveActiveFile = async () => {
    if (!activeFilePath) {
      setStatusMessage({ type: 'info', text: "Please select a file from the list to target for real-time saving." });
      return;
    }

    const fileExtension = activeFilePath.split('.').pop()?.toLowerCase();
    const contentToSave = fileExtension === 'json' 
      ? JSON.stringify(workspace, null, 2)
      : generateMDXML(workspace);

    try {
      const response = await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeFilePath, content: contentToSave })
      });
      if (response.ok) {
        setStatusMessage({ type: 'success', text: `Saved file: ${activeFilePath.split('/').pop()}` });
      } else {
        throw new Error(await responseErrorMessage(response, "Failed to write file on server."));
      }
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (error: unknown) {
      setStatusMessage({ type: 'error', text: `Save failed: ${messageFromUnknown(error)}` });
    }
  };

  // 6. Create or Add a new File element to targeted filesystem
  const handleAddNewFile = async (name: string, type: 'json' | 'xml') => {
    if (!name.trim()) return;
    const cleanName = name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const filename = cleanName.endsWith(`.${type}`) ? cleanName : `${cleanName}.${type}`;

    try {
      const initialContent = type === 'json' 
        ? JSON.stringify(workspace, null, 2)
        : generateMDXML(workspace);

      const createResponse = await fetch('/api/fs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: filename, type: 'file' })
      });
      if (!createResponse.ok) {
        throw new Error(await responseErrorMessage(createResponse, "Failed to create file on server."));
      }

      const writeResponse = await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filename, content: initialContent })
      });
      if (!writeResponse.ok) {
        throw new Error("Failed to write initial content.");
      }

      await handleRefreshDirectory();
      setStatusMessage({ type: 'success', text: `Created file: ${filename}` });
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (error: unknown) {
      setStatusMessage({ type: 'error', text: `Could not create file: ${messageFromUnknown(error)}` });
    }
  };

  const handleCreatePrompt = async () => {
    const filename = await promptDialog("Enter name for a new blueprint/script file (e.g., custom_patrol):", "custom_patrol");
    if (!filename) return;
    const selectType = await confirmDialog("Create as a Visual JSON Blueprint, or raw Egosoft MD Script XML?", { okLabel: 'JSON Blueprint', cancelLabel: 'MD Script XML' });
    handleAddNewFile(filename, selectType ? 'json' : 'xml');
  };

  // Recursively filter tree lists
  const filterTreeItems = (items: FSItem[], query: string): FSItem[] => {
    if (!query) return items;
    const lc = query.toLowerCase();
    
    return items.map(item => {
      if (item.kind === 'file') {
        return item.name.toLowerCase().includes(lc) ? item : null;
      }
      
      const filteredChildren = filterTreeItems(item.children || [], query);
      if (filteredChildren.length > 0 || item.name.toLowerCase().includes(lc)) {
        return {
          ...item,
          children: filteredChildren
        };
      }
      return null;
    }).filter((item): item is FSItem => item !== null);
  };

  const filteredTree = filterTreeItems(fileTree, fileFilter);

  // Render recursive list nodes
  const renderFSNode = (item: FSItem, depth = 0) => {
    const isDir = item.kind === 'directory';
    const isExpanded = expandedPaths[item.path] ?? false;
    const isActive = activeFilePath === item.path;

    return (
      <div key={item.path} style={{ paddingLeft: `${depth * 8}px` }}>
        {isDir ? (
          <div>
            <button
              onClick={() => toggleFolder(item.path)}
              className="w-full flex items-center py-1 px-1.5 text-[#a5aab8] hover:text-white hover:bg-white/[0.03] rounded text-left transition-colors font-mono text-[10.5px] font-medium cursor-pointer"
            >
              <span className="mr-0.5">
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
              <span className="mr-1.5 text-cyan-500">
                <FolderIcon className="w-3.5 h-3.5" />
              </span>
              <span className="truncate">{item.name}</span>
            </button>
            {isExpanded && item.children && (
              <div className="border-l border-white/5 ml-3 my-0.5">
                {item.children.map(child => renderFSNode(child, depth + 1))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => handleFileClick(item)}
            className={`w-full flex items-center py-1 px-1.5 rounded text-left transition-all font-mono text-[10.5px] border border-transparent cursor-pointer ${
              isActive 
                ? 'bg-cyan-950/20 text-cyan-400 border-cyan-500/25 font-semibold' 
                : 'text-slate-350 hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            <span className="ml-4 mr-1.5 shrink-0">
              {item.name.endsWith('.json') ? (
                <FileJson className="w-3.5 h-3.5 text-amber-500" />
              ) : item.name.endsWith('.xml') ? (
                <FileCode className="w-3.5 h-3.5 text-[#06b6d4]" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-slate-400" />
              )}
            </span>
            <span className="truncate flex-1">{item.name}</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-transparent text-[#e0e0e0] overflow-hidden select-none font-sans">
      {/* FileExplorer Top Bar */}
      <div className="p-3 border-b border-white/5 shrink-0 space-y-2 bg-transparent">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5 items-center bg-black/20 p-0.5 rounded border border-white/5 font-mono text-[9px]">
            <button
              onClick={handleRefreshDirectory}
              className="p-1 px-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer font-bold"
              title="Refresh project folder"
            >
              REFRESH
            </button>
            <span className="text-white/10 px-0.5">|</span>
            <button
              onClick={handleCreatePrompt}
              className="p-1 px-1.5 rounded hover:bg-white/5 text-cyan-400 hover:text-cyan-200 transition-all cursor-pointer font-bold"
              title="Create new script or workspace"
            >
              + NEW FILE
            </button>
          </div>
          <div className="flex gap-1">
            {activeFilePath && (
              <button
                onClick={handleSaveActiveFile}
                className="p-1 px-2 rounded bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 hover:text-cyan-200 border border-cyan-500/25 transition-all cursor-pointer flex items-center gap-1 text-[9px] font-bold font-mono uppercase"
                title="Save current nodes back to active file file"
              >
                <Save className="w-3 h-3" />
                <span>Save</span>
              </button>
            )}
          </div>
        </div>

        {/* Current Folder Path breadcrumb */}
        <div className="flex items-center gap-1.5 bg-black/35 rounded-md p-1.5 border border-white/5">
          <span className="font-mono text-[9.5px] text-cyan-500 flex-shrink-0">
            path://
          </span>
          <span className="font-mono text-[9.5px] font-bold text-slate-350 truncate tracking-wide flex-1" title={filesystemPath || modWorkspacePath || "No folder configured"}>
            {filesystemPath || modWorkspacePath || "No folder configured"}
          </span>
        </div>

        {/* File filter input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-slate-500" />
          <input
            type="text"
            value={fileFilter}
            onChange={e => setFileFilter(e.target.value)}
            placeholder="Search Files..."
            className="w-full pl-7 pr-2 py-1.5 rounded bg-black/40 border border-white/5 text-[10.5px] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
          />
        </div>
      </div>

      {/* Directory Tree Scroll List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar bg-transparent">
        {/* Tree Render entry point */}
        <div className="space-y-1">
          {filteredTree.length === 0 ? (
            <div className="text-center py-6 px-3 text-[10px] font-mono text-slate-500 leading-relaxed">
              {(filesystemPath || modWorkspacePath) ? "No files matched filters" : "No folder configured. Use Settings to configure your Filesystem folder."}
            </div>
          ) : (
            filteredTree.map(item => renderFSNode(item))
          )}
        </div>
      </div>

      {/* Synchronized status indicators details */}
      {statusMessage && (
        <div className={`p-2 font-mono text-[10px] border-t leading-snug shrink-0 flex items-center gap-1.5 ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
            : statusMessage.type === 'error'
            ? 'bg-red-500/10 text-red-400 border-red-500/20'
            : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="flex-1 truncate">{statusMessage.text}</span>
        </div>
      )}

      {/* Godot style Footer feedback detail */}
      <div className="p-2 border-t border-white/5 bg-[#17191e]/50 flex items-center justify-between font-mono text-[9px] text-slate-500 shrink-0">
        <span>Active File: {activeFilePath ? activeFilePath.split('/').pop() : 'None Loaded'}</span>
        {(filesystemPath || modWorkspacePath) && <span className="text-emerald-500">● Server Connected</span>}
      </div>
    </div>
  );
}
