/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Trash,
  Plus,
  Compass,
  Settings,
  Sparkles,
  Cpu,
  Bot,
  ExternalLink
} from 'lucide-react';
import { ModWorkspace } from '../types';
import { promptDialog, toast } from '../lib/uiDialogs';
import { openOrMaterializeInNativeEditor } from '../lib/nativeEditor';

interface AIScriptEditorProps {
  workspace: ModWorkspace;
  setWorkspace: React.Dispatch<React.SetStateAction<ModWorkspace>>;
}

export interface AIParam {
  name: string;
  type: 'object' | 'number' | 'boolean' | 'ware' | 'faction';
  defaultValue: string;
  comment: string;
}

export interface AIAction {
  id: string;
  command: 'move_to' | 'flee' | 'shoot' | 'dock_at' | 'wait' | 'find_objects' | 'custom_xml';
  label: string;
  properties: Record<string, any>;
}

export interface AIBehaviorScript {
  id: string;
  name: string;
  description: string;
  command: string;
  attentionLevel: 'high' | 'low';
  params: AIParam[];
  interrupts: { id: string; event: string; action: string }[];
  actions: AIAction[];
}

const defaultAIScripts: AIBehaviorScript[] = [
  {
    id: 'ai_hunter_escort',
    name: 'hunter.escort.behavior',
    description: 'Advanced aggressive patrol behavior that guards friendly transports and engages target intruders.',
    command: 'command.escort',
    attentionLevel: 'high' as const,
    params: [
      { name: 'target', type: 'object', defaultValue: 'this.ship.commander', comment: 'Leader ship to closely escort' },
      { name: 'flee_shield_percent', type: 'number', defaultValue: '25', comment: 'Shield threshold below which ship flees' },
      { name: 'aggression', type: 'number', defaultValue: '0.8', comment: 'Fighter engagement speed scaler' }
    ] as AIParam[],
    interrupts: [
      { id: 'int_1', event: 'event.object_attacked', action: 'flee' },
      { id: 'int_2', event: 'event.object_shield_low', action: 'dock_at_safety' }
    ],
    actions: [
      { id: 'act_1', command: 'move_to', label: 'Match formation distance', properties: { destination: '$target', speed: '90', precision: '100m' } },
      { id: 'act_2', command: 'find_objects', label: 'Scan for sector hostilities', properties: { class: 'ship', faction: 'faction.xenon', range: '15km' } },
      { id: 'act_3', command: 'shoot', label: 'Interdict intruders', properties: { target: '$enemy', weapon: 'primary' } },
      { id: 'act_4', command: 'wait', label: 'Resume station keeping cycle', properties: { min: '5s', max: '15s' } }
    ] as AIAction[]
  },
  {
    id: 'ai_miner_trade',
    name: 'miner.auto.harvest',
    description: 'Finds ore deposits in the faction sectors, mines asteroid nodes, and docks to trade with higher yields.',
    command: 'command.mine',
    attentionLevel: 'low' as const,
    params: [
      { name: 'resourceware', type: 'ware', defaultValue: 'ware.ore', comment: 'Mining mineral focus material' },
      { name: 'max_gate_range', type: 'number', defaultValue: '3', comment: 'Safety jump radius' }
    ] as AIParam[],
    interrupts: [
      { id: 'int_3', event: 'event.object_hull_damaged', action: 'flee' }
    ],
    actions: [
      { id: 'act_5', command: 'find_objects', label: 'Detect rich asteroid nodes', properties: { class: 'asteroid', resource: '$resourceware', range: '50km' } },
      { id: 'act_6', command: 'move_to', label: 'Approach resources cluster', properties: { destination: '$asteroid', speed: '50', precision: '10m' } },
      { id: 'act_7', command: 'wait', label: 'Initiate laser excavation beams', properties: { exact: '30s' } },
      { id: 'act_8', command: 'dock_at', label: 'Unload cargo at refinery station', properties: { station: 'faction.player.hq', trade: 'true' } }
    ] as AIAction[]
  }
];

export default function AIScriptEditor({ workspace, setWorkspace }: AIScriptEditorProps) {
  const scripts = useMemo(() => workspace.aiScripts || [], [workspace.aiScripts]);

  // Setup selected state, prioritizing first custom script, or null
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(() => {
    if (scripts.length > 0) {
      return scripts[0].id;
    }
    return null;
  });

  const isPreset = selectedScriptId !== null && (selectedScriptId === 'ai_hunter_escort' || selectedScriptId === 'ai_miner_trade');

  const activeScript = selectedScriptId
    ? (isPreset
        ? defaultAIScripts.find(s => s.id === selectedScriptId)
        : scripts.find(s => s.id === selectedScriptId))
    : null;

  // Keep selected ID valid if the activeScript is deleted or invalidated
  useEffect(() => {
    if (selectedScriptId) {
      const exists = isPreset
        ? defaultAIScripts.some(s => s.id === selectedScriptId)
        : scripts.some(s => s.id === selectedScriptId);
      if (!exists) {
        if (scripts.length > 0) {
          setSelectedScriptId(scripts[0].id);
        } else {
          setSelectedScriptId(null);
        }
      }
    }
  }, [scripts, selectedScriptId, isPreset]);

  const saveScriptsState = (newScripts: any[]) => {
    setWorkspace(prev => ({
      ...prev,
      aiScripts: newScripts
    }));
  };

  const handleUpdateScriptProp = (key: string, value: any) => {
    if (isPreset) return;
    const updated = scripts.map(s => {
      if (s.id === selectedScriptId) {
        return { ...s, [key]: value };
      }
      return s;
    });
    saveScriptsState(updated);
  };

  // AIScript Action manipulation
  const handleAddAction = (command: AIAction['command']) => {
    if (isPreset) return;
    let defaults: Record<string, any> = {};
    let label = '';
    switch (command) {
      case 'move_to':
        defaults = { destination: '$target', speed: '100', precision: '50m' };
        label = 'Flight path transit task';
        break;
      case 'flee':
        defaults = { method: 'boost', duration: '20s' };
        label = 'Emergency retreat maneuver';
        break;
      case 'shoot':
        defaults = { target: '$enemy', weapon: 'all_weapons' };
        label = 'Engage hostile elements';
        break;
      case 'dock_at':
        defaults = { station: '$nearest_station', trade: 'false' };
        label = 'Docking transit alignment';
        break;
      case 'wait':
        defaults = { exact: '10s' };
        label = 'Hold alignment position';
        break;
      case 'find_objects':
        defaults = { class: 'ship', range: '10km' };
        label = 'Sensors scanner survey';
        break;
      case 'custom_xml':
        defaults = { rawXml: '<!-- Enter custom Egosoft scripting nodes here -->\n        <write_to_logbook text="\'AI script custom output...\'" />' };
        label = 'Generic instruction insert';
        break;
    }

    const nAct: AIAction = {
      id: `ai_act_${Date.now()}`,
      command,
      label,
      properties: defaults
    };

    const updated = scripts.map(s => {
      if (s.id === selectedScriptId) {
        return { ...s, actions: [...s.actions, nAct] };
      }
      return s;
    });
    saveScriptsState(updated);
  };

  const handleUpdateActionProp = (actionId: string, propKey: string, value: any) => {
    if (isPreset) return;
    const updated = scripts.map(s => {
      if (s.id === selectedScriptId) {
        return {
          ...s,
          actions: s.actions.map(act => 
            act.id === actionId 
              ? { ...act, properties: { ...act.properties, [propKey]: value } }
              : act
          )
        };
      }
      return s;
    });
    saveScriptsState(updated);
  };

  const handleUpdateActionLabel = (actionId: string, label: string) => {
    if (isPreset) return;
    const updated = scripts.map(s => {
      if (s.id === selectedScriptId) {
        return {
          ...s,
          actions: s.actions.map(act => 
            act.id === actionId ? { ...act, label } : act
          )
        };
      }
      return s;
    });
    saveScriptsState(updated);
  };

  const handleDeleteAction = (actionId: string) => {
    if (isPreset) return;
    const updated = scripts.map(s => {
      if (s.id === selectedScriptId) {
        return {
          ...s,
          actions: s.actions.filter(act => act.id !== actionId)
        };
      }
      return s;
    });
    saveScriptsState(updated);
  };

  const handleCreateNewScript = async () => {
    const name = await promptDialog("Enter Name for new Behavior AIScript (e.g., trader.escort.patrol):", "trader.auto.haul");
    if (!name) return;
    
    const nScript = {
      id: `ai_script_${Date.now()}`,
      name,
      description: 'Custom NPC behavior script for pilot task management.',
      command: 'command.trade',
      attentionLevel: 'high' as const,
      params: [
        { name: 'range', type: 'number' as const, defaultValue: '5', comment: 'Maximum gate jump range' }
      ],
      interrupts: [],
      actions: [
        { id: 'init_act_1', command: 'find_objects' as const, label: 'Search for high margin transactions', properties: { class: 'station', range: '5' } }
      ]
    };
    
    saveScriptsState([...scripts, nScript]);
    setSelectedScriptId(nScript.id);
  };

  const handleInstantiateTemplate = (preset: typeof defaultAIScripts[0]) => {
    // Check if script name already exists in the workspace
    const exists = scripts.some(s => s.name === preset.name);
    const newName = exists ? `${preset.name.replace('.behavior', '')}_custom.behavior` : preset.name;
    
    const nScript = {
      ...preset,
      id: `ai_script_${Date.now()}`,
      name: newName,
    };
    
    saveScriptsState([...scripts, nScript]);
    setSelectedScriptId(nScript.id);
  };

  const handleDeleteScript = () => {
    if (isPreset) {
      alert("Cannot delete standard reference presets. They are built-in templates.");
      return;
    }
    const filtered = scripts.filter(s => s.id !== selectedScriptId);
    saveScriptsState(filtered);
    if (filtered.length > 0) {
      setSelectedScriptId(filtered[0].id);
    } else {
      setSelectedScriptId(null);
    }
  };

  return (
    <div id="ai_script_editor_view" className="flex-1 bg-[#0a0c10] flex flex-col h-full overflow-hidden text-slate-300">
      {/* Simulation HUD Controls bar */}
      <div className="bg-[#161920]/90 border-b border-white/10 p-3 flex items-center justify-between font-mono text-xs">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-amber-500 animate-pulse" />
          <span className="font-semibold text-slate-200 uppercase tracking-tight">AIScripts Behavior-Tree Engine</span>
        </div>
        
        {/* Scripts selectors */}
        <div className="flex items-center gap-2">
          {activeScript && !isPreset && (
            <button
              type="button"
              onClick={async () => {
                const result = await openOrMaterializeInNativeEditor(workspace, `aiscripts/${activeScript.name}.xml`);
                toast(result.message, result.ok ? 'success' : 'error');
              }}
              className="px-2.5 py-1 rounded bg-cyan-500/10 border border-cyan-500/25 hover:bg-cyan-500/20 text-cyan-300 font-bold uppercase text-[10px] cursor-pointer transition-all flex items-center gap-1"
              title={`Open aiscripts/${activeScript.name}.xml as a real Antigravity file tab`}
            >
              <ExternalLink className="w-3 h-3" />
              Open in Antigravity
            </button>
          )}
          <button
            onClick={handleCreateNewScript}
            className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/20 text-amber-400 font-bold uppercase text-[10px] cursor-pointer transition-all flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            New Script
          </button>
          
          <div className="flex items-center gap-1.5 bg-black/45 border border-white/10 p-0.5 rounded-md">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider px-1">Selected:</span>
            <select
              value={selectedScriptId || ''}
              onChange={(e) => setSelectedScriptId(e.target.value || null)}
              className="bg-[#0F1115] border border-transparent p-1 px-2 rounded text-[10px] font-mono text-slate-300 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {scripts.length > 0 && (
                <optgroup label="Active Mod Scripts" className="text-slate-400 text-[10px]">
                  {scripts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Reference Templates" className="text-slate-500 text-[10px]">
                {defaultAIScripts.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} (Template)</option>
                ))}
              </optgroup>
            </select>
            {!isPreset && (
              <button
                onClick={handleDeleteScript}
                className="p-1 text-red-400 hover:bg-red-500/10 rounded transition-all cursor-pointer"
                title="Delete active behavior script"
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side Hierarchy Tree */}
        <div className="w-64 border-r border-white/10 flex flex-col bg-[#0e1017]/80 shrink-0 overflow-hidden font-mono text-[11px]">
          <div className="p-3 border-b border-white/10 shrink-0 flex items-center justify-between bg-black/15 select-none text-[10px]">
            <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <Bot className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              behavior scripts
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-4 scrollbar-thin">
            {/* Active Mod Scripts list */}
            <div className="space-y-1">
              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider px-2 py-1 select-none flex items-center justify-between">
                <span>Active Mod Scripts</span>
                <span className="text-[8px] bg-slate-800 text-slate-400 px-1 rounded-sm">{scripts.length} files</span>
              </div>
              {scripts.length === 0 ? (
                <div className="text-[9.5px]/relaxed text-slate-500 italic px-2 py-3 border border-dashed border-white/5 rounded-md text-center m-1 select-none">
                  No active custom behaviors.<br/>
                  <span className="text-[8.5px] not-italic text-slate-600 block mt-1">Instantiate a template below, or click "+ New Script"</span>
                </div>
              ) : (
                scripts.map((s) => {
                  const isSelected = selectedScriptId === s.id;
                  return (
                    <div key={s.id} className="space-y-1">
                      <button
                        onClick={() => setSelectedScriptId(s.id)}
                        className={`w-full text-left py-1.5 px-2 rounded font-mono transition-all flex items-center justify-between cursor-pointer select-none group/btn ${
                          isSelected
                            ? 'bg-amber-500/15 text-amber-400 font-bold border-l-2 border-amber-500 pl-1.5'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="truncate">📜 {s.name || 'unnamed'}</span>
                        {!isSelected && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const filtered = scripts.filter(x => x.id !== s.id);
                              saveScriptsState(filtered);
                              if (filtered.length > 0) {
                                setSelectedScriptId(filtered[0].id);
                              } else {
                                setSelectedScriptId(null);
                              }
                            }}
                            className="hidden group-hover/btn:block p-1 text-red-500 hover:bg-red-500/10 rounded transition-all cursor-pointer"
                            title="Delete Behavior Script"
                          >
                            <Trash className="w-3 h-3" />
                          </button>
                        )}
                      </button>
                      {/* Param hierarchy when selected */}
                      {isSelected && s.params && s.params.length > 0 && (
                        <div className="pl-3.5 border-l border-amber-500/25 space-y-1.5 pb-2 text-[9.5px]">
                          <div className="space-y-0.5">
                            <span className="text-slate-600 block uppercase font-bold text-[8px] tracking-wide select-none">📋 params</span>
                            <div className="pl-2 space-y-0.5 border-l border-white/[0.02]">
                              {s.params.map((p: any) => (
                                <div key={p.name} className="text-slate-400 font-medium truncate flex items-center gap-1">
                                  <span className="text-amber-500">$</span>
                                  <span className="truncate">{p.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Split border line */}
            <div className="border-t border-white/5 my-3"></div>

            {/* Built-in Reference Templates list */}
            <div className="space-y-1">
              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider px-2 py-1 select-none flex items-center justify-between">
                <span>Reference Templates</span>
                <span className="text-[8px] bg-slate-800 text-slate-400 px-1 rounded-sm">{defaultAIScripts.length} presets</span>
              </div>
              {defaultAIScripts.map((s) => {
                const isSelected = selectedScriptId === s.id;
                return (
                  <div key={s.id} className="space-y-1">
                    <button
                      onClick={() => setSelectedScriptId(s.id)}
                      className={`w-full text-left py-1.5 px-2 rounded font-mono transition-all flex items-center justify-between cursor-pointer select-none group/preset ${
                        isSelected
                          ? 'bg-amber-500/10 text-amber-500/90 font-bold border-l border-amber-500/40 pl-1.5'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1 text-[10.5px]">
                        <Bot className="w-3.5 h-3.5 opacity-60" />
                        {s.name}
                      </span>
                      {/* span, not button: a <button> may not nest inside a <button> (invalid HTML / React hydration warning) */}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInstantiateTemplate(s);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleInstantiateTemplate(s); } }}
                        className="p-1 text-amber-400 opacity-0 group-hover/preset:opacity-100 hover:bg-amber-500/10 rounded transition-all cursor-pointer text-[9px] font-bold inline-flex"
                        title="Instantiate template into mod project"
                      >
                        <Plus className="w-3 h-3" />
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {!activeScript ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-black/5 text-center font-mono select-none">
            <Bot className="w-12 h-12 text-slate-700 mb-3 stroke-[1.5]" />
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">NO ACTIVE AI SCRIPT</h3>
            <p className="text-[10px] text-slate-500 max-w-sm mt-1 leading-relaxed font-sans">
              Select an AI behavior template from the sidebar hierarchy or click "New Script" to create one!
            </p>
          </div>
        ) : (
          <>
            {/* Left pane: parameters & description editor */}
            <div className="w-72 border-r border-[#1a1c23] p-4 space-y-4 overflow-y-auto bg-[#0a0c10]/35 flex-shrink-0">
              {isPreset && (
                <div id="ai-preset-warning-banner" className="bg-amber-500/10 border border-amber-500/25 p-3 rounded-lg text-[10.5px]/relaxed text-amber-400 font-mono">
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide mb-1 text-amber-500">
                    <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                    <span>Template Reference</span>
                  </div>
                  This template is read-only. Click the button below to clone/instantiate it as an active script of your mod.
                  <button
                    onClick={() => handleInstantiateTemplate(activeScript)}
                    className="w-full mt-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold uppercase rounded text-[9.5px] cursor-pointer transition-all flex items-center justify-center gap-1 shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Instantiate to Mod
                  </button>
                </div>
              )}

              <div>
                <h3 className="text-xs font-mono font-bold text-amber-400 border-b border-white/10 pb-1.5 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Settings className="w-3.5 h-3.5" />
                  Behavior Metadata
                </h3>
                <div className="space-y-3 bg-black/20 p-3 rounded border border-white/5 font-mono text-[11px]">
                  <div>
                    <label className="text-slate-400 block mb-1 uppercase text-[10px] tracking-wider font-semibold">Script ID / Name</label>
                    <input
                      type="text"
                      disabled={isPreset}
                      value={activeScript.name}
                      onChange={e => handleUpdateScriptProp('name', e.target.value)}
                      className="w-full p-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 uppercase text-[10px] tracking-wider font-semibold">Pilot Ship Command Tag</label>
                    <select
                      value={activeScript.command}
                      disabled={isPreset}
                      onChange={e => handleUpdateScriptProp('command', e.target.value)}
                      className="w-full p-2 rounded bg-[#0F1115] border border-white/10 text-white focus:outline-none focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <option value="command.move">command.move (Standard Transit)</option>
                      <option value="command.escort">command.escort (Fighter Defend/Escort)</option>
                      <option value="command.mine">command.mine (Asteroid Mineral Excavation)</option>
                      <option value="command.trade">command.trade (Ware Logistic Haulage)</option>
                      <option value="command.patrol">command.patrol (System Sector Recon)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 uppercase text-[10px] tracking-wider font-semibold">Ship View Attention level</label>
                    <div className="grid grid-cols-2 gap-1.5 mt-1 text-[10px]">
                      <button
                        onClick={() => !isPreset && handleUpdateScriptProp('attentionLevel', 'high')}
                        className={`py-1 rounded font-bold uppercase border transition-all cursor-pointer ${
                          activeScript.attentionLevel === 'high' 
                            ? 'border-amber-500 bg-amber-500/15 text-amber-400' 
                            : 'border-white/5 bg-transparent text-slate-400 hover:text-slate-300'
                        } ${isPreset ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        High Attention (In-Sector)
                      </button>
                      <button
                        onClick={() => !isPreset && handleUpdateScriptProp('attentionLevel', 'low')}
                        className={`py-1 rounded font-bold uppercase border transition-all cursor-pointer ${
                          activeScript.attentionLevel === 'low' 
                            ? 'border-amber-500 bg-amber-500/15 text-amber-400' 
                            : 'border-white/5 bg-transparent text-slate-400 hover:text-slate-300'
                        } ${isPreset ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        Low Attention (OOS)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 uppercase text-[10px] tracking-wider font-semibold">Behavior Description</label>
                    <textarea
                      disabled={isPreset}
                      value={activeScript.description}
                      onChange={e => handleUpdateScriptProp('description', e.target.value)}
                      className="w-full p-2 h-14 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors resize-none font-sans"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-mono font-bold text-amber-400 border-b border-white/10 pb-1.5 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Pilot Params & Variables
                </h3>
                <div className="space-y-3 bg-black/20 p-3 rounded border border-white/5 font-mono text-[11px]">
                  {activeScript.params.map((param, pid) => (
                    <div key={pid} className="p-2 border border-white/5 bg-black/30 rounded-md space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-amber-500 font-bold">${param.name}</span>
                        <span className="text-slate-500 text-[9px] uppercase border border-slate-700 px-1 rounded">{param.type}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 leading-snug">
                        <span className="text-slate-500">Default:</span> {param.defaultValue}
                      </div>
                      <div className="text-[9.5px] italic text-slate-500">
                        "{param.comment}"
                      </div>
                    </div>
                  ))}
                  <div className="text-[10px] text-slate-500 italic text-center p-2 border border-dashed border-white/10 rounded font-sans leading-relaxed">
                    Params enable the game GUI to configure NPC pilots easily. (Use "Add Script Target Configs").
                  </div>
                </div>
              </div>
            </div>

            {/* Center pane: Visual Task Pipeline / Action queue */}
            <div className="flex-1 p-4 flex flex-col border-r border-white/10 overflow-hidden bg-[#0c0e14]/50">
              <h3 className="text-xs font-mono font-bold text-amber-400 border-b border-white/10 pb-1.5 uppercase tracking-wider mb-2 shrink-0 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 animate-spin-slow" />
                  Behavior Task Action Pipeline
                </span>
                <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 rounded font-bold uppercase font-mono">
                  Loop Sequential
                </span>
              </h3>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1.5 py-1">
                {activeScript.actions.length === 0 ? (
                  <div className="text-center py-20 text-[11px] font-mono text-slate-500 whitespace-pre">
                    No active actions.<br />Click right buttons to inject tasks!
                  </div>
                ) : (
                  activeScript.actions.map((act, index) => (
                    <div
                      key={act.id}
                      className="bg-[#1c1f26]/85 border border-white/5 hover:border-amber-500/40 p-3 rounded-lg flex flex-col space-y-2 transition-all shadow-md group relative"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-mono text-[9px] font-bold text-amber-400 shrink-0">
                            {index + 1}
                          </span>
                          <div>
                            {/* Interactive edit title */}
                            <input
                              type="text"
                              disabled={isPreset}
                              value={act.label}
                              onChange={(e) => handleUpdateActionLabel(act.id, e.target.value)}
                              className="font-semibold text-slate-200 text-xs bg-transparent border-b border-transparent hover:border-white/20 focus:border-amber-500 focus:outline-none disabled:opacity-75 disabled:cursor-default transition-all py-0.5"
                            />
                            <div className="text-[9px] font-mono text-slate-500 uppercase mt-0.5 font-bold tracking-wider">
                              Egosoft Tag: &lt;{act.command === 'custom_xml' ? 'custom' : act.command}&gt;
                            </div>
                          </div>
                        </div>

                        {!isPreset && (
                          <button
                            onClick={() => handleDeleteAction(act.id)}
                            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-black/35 opacity-40 group-hover:opacity-100 transition-all cursor-pointer"
                            title="Remove AI task node"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Node inputs fields */}
                      <div className="ml-6 grid grid-cols-1 gap-1.5 bg-black/25 p-2 rounded border border-white/5 font-mono text-[10px]">
                        {act.command === 'move_to' && (
                          <>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-400 capitalize">Destination:</span>
                              <input
                                type="text"
                                disabled={isPreset}
                                value={act.properties.destination || ''}
                                onChange={(e) => handleUpdateActionProp(act.id, 'destination', e.target.value)}
                                className="bg-black/45 border border-white/10 rounded px-1.5 py-0.5 text-amber-400 text-right font-bold w-1/2 disabled:opacity-50"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-400 capitalize">Throttle Speed (%):</span>
                              <input
                                type="text"
                                disabled={isPreset}
                                value={act.properties.speed || ''}
                                onChange={(e) => handleUpdateActionProp(act.id, 'speed', e.target.value)}
                                className="bg-black/45 border border-white/10 rounded px-1.5 py-0.5 text-white text-right w-1/3 disabled:opacity-50"
                              />
                            </div>
                          </>
                        )}

                        {act.command === 'wait' && (
                          <>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-400 capitalize">Duration exact:</span>
                              <input
                                type="text"
                                disabled={isPreset}
                                value={act.properties.exact || ''}
                                onChange={(e) => handleUpdateActionProp(act.id, 'exact', e.target.value)}
                                className="bg-black/45 border border-white/10 rounded px-1.5 py-0.5 text-emerald-400 text-right w-1/3 disabled:opacity-50"
                                placeholder="e.g. 10s"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-1 text-[9px] text-slate-500 italic leading-none py-0.5">
                              <span>OR Randomize limits:</span>
                              <div className="flex gap-1 justify-end w-1/2 font-sans">
                                <input
                                  type="text"
                                  disabled={isPreset}
                                  value={act.properties.min || ''}
                                  onChange={(e) => handleUpdateActionProp(act.id, 'min', e.target.value)}
                                  className="bg-black/45 border border-white/10 rounded w-10 text-center text-white text-[8px] font-mono disabled:opacity-50"
                                  placeholder="min"
                                />
                                <span className="text-slate-600">-</span>
                                <input
                                  type="text"
                                  disabled={isPreset}
                                  value={act.properties.max || ''}
                                  onChange={(e) => handleUpdateActionProp(act.id, 'max', e.target.value)}
                                  className="bg-black/45 border border-white/10 rounded w-10 text-center text-white text-[8px] font-mono disabled:opacity-50"
                                  placeholder="max"
                                />
                              </div>
                            </div>
                          </>
                        )}

                        {act.command === 'shoot' && (
                          <>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-400 capitalize">Target Combatant:</span>
                              <input
                                type="text"
                                disabled={isPreset}
                                value={act.properties.target || ''}
                                onChange={(e) => handleUpdateActionProp(act.id, 'target', e.target.value)}
                                className="bg-black/45 border border-white/10 rounded px-1.5 py-0.5 text-red-400 text-right font-bold w-1/2 disabled:opacity-50"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-400 capitalize">Weapons Array:</span>
                              <select
                                value={act.properties.weapon || 'all_weapons'}
                                disabled={isPreset}
                                onChange={(e) => handleUpdateActionProp(act.id, 'weapon', e.target.value)}
                                className="bg-black/45 border border-white/10 rounded text-[9.5px] cursor-pointer text-white max-w-1/2 focus:outline-none disabled:opacity-50"
                              >
                                <option value="all_weapons">All Guns & Turrets</option>
                                <option value="primary">Primary Flight Lasers</option>
                                <option value="turrets">Flak/Missile Turrets Only</option>
                              </select>
                            </div>
                          </>
                        )}

                        {act.command === 'find_objects' && (
                          <>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-400 capitalize">Search Class:</span>
                              <select
                                value={act.properties.class || 'ship'}
                                disabled={isPreset}
                                onChange={(e) => handleUpdateActionProp(act.id, 'class', e.target.value)}
                                className="bg-black/45 border border-white/10 rounded text-amber-400 text-right text-[10px] pr-1 focus:outline-none disabled:opacity-50"
                              >
                                <option value="ship">Ships & Squadrons</option>
                                <option value="asteroid">Mining Asteroids</option>
                                <option value="station">Factories & Trade hqs</option>
                                <option value="wreck">Salvageable Ship Wrecks</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-400 capitalize">Scan Distance range:</span>
                              <input
                                type="text"
                                disabled={isPreset}
                                value={act.properties.range || ''}
                                onChange={(e) => handleUpdateActionProp(act.id, 'range', e.target.value)}
                                className="bg-black/45 border border-white/10 rounded px-1.5 py-0.5 text-white text-right w-1/3 disabled:opacity-50"
                              />
                            </div>
                          </>
                        )}

                        {act.command === 'dock_at' && (
                          <>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-slate-400 capitalize">Dock Object:</span>
                              <input
                                type="text"
                                disabled={isPreset}
                                value={act.properties.station || ''}
                                onChange={(e) => handleUpdateActionProp(act.id, 'station', e.target.value)}
                                className="bg-black/45 border border-white/10 rounded px-1.5 py-0.5 text-cyan-400 text-right w-1/2 disabled:opacity-50"
                              />
                            </div>
                          </>
                        )}

                        {act.command === 'custom_xml' && (
                          <textarea
                            disabled={isPreset}
                            value={act.properties.rawXml || ''}
                            onChange={(e) => handleUpdateActionProp(act.id, 'rawXml', e.target.value)}
                            rows={3}
                            className="w-full bg-black/60 font-mono text-[9.5px] p-1.5 border border-white/10 focus:border-amber-500 rounded text-slate-300 resize-none disabled:opacity-50"
                          />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Action additions toolbox */}
              <div className={`mt-2 shrink-0 py-2 border-t border-white/10 ${isPreset ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}>
                <label className="text-slate-400 block mb-1.5 uppercase font-bold font-mono text-[9.5px] tracking-wider select-none">
                  ➕ Add AI behavior instruction node
                </label>
                <div className="grid grid-cols-3 gap-1 text-[9.5px] font-mono">
                  <button
                    onClick={() => !isPreset && handleAddAction('move_to')}
                    className="py-1 px-1.5 text-center truncate bg-amber-500/10 border border-amber-500/20 hover:border-amber-500 hover:text-white rounded transition-all cursor-pointer select-none"
                  >
                    航 Fly (Move To)
                  </button>
                  <button
                    onClick={() => !isPreset && handleAddAction('wait')}
                    className="py-1 px-1.5 text-center truncate bg-amber-500/10 border border-amber-500/20 hover:border-amber-500 hover:text-white rounded transition-all cursor-pointer select-none"
                  >
                    ⏱ Wait (Delay)
                  </button>
                  <button
                    onClick={() => !isPreset && handleAddAction('shoot')}
                    className="py-1 px-1.5 text-center truncate bg-amber-500/10 border border-amber-500/20 hover:border-amber-500 hover:text-white rounded transition-all cursor-pointer select-none"
                  >
                    ⚔ Shoot (Offensive)
                  </button>
                  <button
                    onClick={() => !isPreset && handleAddAction('find_objects')}
                    className="py-1 px-1.5 text-center truncate bg-amber-500/10 border border-amber-500/20 hover:border-amber-500 hover:text-white rounded transition-all cursor-pointer select-none"
                  >
                    🛰 Search Objects
                  </button>
                  <button
                    onClick={() => !isPreset && handleAddAction('dock_at')}
                    className="py-1 px-1.5 text-center truncate bg-amber-500/10 border border-amber-500/20 hover:border-amber-500 hover:text-white rounded transition-all cursor-pointer select-none"
                  >
                    ⛽ Dock At
                  </button>
                  <button
                    onClick={() => !isPreset && handleAddAction('custom_xml')}
                    className="py-1 px-1.5 text-center truncate bg-amber-500/10 border border-amber-500/20 hover:border-amber-500 hover:text-white rounded transition-all cursor-pointer select-none"
                  >
                    ⚒ Custom Tag
                  </button>
                </div>
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}
