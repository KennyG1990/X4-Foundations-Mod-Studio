/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  GitFork,
  Plus,
  Trash,
  Sliders,
  Sparkles,
  HelpCircle,
  Check,
  Bookmark,
  Search,
  Copy,
  PlusCircle,
  FileText,
  GitCompare
} from 'lucide-react';
import { ModWorkspace } from '../types';
import { compileDiffDocument as compileSharedDiffDocument } from '../lib/modCompiler';
import ObjectIndexPicker from './ObjectIndexPicker';
import XPathInput from './XPathInput';
import BulkTransformPanel from './BulkTransformPanel';
import { openNativeTextDiff } from '../lib/nativeEditor';

interface XMLPatchSystemProps {
  workspace: ModWorkspace;
  setWorkspace: React.Dispatch<React.SetStateAction<ModWorkspace>>;
  saveCheckpoint?: (customTarget?: ModWorkspace) => void;
  onServerWorkspaceApplied?: (workspace: ModWorkspace, metadata: { workspaceHash: string; version: number }) => void;
}

export interface PatchBlock {
  id: string;
  sel: string;
  action: 'add' | 'replace' | 'remove';
  content: string;
  note: string;
  pos?: 'before' | 'after' | 'prepend' | 'append';
  attrType?: string;
  targetFile?: string;
  includeInBuild?: boolean;
  generatedRuleId?: string;
  generatedPlanHash?: string;
  sourceSignature?: string;
}

interface SynthesizedPatchOp {
  type: 'add' | 'replace' | 'remove';
  sel: string;
  pos?: 'child' | 'before';
  attrType?: string;
  content?: string;
}

interface SynthesizedPatchResult {
  success?: boolean;
  targetFile?: string | null;
  ops: SynthesizedPatchOp[];
  diffXml: string;
  warnings?: string[];
}

const MERGE_PANE_PREVIEW_LIMIT = 12000;

function previewPaneText(value: string | null | undefined): string {
  const text = value || '';
  if (text.length <= MERGE_PANE_PREVIEW_LIMIT) return text;
  return `${text.slice(0, MERGE_PANE_PREVIEW_LIMIT)}\n\n... preview truncated at ${MERGE_PANE_PREVIEW_LIMIT.toLocaleString()} characters; synthesis still uses the full file ...`;
}

export interface BoilerplateSnippet {
  id: string;
  name: string;
  description: string;
  targetFile: string;
  sel: string;
  action: 'add' | 'replace' | 'remove';
  content: string;
}

export const BUILTIN_BOILERPLATES: BoilerplateSnippet[] = [
  {
    id: 'bp_new_ware',
    name: 'Add Custom Ware Def',
    description: 'XML layout to define a new commodity or trade ware inside libraries/wares.xml.',
    targetFile: 'libraries/wares.xml',
    sel: '/wares',
    action: 'add',
    content: `<ware id="ware_custom_darkmatter" name="Dark Matter Cannisters" description="Highly compressed gravitationally isolated dark matter." transport="container" volume="10" tags="economy equipment">
  <price min="1200" average="2500" max="4800" />
  <production time="60" amount="1" method="default" name="Dark Matter Synthesis">
    <primary>
      <ware ware="energycells" amount="100" />
      <ware ware="reachtransformers" amount="2" />
    </primary>
  </production>
</ware>`
  },
  {
    id: 'bp_patrol_job',
    name: 'Create Fighter Job Def',
    description: 'Spawns automatic defensive fleets or patrol squads in libraries/jobs.xml.',
    targetFile: 'libraries/jobs.xml',
    sel: '/jobs',
    action: 'add',
    content: `<job id="job_patrol_heavy_wing" name="Local Border Elite Squad" startactive="true">
  <modifiers rebuild="true" />
  <quota galaxy="5" sector="1" />
  <expirationtime min="7200" max="14400" />
  <task task="order.patrol" />
  <ship macro="ship_arg_s_fighter_01_a_macro">
    <select faction="argon" tags="[military, fighter]" />
    <owner exact="argon" overridenpc="true" />
  </ship>
</job>`
  },
  {
    id: 'bp_engine_speed',
    name: 'Ship Engine Speed Overdrive',
    description: 'Increases pitch, roll, yaw, and forward speed multiplier inside libraries/ship_macros.xml.',
    targetFile: 'libraries/ship_macros.xml',
    sel: '/macros/macro[@name="engine_arg_s_travel_01_macro"]/properties/thrust',
    action: 'replace',
    content: `<thrust pitch="2.5" roll="3.0" yaw="2.5" forward="350" reverse="150" />`
  },
  {
    id: 'bp_faction_entry',
    name: 'Register Custom Faction Def',
    description: 'Overrides faction standings, icons, and starting metrics in libraries/factions.xml.',
    targetFile: 'libraries/factions.xml',
    sel: '/factions',
    action: 'add',
    content: `<faction id="syndicate_outlaws" name="Custom Syndicate Outlaws" primaryrace="argon" shortname="SYN">
  <relations>
    <relation faction="player" value="0.1" />
    <relation faction="argon" value="-0.8" />
    <relation faction="xenon" value="-1.0" />
  </relations>
  <icon active="faction_syndicate_active" />
</faction>`
  },
  {
    id: 'bp_custom_cue',
    name: 'Mission Director Cue Template',
    description: 'Injects a standard game entry event-handler script template inside libraries/mission_director.xml.',
    targetFile: 'libraries/mission_director.xml',
    sel: '/mdscript/cues',
    action: 'add',
    content: `<cue name="Custom_Vessel_Reward_Event" instantiate="true">
  <conditions>
    <event_cue_signalled cue="md.Setup.Start" />
  </conditions>
  <actions>
    <create_ship name="$RewardShip" macro="ship_arg_s_fighter_01_a_macro" faction="faction.player">
      <space object="player.sector" />
    </create_ship>
  </actions>
</cue>`
  },
  {
    id: 'bp_shield_recharging',
    name: 'Ship Shield Def Tuning',
    description: 'Tweak ship shields direct regeneration and delays in libraries/ship_macros.xml.',
    targetFile: 'libraries/ship_macros.xml',
    sel: '/macros/macro[@name="ship_arg_xl_carrier_01_a_macro"]/properties/shield',
    action: 'add',
    content: `<rebuild rate="35" delay="1s" />`
  }
];

// B13b2 mailbox: the pretarget event fires while the workbench is unmounted (the same
// event switches the view); this module-scope listener lives from first import, so the
// mount effect can consume what arrived before mount.
let pendingPretarget: { targetFile: string; selector?: string } | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('xmlpatch-pretarget', (ev: Event) => {
    const file = String((ev as CustomEvent).detail?.targetFile || '').trim();
    const selector = String((ev as CustomEvent).detail?.selector || '').trim();
    if (file) pendingPretarget = { targetFile: file, ...(selector ? { selector } : {}) };
  });
}

export default function XMLPatchSystem({ workspace, setWorkspace, saveCheckpoint, onServerWorkspaceApplied }: XMLPatchSystemProps) {
  // QoL: default to a target that actually exists in vanilla (ship_macros.xml
  // does not — first open used to show a resolution error).
  const [targetFile, setTargetFile] = useState<string>('libraries/wares.xml');

  const patchBlocks = workspace.xmlPatches || [];
  const filteredBlocks = patchBlocks.filter(b => !b.targetFile || b.targetFile === targetFile);

  const [baseFileContent, setBaseFileContent] = useState<string | null>(null);
  const [baseFileLoading, setBaseFileLoading] = useState<boolean>(false);
  const [baseFileError, setBaseFileError] = useState<string | null>(null);
  const [effectiveSources, setEffectiveSources] = useState<Array<{ source: string; mode: string }>>([]);
  const [rightPanelTab, setRightPanelTab] = useState<'patch' | 'preview' | 'difftool'>('patch');
  const [pretargetSelector, setPretargetSelector] = useState<string>('');
  const [authoringMode, setAuthoringMode] = useState<'single' | 'bulk'>('single');

  // T4.2 Inc 2 — Diff→Patch merge view: the user edits a copy of the vanilla
  // file and the studio synthesizes the minimal <diff> ops via
  // POST /api/agent/xpath-synth (engine: src/lib/xpathSynth.ts).
  const [dtEdited, setDtEdited] = useState<string>('');
  const [dtSeededFor, setDtSeededFor] = useState<string | null>(null);
  const [dtBusy, setDtBusy] = useState(false);
  const [dtError, setDtError] = useState<string | null>(null);
  const [dtResult, setDtResult] = useState<SynthesizedPatchResult | null>(null);

  useEffect(() => {
    if (baseFileContent && dtSeededFor !== targetFile) {
      setDtEdited(baseFileContent);
      setDtSeededFor(targetFile);
      setDtResult(null);
      setDtError(null);
    }
  }, [baseFileContent, targetFile, dtSeededFor]);

  const runDiffToPatch = async () => {
    if (!baseFileContent) return;
    setDtBusy(true);
    setDtError(null);
    setDtResult(null);
    try {
      const res = await fetch('/api/agent/xpath-synth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vanillaXml: baseFileContent, editedXml: dtEdited, targetFile })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Synthesis failed (${res.status})`);
      setDtResult(data);
    } catch (err) {
      setDtError(err.message || 'Patch synthesis failed.');
    } finally {
      setDtBusy(false);
    }
  };

  const adoptSynthesizedOps = () => {
    if (!dtResult?.ops?.length) return;
    const stamp = Date.now();
    const blocks: PatchBlock[] = dtResult.ops.map((op, i) => ({
      id: `dt_${stamp}_${i}`,
      sel: op.sel,
      action: op.type,
      content: op.content || '',
      note: 'Diff→Patch synthesized',
      pos: op.pos === 'before' ? ('before' as const) : undefined,
      attrType: op.attrType || undefined,
      targetFile
    }));
    setWorkspace(prev => ({ ...prev, xmlPatches: [...(prev.xmlPatches || []), ...blocks] }));
    setDtResult(null);
    setRightPanelTab('patch');
  };

  const dtChangedLineCount = useMemo(() => {
    if (!baseFileContent || !dtEdited) return 0;
    return computeSimpleDiff(baseFileContent, dtEdited).filter(line => line.type !== 'normal').length;
  }, [baseFileContent, dtEdited]);

  const dtBasePreview = useMemo(() => previewPaneText(baseFileContent), [baseFileContent]);
  const dtPatchPreview = useMemo(() => previewPaneText(dtResult?.diffXml), [dtResult]);

  // B13b2: override-map "DIFF→PATCH" jump — pre-target this workbench from anywhere.
  // The event usually fires while this component is UNMOUNTED (the same event switches
  // the view, and we mount after) — the module-scope mailbox below catches it; this
  // effect consumes the mailbox on mount and handles the already-mounted case live.
  useEffect(() => {
    const apply = (target: { targetFile: string; selector?: string }) => {
      if (!target.targetFile) return;
      pendingPretarget = null; // consumed — never replays on a later mount
      setTargetFile(target.targetFile);
      setPretargetSelector(target.selector || '');
      setRightPanelTab(target.selector ? 'patch' : 'difftool');
      setDtSeededFor(null); // reseed the editable copy from the new file's vanilla content
    };
    if (pendingPretarget) apply(pendingPretarget);
    const handlePretarget = (ev: Event) => apply({
      targetFile: String((ev as CustomEvent).detail?.targetFile || '').trim(),
      selector: String((ev as CustomEvent).detail?.selector || '').trim() || undefined,
    });
    window.addEventListener('xmlpatch-pretarget', handlePretarget);
    return () => window.removeEventListener('xmlpatch-pretarget', handlePretarget);
  }, []);

  useEffect(() => {
    if (!targetFile) return;
    setBaseFileLoading(true);
    setBaseFileError(null);
    setEffectiveSources([]);
    setBaseFileContent(null);
    fetch(`/api/reference/effective-file?path=${encodeURIComponent(targetFile)}`)
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => {
            throw new Error(data.error || 'Failed to load base file');
          });
        }
        return res.json();
      })
      .then(data => {
        setBaseFileContent(data.content);
        setEffectiveSources(Array.isArray(data.sources) ? data.sources : []);
        setBaseFileLoading(false);
      })
      .catch(err => {
        setBaseFileError(err.message);
        setBaseFileLoading(false);
      });
  }, [targetFile]);

  const parsedBaseDoc = useMemo(() => {
    if (!baseFileContent) return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(baseFileContent, 'text/xml');
      const parserError = doc.getElementsByTagName("parsererror");
      if (parserError.length > 0) return null;
      return doc;
    } catch {
      return null;
    }
  }, [baseFileContent]);

  const applyPatchesResult = useMemo(() => {
    if (!parsedBaseDoc) return { doc: null, errors: {} as Record<string, string> };
    
    const doc = parsedBaseDoc.cloneNode(true) as Document;
    const errors: Record<string, string> = {};

    filteredBlocks.forEach(b => {
      if (!b.sel || b.includeInBuild === false) return;
      try {
        const nodes = doc.evaluate(
          b.sel,
          doc,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        );

        if (nodes.snapshotLength === 0) {
          errors[b.id] = "Selector matched 0 elements.";
          return;
        }

        for (let idx = 0; idx < nodes.snapshotLength; idx++) {
          const target = nodes.snapshotItem(idx) as Node;
          if (!target) continue;

          if (b.action === 'remove') {
            if (target.nodeType === Node.ATTRIBUTE_NODE) {
              const attr = target as Attr;
              const owner = attr.ownerElement;
              if (owner) {
                owner.removeAttribute(attr.name);
              }
            } else if (target.parentNode) {
              target.parentNode.removeChild(target);
            }
          } else if (b.action === 'replace') {
            if (target.nodeType === Node.ATTRIBUTE_NODE) {
              const attr = target as Attr;
              attr.value = b.content.trim();
            } else {
              const fragDoc = new DOMParser().parseFromString(`<root>${b.content}</root>`, 'text/xml');
              const parserError = fragDoc.getElementsByTagName("parsererror");
              if (parserError.length > 0) {
                throw new Error("XML syntax error in patch content.");
              }
              const parent = target.parentNode;
              if (parent) {
                const children = Array.from(fragDoc.documentElement.childNodes);
                children.forEach(child => {
                  const imported = doc.importNode(child, true);
                  parent.insertBefore(imported, target);
                });
                parent.removeChild(target);
              }
            }
          } else if (b.action === 'add') {
            if (target.nodeType === Node.ELEMENT_NODE) {
              const fragDoc = new DOMParser().parseFromString(`<root>${b.content}</root>`, 'text/xml');
              const parserError = fragDoc.getElementsByTagName("parsererror");
              if (parserError.length > 0) {
                throw new Error("XML syntax error in patch content.");
              }
              const children = Array.from(fragDoc.documentElement.childNodes);
              const pos = b.pos || 'append';

              if (pos === 'prepend') {
                children.reverse().forEach(child => {
                  const imported = doc.importNode(child, true);
                  target.insertBefore(imported, target.firstChild);
                });
              } else if (pos === 'before') {
                const parent = target.parentNode;
                if (parent) {
                  children.forEach(child => {
                    const imported = doc.importNode(child, true);
                    parent.insertBefore(imported, target);
                  });
                }
              } else if (pos === 'after') {
                const parent = target.parentNode;
                if (parent) {
                  const nextSib = target.nextSibling;
                  children.forEach(child => {
                    const imported = doc.importNode(child, true);
                    parent.insertBefore(imported, nextSib);
                  });
                }
              } else {
                // append
                children.forEach(child => {
                  const imported = doc.importNode(child, true);
                  target.appendChild(imported);
                });
              }
            } else {
              throw new Error("Cannot add children to non-element target.");
            }
          }
        }
      } catch (err) {
        errors[b.id] = err.message || String(err);
      }
    });

    return { doc, errors };
  }, [parsedBaseDoc, filteredBlocks]);

  const validateBlockXPath = (b: PatchBlock) => {
    if (baseFileLoading) {
      return { status: 'loading', message: 'Loading base file...' };
    }
    if (baseFileError) {
      return { status: 'no_file', message: 'Effective corpus file unavailable (XPath validation skipped)' };
    }
    if (!parsedBaseDoc) {
      return { status: 'no_file', message: 'No valid base file loaded' };
    }
    if (!b.sel.trim()) {
      return { status: 'warn', message: 'XPath selector is empty' };
    }

    try {
      const result = parsedBaseDoc.evaluate(
        b.sel,
        parsedBaseDoc,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      const count = result.snapshotLength;
      if (count === 0) {
        return { status: 'error', message: '❌ Selector matches 0 elements. Patch will fail silently in-game.', count };
      } else if (count === 1) {
        return { status: 'success', message: '✅ Selector matches exactly 1 target element.', count };
      } else {
        return { status: 'warn', message: `⚠️ Selector matches multiple elements (${count} matches). Patch will apply to all of them.`, count };
      }
    } catch (err) {
      return { status: 'error', message: `❌ Invalid XPath selector syntax: ${err.message || err}` };
    }
  };

  function computeSimpleDiff(oldStr: string, newStr: string) {
    const oldLines = (oldStr || '').split(/\r?\n/);
    const newLines = (newStr || '').split(/\r?\n/);
    const result: { type: 'addition' | 'deletion' | 'normal'; value: string }[] = [];
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

  const previewDiffLines = useMemo(() => {
    if (!baseFileContent || !applyPatchesResult.doc) return [];
    try {
      const serializer = new XMLSerializer();
      const modifiedXml = serializer.serializeToString(applyPatchesResult.doc);
      return computeSimpleDiff(baseFileContent, modifiedXml);
    } catch {
      return [];
    }
  }, [baseFileContent, applyPatchesResult.doc]);

  const diffSnippet = useMemo(() => {
    if (previewDiffLines.length === 0) return [];
    const contextSize = 3;
    const result: { type: 'addition' | 'deletion' | 'normal'; value: string; label: string }[] = [];

    let oldLineNum = 1;
    let newLineNum = 1;
    const linesWithMeta = previewDiffLines.map(line => {
      let label = '';
      if (line.type === 'normal') {
        label = `${oldLineNum}→${newLineNum}`;
        oldLineNum++;
        newLineNum++;
      } else if (line.type === 'deletion') {
        label = `${oldLineNum}   `;
        oldLineNum++;
      } else {
        label = `   ${newLineNum}`;
        newLineNum++;
      }
      return { ...line, label };
    });

    const changeIndices = linesWithMeta
      .map((line, idx) => (line.type !== 'normal' ? idx : -1))
      .filter(idx => idx !== -1);

    if (changeIndices.length === 0) {
      return [{ type: 'normal' as const, value: 'No changes detected. Modify or add patch blocks to preview.', label: '' }];
    }

    const indicesToInclude = new Set<number>();
    changeIndices.forEach(changeIdx => {
      const start = Math.max(0, changeIdx - contextSize);
      const end = Math.min(linesWithMeta.length - 1, changeIdx + contextSize);
      for (let i = start; i <= end; i++) {
        indicesToInclude.add(i);
      }
    });

    let lastIncludedIdx = -1;
    linesWithMeta.forEach((line, idx) => {
      if (indicesToInclude.has(idx)) {
        if (lastIncludedIdx !== -1 && idx - lastIncludedIdx > 1) {
          result.push({ type: 'normal', value: `... [Skip ${idx - lastIncludedIdx - 1} lines] ...`, label: '...' });
        }
        result.push(line);
        lastIncludedIdx = idx;
      }
    });

    return result;
  }, [previewDiffLines]);

  const [sidebarTab, setSidebarTab] = useState<'recipes' | 'boilerplates' | 'tree'>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);

  // New customizable forms inside the boilerplates section
  const [isCreatingCustomBP, setIsCreatingCustomBP] = useState(false);
  const [newBPRelativePath, setNewBPRelativePath] = useState('libraries/wares.xml');
  const [newBPName, setNewBPName] = useState('');
  const [newBPDescription, setNewBPDescription] = useState('');
  const [newBPSel, setNewBPSel] = useState('/wares');
  const [newBPAction, setNewBPAction] = useState<'add' | 'replace' | 'remove'>('add');
  const [newBPContent, setNewBPContent] = useState('');

  const [customSnippets, setCustomSnippets] = useState<BoilerplateSnippet[]>(() => {
    try {
      const saved = localStorage.getItem('x4_custom_xml_snippets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleSaveBlockAsBoilerplate = (b: PatchBlock) => {
    const newBP: BoilerplateSnippet = {
      id: `custom_bp_${Date.now()}`,
      name: b.note || `Custom Patch: ${b.sel.substring(0, 16)}`,
      description: `Saved from active workbench on target file: ${b.targetFile || targetFile}`,
      targetFile: b.targetFile || targetFile,
      sel: b.sel,
      action: b.action,
      content: b.content
    };
    const updated = [newBP, ...customSnippets];
    setCustomSnippets(updated);
    localStorage.setItem('x4_custom_xml_snippets', JSON.stringify(updated));
    setSidebarTab('boilerplates');
    alert(`"${newBP.name}" has been successfully saved to your XML Boilerplates library!`);
  };

  const handleCreateCustomBoilerplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBPName.trim()) return alert("Please enter a name for the boilerplate.");
    
    const newBP: BoilerplateSnippet = {
      id: `custom_bp_${Date.now()}`,
      name: newBPName,
      description: newBPDescription || 'Custom user-saved XML boilerplate',
      targetFile: newBPRelativePath,
      sel: newBPSel,
      action: newBPAction,
      content: newBPContent
    };
    
    const updated = [newBP, ...customSnippets];
    setCustomSnippets(updated);
    localStorage.setItem('x4_custom_xml_snippets', JSON.stringify(updated));
    
    // reset form
    setNewBPName('');
    setNewBPDescription('');
    setNewBPSel('/wares');
    setNewBPAction('add');
    setNewBPContent('');
    setIsCreatingCustomBP(false);
  };

  const handleDeleteCustomSnippet = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customSnippets.filter(s => s.id !== id);
    setCustomSnippets(updated);
    localStorage.setItem('x4_custom_xml_snippets', JSON.stringify(updated));
  };

  const handleApplyBoilerplate = (bp: BoilerplateSnippet) => {
    const newBlock: PatchBlock = {
      id: `p_block_${Date.now()}`,
      sel: bp.sel,
      action: bp.action,
      content: bp.content,
      note: bp.name,
      targetFile: bp.targetFile
    };
    savePatches([...patchBlocks, newBlock]);
    if (bp.targetFile) {
      setTargetFile(bp.targetFile);
    }
  };

  const handleCopyToClipboardAndNotify = (bp: BoilerplateSnippet, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(bp.content);
    setCopiedSnippetId(bp.id);
    setTimeout(() => setCopiedSnippetId(null), 1500);
  };

  const savePatches = (newPatches: PatchBlock[]) => {
    setWorkspace(prev => ({
      ...prev,
      xmlPatches: newPatches
    }));
  };

  const handleAddPatchBlock = (action: 'add' | 'replace' | 'remove') => {
    let sel = '/';
    let content = '';
    let note = '';

    if (action === 'add') {
      sel = '/components/component[@name="ship_storage"]/properties';
      content = '<storage volume="1500" type="container" />';
      note = 'Add container volume to station storage pods';
    } else if (action === 'replace') {
      sel = '/soundlibrary/sound[@id="alarm_red"]/volume';
      content = '<volume level="0.8" />';
      note = 'Reduce sound volume of red alarms';
    } else {
      sel = '/police/scanners/frequent_checks';
      content = '';
      note = 'Mute space police scan timers';
    }

    const nBlock: PatchBlock = {
      id: `p_block_${Date.now()}`,
      sel: pretargetSelector || sel,
      action,
      content,
      note,
      targetFile
    };

    savePatches([...patchBlocks, nBlock]);
    setPretargetSelector('');
  };

  const handleDeletePatchBlock = (id: string) => {
    savePatches(patchBlocks.filter(b => b.id !== id));
  };

  const handleUpdatePatchBlock = (id: string, key: keyof PatchBlock, val: any) => {
    const next = patchBlocks.map(b => {
      if (b.id === id) {
        return { ...b, [key]: val };
      }
      return b;
    });
    savePatches(next);
  };

  // Recipe templates loader
  const handleLoadRecipe = (recipeKey: 'carrier_hangar' | 'combat_music' | 'shield_stats') => {
    let raw: PatchBlock;
    if (recipeKey === 'carrier_hangar') {
      raw = {
        id: `recipe_${Date.now()}`,
        sel: '/macros/macro[@name="ship_tel_xl_carrier_01_a_macro"]/properties/hangars',
        action: 'replace',
        content: '<dock capacity="80" class="ship_s" />\n    <dock capacity="20" class="ship_m" />',
        note: 'Expand XL Carrier drone & squad hangar counts',
        targetFile: 'libraries/ship_macros.xml'
      };
    } else if (recipeKey === 'combat_music') {
      raw = {
        id: `recipe_${Date.now()}`,
        sel: '/soundlibrary/playlist[@id="combat_music_playlist"]',
        action: 'add',
        content: '<track path="sound/music/custom_battle_drum" intensity="high" />',
        note: 'Inject deep custom war drum playlist track',
        targetFile: 'libraries/sound_library.xml'
      };
    } else {
      raw = {
        id: `recipe_${Date.now()}`,
        sel: '/parameters/shield[@id="boost_shield_regen"]/modifiers',
        action: 'replace',
        content: '<multiplier value="2.5" />',
        note: 'Boost combat overdrive shield multipliers',
        targetFile: 'libraries/ship_macros.xml'
      };
    }

    savePatches([...patchBlocks, raw]);
  };

  // Compile full patch document XML. SINGLE SOURCE OF TRUTH: the shared
  // modCompiler.compileDiffDocument (which escapes sel/attrs and emits the
  // attrType + attribute-replace forms). A local duplicate of this function
  // silently diverged once (dropped type="@attr") — do not reintroduce one.
  const compileDiffDocument = (): string =>
    compileSharedDiffDocument(
      patchBlocks.filter(b => !b.targetFile || b.targetFile === targetFile),
      targetFile
    );

  const copyToClipboard = () => {
    navigator.clipboard.writeText(compileDiffDocument());
    alert("Diff Patch XML document copied on clipboard!");
  };

  const openNativeDiff = () => {
    if (!baseFileContent) return;
    const opened = openNativeTextDiff({
      title: `X4 Patch Candidate — ${targetFile}`,
      leftLabel: `${targetFile} (effective vanilla)`,
      rightLabel: `${targetFile} (edited candidate)`,
      leftContent: baseFileContent,
      rightContent: dtEdited,
      language: 'xml',
    });
    if (!opened) alert('Native diff viewing is available in the installed Antigravity/VS Code extension.');
  };

  return (
    <div id="xml_patch_workbench_view" className="flex-1 bg-[#0a0c10] flex flex-col h-full overflow-hidden text-slate-300">
      {/* Simulation HUD Controls bar */}
      <div className="bg-[#161920]/90 border-b border-white/10 p-3 flex items-center justify-between font-mono text-xs">
        <div className="flex items-center gap-2">
          <GitFork className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-slate-200 uppercase tracking-tight">XML DIFF INTERACTIVE WORKBENCH</span>
          <div className="ml-3 flex rounded border border-white/10 bg-black/30 p-0.5">
            <button onClick={() => setAuthoringMode('single')} className={`rounded px-2.5 py-1 text-[8.5px] font-bold uppercase ${authoringMode === 'single' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-500 hover:text-slate-300'}`}>Single patch</button>
            <button onClick={() => setAuthoringMode('bulk')} className={`rounded px-2.5 py-1 text-[8.5px] font-bold uppercase ${authoringMode === 'bulk' ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-500 hover:text-slate-300'}`}>Bulk transform</button>
          </div>
        </div>
        
        {/* Target file selectors */}
        {authoringMode === 'single' && <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-slate-500 uppercase font-bold text-[9.5px]">Target File:</span>
          <div className="w-80">
            <ObjectIndexPicker
              endpoint="/api/agent/patch-targets"
              kind="patch-target"
              value={targetFile}
              onChange={v => setTargetFile(v)}
              placeholder="Search real base-game files… (e.g. libraries/wares.xml)"
            />
          </div>
          {effectiveSources.length > 0 && (
            <span className="max-w-56 truncate text-[8.5px] text-emerald-500/80" title={effectiveSources.map(source => `${source.source} (${source.mode})`).join(' → ')}>
              effective: {effectiveSources.map(source => source.source).join(' + ')}
            </span>
          )}
          {pretargetSelector && (
            <span className="max-w-72 truncate rounded border border-amber-500/25 bg-amber-500/5 px-2 py-1 text-[8.5px] text-amber-300" title={pretargetSelector}>
              Patch existing: {pretargetSelector}
            </span>
          )}
        </div>}
      </div>

      {authoringMode === 'bulk' ? (
        <BulkTransformPanel workspace={workspace} setWorkspace={setWorkspace} saveCheckpoint={saveCheckpoint} onServerWorkspaceApplied={onServerWorkspaceApplied} />
      ) : (
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Recipes and template insertions */}
        <div className="w-80 border-r border-white/10 p-3.5 flex flex-col h-full bg-[#0d0f14]/80 overflow-y-auto space-y-4">
          {/* Tab switcher */}
          <div className="flex border-b border-white/10 mb-2 shrink-0">
            <button
              onClick={() => setSidebarTab('tree')}
              className={`flex-1 pb-2 text-center text-xs font-mono font-bold tracking-wider uppercase transition-colors border-b-2 cursor-pointer ${
                sidebarTab === 'tree'
                  ? 'border-emerald-500 text-emerald-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Tree
            </button>
            <button
              onClick={() => setSidebarTab('recipes')}
              className={`flex-1 pb-2 text-center text-xs font-mono font-bold tracking-wider uppercase transition-colors border-b-2 cursor-pointer ${
                sidebarTab === 'recipes'
                  ? 'border-emerald-500 text-emerald-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Recipes
            </button>
            <button
              onClick={() => setSidebarTab('boilerplates')}
              className={`flex-1 pb-2 text-center text-xs font-mono font-bold tracking-wider uppercase transition-colors border-b-2 cursor-pointer ${
                sidebarTab === 'boilerplates'
                  ? 'border-emerald-500 text-emerald-400 font-extrabold'
                  : 'border-transparent text-slate-305 hover:text-white'
              }`}
            >
              Boilerplates
            </button>
          </div>

          {sidebarTab === 'tree' ? (
            <div className="space-y-4 animate-fadeIn flex-1 flex flex-col overflow-hidden">
              <div>
                <h3 className="text-xs font-mono font-bold text-emerald-400 border-b border-white/10 pb-1.5 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  📁 xml patches tree
                </h3>
                <p className="text-[10px] text-slate-500 mb-3 leading-relaxed font-mono">
                  Observability hierarchy of all defined XML patch instructions created in the current mod.
                </p>

                <div className="space-y-4 font-mono text-[11px] max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
                  {patchBlocks.length === 0 ? (
                    <div className="text-[10px] text-slate-500 italic p-4 text-center border border-white/5 bg-black/10 rounded">
                      No XML patches registered in the current existing mod session. Use the central Workbench to define your first diff operation node!
                    </div>
                  ) : (
                    Array.from(new Set(patchBlocks.map(p => p.targetFile || targetFile))).map(tFile => {
                      const filePatches = patchBlocks.filter(p => (p.targetFile || targetFile) === tFile);
                      return (
                        <div key={tFile} className="space-y-1.5">
                          {/* File Header Node */}
                          <button
                            onClick={() => setTargetFile(tFile)}
                            className={`w-full p-1.5 px-2 rounded font-bold text-left flex items-center gap-1.5 transition-colors border ${
                              targetFile === tFile ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-black/20 text-slate-300 border-transparent hover:bg-white/5'
                            }`}
                          >
                            <span>📄</span>
                            <span className="truncate flex-1">{tFile}</span>
                            <span className="text-[9px] bg-black/40 px-1.5 rounded text-slate-400 font-bold">{filePatches.length}</span>
                          </button>

                          {/* Patches list inside file */}
                          <div className="pl-3.5 border-l border-white/5 space-y-1.5">
                            {filePatches.map(patch => (
                              <div
                                key={patch.id}
                                className="p-1 px-1.5 rounded bg-black/15 hover:bg-white/[0.02] border border-transparent hover:border-white/5 flex items-start justify-between gap-1 group/pnode"
                              >
                                <button
                                  onClick={() => {
                                    setTargetFile(tFile);
                                  }}
                                  className="flex-1 text-left cursor-pointer truncate"
                                >
                                  <div className="flex items-center gap-1">
                                    <span className={`text-[8px] uppercase font-bold px-1 rounded ${
                                      patch.action === 'add' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                      patch.action === 'replace' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    }`}>
                                      {patch.action}
                                    </span>
                                    <span className="truncate text-slate-350 font-semibold max-w-[130px]" title={patch.sel}>{patch.sel}</span>
                                  </div>
                                  {patch.note && (
                                    <span className="text-[9px] text-slate-505 block truncate max-w-[160px]">{patch.note}</span>
                                  )}
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updated = patchBlocks.filter(p => p.id !== patch.id);
                                    savePatches(updated);
                                  }}
                                  className="p-1 text-slate-600 hover:text-rose-400 cursor-pointer opacity-0 group-hover/pnode:opacity-100 transition-opacity ml-1"
                                  title="Delete patch specification element"
                                >
                                  <Trash className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : sidebarTab === 'recipes' ? (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <h3 className="text-xs font-mono font-bold text-emerald-400 border-b border-white/10 pb-1.5 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  DIFF RECIPES LIBRARY
                </h3>
                <p className="text-[10.5px] text-slate-500 mb-3 leading-relaxed font-mono">
                  Inject standard patch layouts for ship components, audio soundscapes, or statistics overrides instantly.
                </p>

                <div className="space-y-1.5">
                  <button
                    onClick={() => handleLoadRecipe('carrier_hangar')}
                    className="w-full text-left p-2.5 rounded bg-[#1c1f26] border border-white/5 hover:border-emerald-500 transition-all flex flex-col justify-start items-start gap-1 cursor-pointer"
                  >
                    <div className="text-xs font-bold text-slate-200">Expand Carrier Hangar Bay</div>
                    <div className="text-[9px] text-slate-500 font-mono">Target: libraries/ship_macros.xml</div>
                  </button>
                  
                  <button
                    onClick={() => handleLoadRecipe('combat_music')}
                    className="w-full text-left p-2.5 rounded bg-[#1c1f26] border border-white/5 hover:border-emerald-500 transition-all flex flex-col justify-start items-start gap-1 cursor-pointer"
                  >
                    <div className="text-xs font-bold text-slate-200">Custom Battle Tracks playlist</div>
                    <div className="text-[9px] text-slate-500 font-mono">Target: libraries/sound_library.xml</div>
                  </button>

                  <button
                    onClick={() => handleLoadRecipe('shield_stats')}
                    className="w-full text-left p-2.5 rounded bg-[#1c1f26] border border-white/5 hover:border-emerald-500 transition-all flex flex-col justify-start items-start gap-1 cursor-pointer"
                  >
                    <div className="text-xs font-bold text-slate-200 font-sans">Shield Generation Multipliers</div>
                    <div className="text-[9px] text-slate-500 font-mono">Target: xml parameters database</div>
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-mono font-bold text-slate-400 border-b border-white/10 pb-1.5 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
                  What are XML Diffs?
                </h3>
                <div className="bg-black/20 p-3 rounded border border-white/5 text-[10.5px] leading-relaxed text-slate-400 font-mono space-y-2">
                  <p>
                    In X4: Foundations, files can be patched safely rather than entirely overwritten. This allows multiple mods to edit the same files independently!
                  </p>
                  <p>
                    - <span className="text-emerald-400 font-bold">&lt;add&gt;</span> appends nodes into the selector parent.<br />
                    - <span className="text-emerald-400 font-bold">&lt;replace&gt;</span> replaces existing nodes / attributes.<br />
                    - <span className="text-emerald-400 font-bold">&lt;remove&gt;</span> drops attributes/elements completely.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fadeIn flex-1 flex flex-col overflow-hidden">
              <div className="flex flex-col gap-2 shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
                    BOILERPLATES & SNIPPETS
                  </h3>
                  
                  <button
                    onClick={() => setIsCreatingCustomBP(!isCreatingCustomBP)}
                    className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-mono p-1 px-2 rounded border border-emerald-500/25 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-3 h-3" />
                    {isCreatingCustomBP ? 'Cancel' : 'New'}
                  </button>
                </div>
                
                {/* Search filter input */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search snippets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 text-xs text-slate-300 rounded p-1.5 pl-8 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              {isCreatingCustomBP ? (
                <form onSubmit={handleCreateCustomBoilerplate} className="bg-black/35 border border-white/5 rounded p-3 space-y-2.5 shrink-0 select-none">
                  <div className="text-[11px] font-mono font-bold text-emerald-400 uppercase border-b border-white/10 pb-1">Create Custom Boilerplate</div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] text-slate-500 font-mono uppercase">Snippet Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Inflow Engine Thrust"
                      value={newBPName}
                      onChange={(e) => setNewBPName(e.target.value)}
                      className="bg-[#14161d] border border-white/10 text-xs text-slate-200 rounded p-1.5 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] text-slate-500 font-mono uppercase">Description</label>
                    <input
                      type="text"
                      placeholder="Brief summary of what this code does"
                      value={newBPDescription}
                      onChange={(e) => setNewBPDescription(e.target.value)}
                      className="bg-[#14161d] border border-white/10 text-xs text-slate-200 rounded p-1.5 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9.5px] text-slate-500 font-mono uppercase">Target File</label>
                      <select
                        value={newBPRelativePath}
                        onChange={(e) => setNewBPRelativePath(e.target.value)}
                        className="bg-[#14161d] border border-white/10 text-[10px] text-slate-300 rounded p-1 p-y-1.5 focus:outline-none cursor-pointer"
                      >
                        <option value="libraries/wares.xml">wares.xml</option>
                        <option value="libraries/jobs.xml">jobs.xml</option>
                        <option value="libraries/ship_macros.xml">ship_macros.xml</option>
                        <option value="libraries/factions.xml">factions.xml</option>
                        <option value="libraries/sound_library.xml">sound_library.xml</option>
                        <option value="libraries/mission_director.xml">mission_director.xml</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[9.5px] text-slate-500 font-mono uppercase">Action Type</label>
                      <select
                        value={newBPAction}
                        onChange={(e) => setNewBPAction(e.target.value as any)}
                        className="bg-[#14161d] border border-white/10 text-[10px] text-slate-300 rounded p-1 p-y-1.5 focus:outline-none cursor-pointer"
                      >
                        <option value="add">add node</option>
                        <option value="replace">replace attr/node</option>
                        <option value="remove">remove node</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] text-slate-500 font-mono uppercase">XPath Selector / Node Target</label>
                    <XPathInput
                      targetPath={newBPRelativePath}
                      placeholder="e.g. /wares"
                      value={newBPSel}
                      onChange={setNewBPSel}
                      className="bg-[#14161d] border border-white/10 text-xs font-mono text-slate-200 rounded p-1.5 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] text-slate-500 font-mono uppercase">Code Content</label>
                    <textarea
                      placeholder="XML definition content..."
                      value={newBPContent}
                      onChange={(e) => setNewBPContent(e.target.value)}
                      rows={4}
                      className="bg-[#14161d] border border-white/10 text-xs font-mono text-slate-200 rounded p-1.5 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs p-2 rounded font-bold transition-colors cursor-pointer"
                  >
                    Save Boilerplate Snippet
                  </button>
                </form>
              ) : null}

              {/* Snippets list Container */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {[...customSnippets, ...BUILTIN_BOILERPLATES]
                  .filter(bp => {
                    const query = searchQuery.toLowerCase().trim();
                    if (!query) return true;
                    return (
                      bp.name.toLowerCase().includes(query) ||
                      bp.description.toLowerCase().includes(query) ||
                      bp.targetFile.toLowerCase().includes(query) ||
                      bp.content.toLowerCase().includes(query)
                    );
                  })
                  .map(bp => {
                    const isCustom = bp.id.startsWith('custom_bp_');
                    return (
                      <div
                        key={bp.id}
                        className="bg-[#1c1f26]/80 hover:bg-[#1c1f26] border border-white/5 hover:border-emerald-500/30 p-2.5 rounded-lg flex flex-col gap-1.5 shadow transition-all group/bp relative"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex flex-col">
                            <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                              <FileText className="w-3 h-3 text-slate-400" />
                              {bp.name}
                              {isCustom && <span className="text-[8px] uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 rounded">user</span>}
                            </div>
                            <div className="text-[10px] text-slate-450 leading-normal mt-0.5">{bp.description}</div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 opacity-40 group-hover/bp:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleCopyToClipboardAndNotify(bp, e)}
                              className="p-1 rounded bg-[#0F1115] hover:bg-black/40 text-slate-400 hover:text-cyan-400 border border-white/5 cursor-pointer flex items-center justify-center transition-colors"
                              title="Copy code to clipboard"
                            >
                              {copiedSnippetId === bp.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                            
                            {isCustom && (
                              <button
                                onClick={(e) => handleDeleteCustomSnippet(bp.id, e)}
                                className="p-1 rounded bg-[#0F1115] hover:bg-black/40 text-slate-400 hover:text-red-400 border border-white/5 cursor-pointer flex items-center justify-center transition-colors"
                                title="Delete custom snippet"
                              >
                                <Trash className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9px] text-slate-500">
                          <span className="bg-[#0F1115] px-1.5 py-0.5 rounded text-[8.5px] text-slate-400 truncate max-w-[130px]" title={bp.targetFile}>
                            {bp.targetFile}
                          </span>
                          <span className="bg-[#0F1115] px-1.5 py-0.5 rounded text-[8.5px] text-emerald-400">
                            sel: {bp.sel.substring(0, 16)}{bp.sel.length > 16 ? '...' : ''}
                          </span>
                          <span className="bg-[#0F1115] px-1.5 py-0.5 rounded text-[8.5px] text-purple-400">
                            act: {bp.action}
                          </span>
                        </div>

                        <button
                          onClick={() => handleApplyBoilerplate(bp)}
                          className="w-full text-center py-1 mt-1 font-mono text-[9px] font-bold text-emerald-400 hover:text-white bg-emerald-500/5 hover:bg-emerald-600 rounded border border-emerald-500/10 hover:border-emerald-500/25 transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          Apply template to queue
                        </button>
                      </div>
                    );
                  })}
                {[...customSnippets, ...BUILTIN_BOILERPLATES].filter(bp => {
                  const query = searchQuery.toLowerCase().trim();
                  if (!query) return true;
                  return (
                    bp.name.toLowerCase().includes(query) ||
                    bp.description.toLowerCase().includes(query) ||
                    bp.targetFile.toLowerCase().includes(query) ||
                    bp.content.toLowerCase().includes(query)
                  );
                }).length === 0 && (
                  <div className="text-center py-8 text-slate-500 font-mono text-xs border border-white/5 rounded bg-black/10">
                    No snippets found matching your query.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Center: Interactive Diff Blocks constructor */}
        <div className="flex-1 flex flex-col border-r border-[#df9825]/10 overflow-hidden p-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-3 shrink-0">
            <h2 className="text-xs font-mono font-bold text-slate-200 tracking-wider uppercase flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-emerald-400" />
              Active Patch Blocks Queue
            </h2>
            
            <div className="flex gap-1">
              <button
                onClick={() => handleAddPatchBlock('add')}
                className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/35 rounded text-[10px] font-mono text-emerald-400 hover:text-white cursor-pointer"
              >
                ➕ Add Block
              </button>
              <button
                onClick={() => handleAddPatchBlock('replace')}
                className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/35 rounded text-[10px] font-mono text-emerald-400 hover:text-white cursor-pointer"
              >
                🔁 Replace Block
              </button>
              <button
                onClick={() => handleAddPatchBlock('remove')}
                className="px-2 py-1 bg-[#ef4444]/10 hover:bg-[#ef4444]/25 border border-[#ef4444]/35 rounded text-[10px] font-mono text-red-400 hover:text-white cursor-pointer"
              >
                ➖ Remove Block
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
            {filteredBlocks.length === 0 ? (
              <div className="text-center py-24 text-[11px] font-mono text-slate-500 whitespace-pre">
                No patch blocks for this file.<br />Click right header actions to build custom patches!
              </div>
            ) : (
              filteredBlocks.map((b, bidx) => (
                <div
                  key={b.id}
                  className="bg-[#1c1f26]/90 border border-white/5 hover:border-emerald-500/30 p-3.5 rounded-lg flex flex-col gap-2.5 shadow-md relative group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-emerald-400 font-bold uppercase rounded font-mono">
                        Block #{bidx + 1}: {b.action.toUpperCase()}
                      </span>
                      <input
                        type="text"
                        value={b.note}
                        onChange={(e) => handleUpdatePatchBlock(b.id, 'note', e.target.value)}
                        className="font-bold text-xs text-slate-200 bg-transparent border-b border-transparent hover:border-white/20 focus:border-emerald-500 focus:outline-none transition-all py-0.5 font-sans"
                        placeholder="Patch item description note..."
                      />
                    </div>
                    <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => handleSaveBlockAsBoilerplate(b)}
                        className="text-slate-500 hover:text-emerald-400 p-1 rounded hover:bg-black/25 transition-all cursor-pointer"
                        title="Save this block to Boilerplates library"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePatchBlock(b.id)}
                        className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-black/25 transition-all cursor-pointer"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Target Node XPath selector */}
                  <div className="space-y-1 font-mono text-[10.5px]">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 uppercase font-bold text-[9px] w-24">Sel (XPath):</span>
                      <XPathInput
                        targetPath={targetFile}
                        value={b.sel}
                        onChange={value => handleUpdatePatchBlock(b.id, 'sel', value)}
                        className="bg-black/50 border border-white/10 rounded px-2 py-1 text-slate-200 flex-1 h-7 focus:outline-none focus:border-emerald-500 text-[10px] font-mono font-bold"
                        placeholder="e.g. /wares/ware[@id='ore']"
                      />
                    </div>
                  </div>

                  {/* Position selector for 'add' action */}
                  {b.action === 'add' && (
                    <div className="space-y-1 font-mono text-[10.5px]">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 uppercase font-bold text-[9px] w-24">Position (pos):</span>
                        <select
                          value={b.pos || 'append'}
                          onChange={(e) => handleUpdatePatchBlock(b.id, 'pos', e.target.value)}
                          className="bg-black/50 border border-white/10 rounded px-2 py-1 text-slate-200 flex-1 h-7 focus:outline-none focus:border-emerald-500 text-[10px] font-mono cursor-pointer"
                        >
                          <option value="append">append (Default - add as last child)</option>
                          <option value="prepend">prepend (add as first child)</option>
                          <option value="before">before (insert before target node)</option>
                          <option value="after">after (insert after target node)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* XPath Matches and Application Errors */}
                  {(() => {
                    const val = validateBlockXPath(b);
                    const err = applyPatchesResult.errors[b.id];
                    return (
                      <div className="ml-24 text-[9.5px] font-mono flex flex-col gap-0.5 mt-0.5">
                        {val.status === 'success' && (
                          <span className="text-emerald-400 font-bold">{val.message}</span>
                        )}
                        {val.status === 'warn' && (
                          <span className="text-amber-400 font-semibold">{val.message}</span>
                        )}
                        {val.status === 'error' && (
                          <span className="text-rose-400 font-bold">{val.message}</span>
                        )}
                        {val.status === 'no_file' && (
                          <span className="text-slate-500">{val.message}</span>
                        )}
                        {err && (
                          <span className="text-rose-500 font-bold bg-rose-950/20 border border-rose-900/30 px-2 py-0.5 rounded mt-1">
                            ⚠️ Applied error: {err}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Code editor block for Add or Replace content */}
                  {b.action !== 'remove' && (
                    <div className="ml-24 space-y-1 font-mono text-[10.5px]">
                      <span className="text-slate-500 uppercase font-bold text-[8.5px] block">Patch Content:</span>
                      <textarea
                        value={b.content}
                        onChange={(e) => handleUpdatePatchBlock(b.id, 'content', e.target.value)}
                        rows={3}
                        className="w-full bg-black/60 font-mono text-[9.5px] p-2 border border-white/5 focus:border-emerald-500 rounded text-slate-300 resize-none h-14"
                        placeholder="<ware id='id' ... />"
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right side code preview area */}
        <div className="w-[450px] bg-[#0c0e14] border-l border-white/10 p-4 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3 shrink-0 font-mono text-xs gap-2">
            <div className="flex items-center gap-1 bg-[#0F1115] border border-white/10 p-0.5 rounded shrink-0">
              <button
                onClick={() => setRightPanelTab('patch')}
                className={`px-2.5 py-1 text-[9.5px] font-mono font-bold uppercase rounded ${rightPanelTab === 'patch' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-slate-200'} cursor-pointer transition-all`}
              >
                Patch XML
              </button>
              <button
                onClick={() => setRightPanelTab('preview')}
                className={`px-2.5 py-1 text-[9.5px] font-mono font-bold uppercase rounded ${rightPanelTab === 'preview' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-slate-200'} cursor-pointer transition-all`}
              >
                Applied Preview
              </button>
              <button
                onClick={() => setRightPanelTab('difftool')}
                className={`px-2.5 py-1 text-[9.5px] font-mono font-bold uppercase rounded ${rightPanelTab === 'difftool' ? 'bg-fuchsia-500 text-black' : 'text-slate-400 hover:text-slate-200'} cursor-pointer transition-all`}
              >
                Diff→Patch
              </button>
            </div>
            
            <button
              onClick={copyToClipboard}
              className="px-2.5 py-0.5 rounded bg-black/45 hover:bg-black/80 font-bold uppercase text-[9.5px] border border-white/10 text-slate-300 hover:text-emerald-400 cursor-pointer flex items-center gap-1"
            >
              Copy Diff
            </button>
          </div>

          {rightPanelTab === 'difftool' ? (
            <div className="flex-1 flex flex-col gap-2 min-h-0">
              <div className="flex flex-col gap-2 shrink-0">
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-wide text-slate-500 font-bold truncate">
                    Three-pane merge: base file {'->'} edited candidate {'->'} generated patch
                  </div>
                  <div className="flex items-center gap-2 text-[9px] font-mono uppercase mt-1">
                    <span className="rounded border border-white/10 bg-black/35 px-1.5 py-0.5 text-slate-400">
                      {dtChangedLineCount} line delta(s)
                    </span>
                    <span className={`rounded border px-1.5 py-0.5 ${dtResult ? 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300' : 'border-white/10 bg-black/35 text-slate-500'}`}>
                      {dtResult ? `${dtResult.ops.length} op(s)` : 'not synthesized'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={openNativeDiff}
                    disabled={!baseFileContent}
                    title="Open the effective vanilla file and edited candidate in Antigravity's native diff viewer"
                    className="px-2.5 py-1.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 font-bold uppercase text-[9.5px] border border-cyan-500/25 text-cyan-300 cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1"
                  >
                    <GitCompare className="w-3 h-3" /> Native Diff
                  </button>
                  <button
                    onClick={runDiffToPatch}
                    disabled={dtBusy || !baseFileContent}
                    className="px-2.5 py-1.5 rounded bg-fuchsia-500/15 hover:bg-fuchsia-500/25 font-bold uppercase text-[9.5px] border border-fuchsia-500/30 text-fuchsia-300 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {dtBusy ? 'Synthesizing...' : 'Synthesize Patch'}
                  </button>
                  <button
                    onClick={() => { setDtEdited(baseFileContent || ''); setDtResult(null); setDtError(null); }}
                    disabled={!baseFileContent}
                    className="px-2.5 py-1.5 rounded bg-black/45 hover:bg-black/80 font-bold uppercase text-[9.5px] border border-white/10 text-slate-300 cursor-pointer transition-all disabled:opacity-50"
                  >
                    Reset
                  </button>
                  <button
                    onClick={adoptSynthesizedOps}
                    disabled={!dtResult?.ops.length}
                    className="px-2.5 py-1.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 font-bold uppercase text-[9.5px] border border-emerald-500/30 text-emerald-300 cursor-pointer transition-all disabled:opacity-50"
                  >
                    Add to Workspace
                  </button>
                </div>
              </div>
              <div className="grid grid-rows-3 gap-2 flex-1 min-h-0">
                <div className="min-w-0 flex flex-col rounded-lg border border-white/10 bg-black/45 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2 py-1.5 font-mono text-[9px] uppercase">
                    <span className="font-bold text-slate-400">Base XML</span>
                    <span className="truncate text-slate-600" title={targetFile}>{targetFile}</span>
                  </div>
                  <pre className="flex-1 min-h-0 overflow-auto custom-scrollbar p-2 font-mono text-[9.5px] leading-relaxed text-slate-400 whitespace-pre-wrap break-all select-text">
                    {baseFileLoading ? 'Loading vanilla content...' : (baseFileError || dtBasePreview || 'No vanilla content loaded.')}
                  </pre>
                </div>

                <div className="min-w-0 flex flex-col rounded-lg border border-fuchsia-500/25 bg-black/45 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 border-b border-fuchsia-500/20 px-2 py-1.5 font-mono text-[9px] uppercase">
                    <span className="font-bold text-fuchsia-300">Edited XML</span>
                    <span className="text-slate-600">candidate</span>
                  </div>
                  <textarea
                    data-testid="diff-patch-edited-xml"
                    value={dtEdited}
                    onChange={e => { setDtEdited(e.target.value); setDtResult(null); setDtError(null); }}
                    spellCheck={false}
                    disabled={!baseFileContent}
                    placeholder={baseFileLoading ? 'Loading vanilla content...' : (baseFileError || 'No vanilla content available for this target.')}
                    className="flex-1 min-h-0 bg-transparent p-2 font-mono text-[9.5px] leading-relaxed text-slate-200 resize-none focus:outline-none custom-scrollbar"
                  />
                </div>

                <div className="min-w-0 flex flex-col rounded-lg border border-emerald-500/20 bg-black/45 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 border-b border-emerald-500/15 px-2 py-1.5 font-mono text-[9px] uppercase">
                    <span className="font-bold text-emerald-300">Patch XML</span>
                    <span className="text-slate-600">generated</span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-auto custom-scrollbar p-2">
                    {dtError ? (
                      <div className="text-red-300 text-[10px] bg-red-500/5 border border-red-500/20 rounded p-2 font-sans">{dtError}</div>
                    ) : dtResult ? (
                      <div className="space-y-1.5">
                        {(dtResult.warnings || []).map((w, i) => (
                          <div key={i} className="text-amber-300 text-[9px] font-sans leading-snug">{w}</div>
                        ))}
                        <pre className="whitespace-pre-wrap break-all font-mono text-[9.5px] leading-relaxed text-slate-300 select-text">{dtPatchPreview}</pre>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-center text-[10px] font-mono text-slate-600 px-4">
                        Run synthesis to generate the minimal X4 diff patch for the edited candidate.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : rightPanelTab === 'patch' ? (
            <div className="flex-1 bg-black/50 rounded-lg p-3 font-mono text-[10.5px] text-slate-400 overflow-y-auto relative custom-scrollbar border border-white/5 leading-normal select-text selection:bg-emerald-500/25">
              <pre className="whitespace-pre">
                {compileDiffDocument()}
              </pre>
            </div>
          ) : (
            <div className="flex-1 bg-black/50 rounded-lg p-3 font-mono text-[10px] overflow-y-auto relative custom-scrollbar border border-white/5 leading-relaxed select-text flex flex-col gap-0.5">
              {baseFileLoading ? (
                <div className="text-center py-20 text-slate-500 font-mono text-xs">Loading base game XML...</div>
              ) : baseFileError ? (
                <div className="text-center py-16 text-slate-500 text-[10.5px] whitespace-pre-line px-4 font-mono leading-relaxed">
                  {baseFileError || `Effective canonical file '${targetFile}' is unavailable.`}
                </div>
              ) : (
                <div className="flex flex-col font-mono text-[9.5px]">
                  <div className="text-[9px] uppercase tracking-wide text-slate-500 border-b border-white/5 pb-1 mb-1 font-bold">
                    Unified Diff: {targetFile}
                  </div>
                  {diffSnippet.map((line, idx) => {
                    let lineClass = 'text-slate-400';
                    let prefix = ' ';
                    if (line.type === 'addition') {
                      lineClass = 'bg-emerald-950/45 text-emerald-300 border-l-2 border-emerald-500 px-1';
                      prefix = '+';
                    } else if (line.type === 'deletion') {
                      lineClass = 'bg-rose-950/45 text-rose-300 border-l-2 border-red-500 px-1';
                      prefix = '-';
                    } else if (line.label === '...') {
                      lineClass = 'text-slate-600 bg-slate-900/20 px-1 border-y border-white/5 py-0.5 my-0.5';
                      prefix = '';
                    }
                    return (
                      <div key={idx} className={`flex items-start font-mono transition-colors ${lineClass}`}>
                        <span className="w-10 select-none text-[8px] text-slate-600 mr-2 border-r border-white/5 pr-1.5 text-right font-normal shrink-0">
                          {line.label}
                        </span>
                        <span className="select-none font-bold text-slate-600 mr-1 shrink-0 w-3 text-center">{prefix}</span>
                        <span className="whitespace-pre flex-1 overflow-x-auto break-all select-text">{line.value}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
