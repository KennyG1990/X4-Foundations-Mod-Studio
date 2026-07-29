/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { schemaElementToTemplate, type SchemaElement } from './lib/schemaTypes';
import { isContainerTag } from './lib/portSemantics';
import type { IntegrationContract } from './lib/contractGlue';

// Node port representation
export interface Port {
  id: string;
  name: string;
  type: 'flow' | 'data' | 'parent' | 'child';
  dataType?: string;
}

// Property schema definition for custom GUI parameter inputs
export interface PropertySchema {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'coordinates' | 'textarea' | 'reference';
  options?: string[];
  placeholder?: string;
  description?: string;
  required?: boolean;
  /** For type:'reference' — which live object-index kind to search (ship/station/ware/faction/sound/job). */
  refKind?: 'ship' | 'station' | 'ware' | 'faction' | 'sound' | 'job' | 'macro';
}

// Visual Node representation in the blueprint editor
export interface MDNode {
  id: string;
  type: 'cue' | 'event' | 'condition' | 'action' | 'variable' | 'comment';
  label: string;
  xmlTag: string;
  x: number;
  y: number;
  properties: Record<string, any>;
  propertiesSchema: PropertySchema[];
  inputs: Port[];
  outputs: Port[];
  comment?: string;
  width?: number;
  height?: number;
  color?: string;
  includeInBuild?: boolean;
  /** Exact imported-source identity used by guarded node editing. Omitted for canvas-created nodes. */
  source?: {
    path: string;
    semanticPath: string;
    start: number;
    end: number;
    modeled: boolean;
  };
}

// Connection wire representation between nodes
export interface MDLink {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  /** Optional user-placed reroute/bend points (canvas coords) the wire routes through. Purely visual. */
  waypoints?: { x: number; y: number }[];
}

// UI Mod Widget representation for the layout builder
export interface UIWidget {
  id: string;
  type: 'window' | 'table' | 'button' | 'text' | 'progressbar' | 'dropdown' | 'header' | 'input' | 'chat';
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  properties: Record<string, any>;
  includeInBuild?: boolean;
}

export interface TranslationItem {
  id: string;
  value: string;
  description?: string;
}

export interface TranslationPage {
  id: string;
  title?: string;
  items: TranslationItem[];
}

export interface TFile {
  languageId: string;
  fileName: string;
  pages: TranslationPage[];
  includeInBuild?: boolean;
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

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  actionRequired?: boolean;
  proposedWorkspace?: ModWorkspace;
  proposedVersion?: number;
  actionApplied?: 'applied' | 'declined' | null;
  /** A4.9b — AI-extracted intent requirements verified against the proposal. */
  requirements?: any[];
}

export interface AIBehaviorScript {
  id: string;
  name: string;
  description: string;
  command: string;
  attentionLevel: 'high' | 'low';
  params: AIParam[];
  interrupts: Array<{ id: string; event: string; action: string }>;
  actions: AIAction[];
  includeInBuild?: boolean;
  /**
   * #65 — provenance flag. When true, `name` is already FINAL (e.g. an imported
   * script another mod already namespaced as `<owner>.<name>`, or one the studio has
   * already namespaced): export must NOT re-prefix it with the workspace modId.
   * Authored scripts leave this unset and get namespaced on export.
   */
  namespaced?: boolean;
}

export interface WareDef {
  id: string;
  name: string;
  description: string;
  transport: 'container' | 'liquid' | 'solid' | 'energy';
  tags?: string;
  volume: number;
  minPrice: number;
  avgPrice: number;
  maxPrice: number;
  prodTime: number;
  prodAmount: number;
  productionMethod?: string;
  productionName?: string;
  primaryWares?: Array<{ ware: string; amount: number | string }>;
  includeInBuild?: boolean;
}

export interface JobDef {
  id: string;
  name: string;
  faction: string;
  shipClass: 'fighter' | 'corvette' | 'destroyer' | 'carrier' | 'freighter';
  shipMacro: string;
  galaxyQuota: number;
  sectorQuota: number;
  taskScript: string;
  rebuildOnDestroy: boolean;
  includeInBuild?: boolean;
}

export interface PatchBlock {
  id: string;
  sel: string;
  action: 'add' | 'replace' | 'remove';
  content: string;
  note: string;
  pos?: 'before' | 'after' | 'prepend' | 'append';
  /** Attribute-level add ('@name'): compiles to <add sel="..." type="@name">value</add>. */
  attrType?: string;
  targetFile?: string;
  includeInBuild?: boolean;
  /** B99 provenance: ignored by the XML compiler, used to make generated rules idempotent. */
  generatedRuleId?: string;
  generatedPlanHash?: string;
  sourceSignature?: string;
}

// Complete Mod Workspace containing scripts and widgets state
export interface ModWorkspace {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  nodes: MDNode[];
  links: MDLink[];
  uiWidgets: UIWidget[];
  uiTheme: {
    backgroundColor: string;
    borderColor: string;
    accentColor: string;
    opacity: number;
    showIcons: boolean;
  };
  tFiles?: TFile[];
  aiScripts?: AIBehaviorScript[];
  wares?: WareDef[];
  jobs?: JobDef[];
  xmlPatches?: PatchBlock[];
  compileSettings?: {
    md: boolean;
    ui: boolean;
    ai: boolean;
    library: boolean;
    translations: boolean;
    patches: boolean;
  };
  templates?: MDNode[];
  /**
   * Preserved from import so an editable MD file round-trips to the SAME identity it had:
   * `mdScriptName` is the original `<mdscript name="...">`, `mdFileStem` is the original
   * file's basename (without .xml). Without these, export renames the script + file after
   * the mod's display title (spaces and all → invalid). New mods leave them undefined and
   * fall back to a sanitized name derived from the workspace.
   */
  mdScriptName?: string;
  mdFileStem?: string;
  /** Absolute path of the folder this workspace was imported from (shown in the UI so the
   * user can always see WHICH project + directory is open). Undefined for new/blank mods. */
  sourceFolder?: string;
  /** content.xml <dependency> declarations, parsed on import + emitted on export so they
   * survive regeneration (otherwise the mod silently no-ops dependent APIs in-game). */
  dependencies?: { id: string; version?: string; optional?: boolean; name?: string }[];
  /** Preserved content.xml id (the extension folder name). Keeps export from renaming the
   *  mod's folder/id after the display title. Undefined for new mods → derived from name. */
  contentId?: string;
  /** The editable MD file's ORIGINAL raw bytes + path, captured on import. On export, if the
   *  graph wasn't semantically edited, these exact bytes are re-emitted (true byte-fidelity:
   *  comments, whitespace, attribute order all preserved). Only a real edit triggers regen. */
  mdOriginal?: { path: string; content: string };
  /** content.xml's ORIGINAL raw bytes, captured on import. Re-emitted verbatim when the mod
   *  metadata is unedited — preserves <dependency> elements + formatting that generateContentXML
   *  would otherwise drop. */
  contentOriginal?: string;
  /** Original bytes for files that were also parsed into editable models. If the model's
   *  import-time fingerprint is unchanged, export writes these bytes verbatim instead of
   *  dirtying hand-authored files with a graph/compiler rewrite. */
  originalFiles?: OriginalModeledFile[];
  /**
   * Files imported from an existing mod that the studio does not (yet) model as
   * editable domains. Preserved verbatim so import -> export is lossless. On
   * export they are written back at their original relative path, unless a
   * generated file already claims that path (the generated file wins).
   */
  passthroughFiles?: PassthroughFile[];
  /** Stale-source deploy gate (P0 2026-07-09): stamped at import with a content-keyed hash
   * of the source folder; deploy blocks when the folder changed since (see compileFidelity). */
  sourceStamp?: { dir: string; hash: string; at: string };
  /** Lever 2: HTTP integration contract with an external local process (the studio owns the X4-side glue only). */
  integrationContract?: IntegrationContract;
  /** Lever 3: a single freely-editable custom Lua buffer, packaged as ui/<id>_custom.lua. */
  customLua?: string;
}

export interface OriginalModeledFile {
  path: string;
  content: string;
  kind: 'content' | 'md' | 'tfile' | 'readme';
  fingerprint?: string;
  stem?: string;
  /** True only when the legacy whole-file graph serializer preserves every source element.
   * Imported MD with false remains editable through guarded source-span operations, but a
   * graph-only mutation must never fall back to lossy whole-file regeneration. */
  graphRegenerable?: boolean;
}

export interface PassthroughFile {
  /** relative path within the extension, e.g. "libraries/god.xml" */
  path: string;
  /** verbatim file content; omitted for tracked-on-disk oversized files */
  content?: string;
  /** classification of why this file is preserved raw rather than modeled */
  reason?: 'unknown_domain' | 'unparsed' | 'binary' | 'partial' | 'too_large';
  /** true when the file is tracked on disk but not loaded into memory (e.g. binary/too-large); content is absent and must never be overwritten with empty output */
  omitted?: boolean;
  /** size on disk in bytes (recorded for omitted/preserved files) */
  bytes?: number;
}

// Built-in game variables for X4 standard database definitions
export const X4_FACTIONS = [
  'player',
  'argon',
  'xenon',
  'khaak',
  'split',
  'paranid',
  'teladi',
  'terran',
  'antigone',
  'hatikvah',
  'yaki',
  'ministry'
];

export const X4_SHIP_MACROS = [
  'ship_arg_l_destroyer_01_a_macro (Behemoth Van.)',
  'ship_arg_s_fighter_01_a_macro (Elite Vanguard)',
  'ship_tel_xl_carrier_01_a_macro (Condor Van.)',
  'ship_split_m_corvette_01_a_macro (Dragon Van.)',
  'ship_ter_l_destroyer_01_a_macro (Syn)',
  'ship_xen_i_destroyer_01_macro (Xenon I)',
  'ship_xen_k_destroyer_01_macro (Xenon K)',
  'ship_par_m_frigate_01_a_macro (Gorgon Van.)',
  'ship_arg_xl_builder_01_a_macro (Mammoth Van.)'
];

export const X4_STATION_MACROS = [
  'station_arg_defense_01_macro (Defence Station)',
  'station_player_headquarters_01_macro (Player HQ)',
  'station_tel_trading_01_macro (Trading Station)',
  'station_xen_shipyard_01_macro (Xenon Shipyard)'
];

export const X4_SOUND_EFFECTS = [
  'notification_generic',
  'mission_accomplished',
  'mission_failed',
  'incoming_transmission',
  'ui_menu_click',
  'alarm_red'
];

export const NODE_TEMPLATES: Omit<MDNode, 'id' | 'x' | 'y'>[] = [
  // Cues (Outer shells)
  {
    type: 'cue',
    label: 'Mission Cue',
    xmlTag: 'cue',
    properties: {
      name: 'MyMissionCue',
      instantiate: 'false',
      namespace: 'this',
      state: 'active',
      delayExact: '',
      delayMin: '',
      delayMax: '',
      isLibrary: 'false',
      libParamsXml: ''
    },
    propertiesSchema: [
      { key: 'name', label: 'Cue ID / Name', type: 'text', placeholder: 'e.g. MyCue_Start' },
      { key: 'instantiate', label: 'Instantiate', type: 'select', options: ['true', 'false'], description: 'Creates a dynamic copy of this cue each time context occurs' },
      { key: 'namespace', label: 'Namespace', type: 'select', options: ['this', 'player', 'cue'] },
      { key: 'state', label: 'Initial State', type: 'select', options: ['active', 'inactive', 'waiting'] },
      { key: 'delayExact', label: 'Delay (exact)', type: 'text', placeholder: 'e.g. 1s', description: 'Wait this long between trigger and actions. X4 time, e.g. 5s, 1min. Use this OR min+max.' },
      { key: 'delayMin', label: 'Delay (min)', type: 'text', placeholder: 'e.g. 3s', description: 'Random delay lower bound (pairs with Delay max).' },
      { key: 'delayMax', label: 'Delay (max)', type: 'text', placeholder: 'e.g. 8s', description: 'Random delay upper bound (pairs with Delay min).' },
      { key: 'isLibrary', label: 'Is Library', type: 'select', options: ['false', 'true'], description: 'Emit as <library> (a reusable subroutine called by signal_cue) instead of <cue>.' },
      { key: 'libParamsXml', label: 'Library Params (raw XML)', type: 'text', placeholder: '<params><param name="x" default="0"/></params>', description: 'Only used when Is Library = true. The <params> block, kept verbatim.' }
    ],
    inputs: [
      { id: 'in_flow', name: 'Trigger Parent', type: 'parent' }
    ],
    outputs: [
      { id: 'out_cond', name: 'Conditions', type: 'child' },
      { id: 'out_act', name: 'Actions', type: 'child' },
      { id: 'out_sub', name: 'Sub Cues', type: 'parent' }
    ]
  },

  // Events (Conditions / Triggers)
  {
    type: 'event',
    label: 'Event: Game Started',
    xmlTag: 'event_cue_signalled',
    properties: {
      cue: 'md.Setup.Start'
    },
    propertiesSchema: [
      { key: 'cue', label: 'Signaling Cue', type: 'text', placeholder: 'md.Setup.Start', description: 'Triggered when this standard system startup cue completes' }
    ],
    inputs: [
      { id: 'in_cond', name: 'Condition In', type: 'child' }
    ],
    outputs: [
      { id: 'out_flow', name: 'Trigger Actions', type: 'flow' }
    ]
  },
  {
    type: 'event',
    label: 'Event: Object Destroyed',
    xmlTag: 'event_object_destroyed',
    properties: {
      object: 'player.target',
      faction: 'xenon'
    },
    propertiesSchema: [
      { key: 'object', label: 'Object / Target', type: 'text', placeholder: 'player.target', description: 'Specific ship or variable entity being watched' },
      { key: 'faction', label: 'Faction Filter', type: 'select', options: ['any', ...X4_FACTIONS] }
    ],
    inputs: [
      { id: 'in_cond', name: 'Condition In', type: 'child' }
    ],
    outputs: [
      { id: 'out_flow', name: 'Trigger Actions', type: 'flow' }
    ]
  },
  {
    type: 'event',
    label: 'Event: Sector Entered',
    xmlTag: 'event_object_changed_sector',
    properties: {
      object: 'playership',
      sector: 'player.sector'
    },
    propertiesSchema: [
      { key: 'object', label: 'Object', type: 'text', placeholder: 'playership' },
      { key: 'sector', label: 'Target Sector', type: 'text', placeholder: 'player.sector', description: 'Can specify a helper variable or specific zone' }
    ],
    inputs: [
      { id: 'in_cond', name: 'Condition In', type: 'child' }
    ],
    outputs: [
      { id: 'out_flow', name: 'Trigger Actions', type: 'flow' }
    ]
  },

  // Conditions (Check constraints)
  {
    type: 'condition',
    label: 'Check: Player Wealth',
    xmlTag: 'check_value',
    properties: {
      value: 'player.money',
      operator: 'ge',
      amount: 1000000
    },
    propertiesSchema: [
      { key: 'value', label: 'Variable/Check', type: 'text', placeholder: 'player.money' },
      { key: 'operator', label: 'Comparison', type: 'select', options: ['exact (eq)', 'greater/equal (ge)', 'less/equal (le)', 'not equal (ne)'] },
      { key: 'amount', label: 'Credits Threshold', type: 'number', placeholder: '1000000' }
    ],
    inputs: [
      { id: 'in_cond', name: 'Condition In', type: 'child' }
    ],
    outputs: [
      { id: 'out_flow', name: 'Passed Flow', type: 'flow' }
    ]
  },

  // Actions
  {
    type: 'action',
    label: 'Spawn Ship',
    xmlTag: 'create_ship',
    properties: {
      name: '$EscortShip',
      macro: 'ship_arg_l_destroyer_01_a_macro',
      faction: 'player',
      sector: 'player.sector',
      coords: '0,0,1000'
    },
    propertiesSchema: [
      { key: 'name', label: 'Variable Name', type: 'text', placeholder: '$SpawnedShip' },
      { key: 'macro', label: 'Ship Class Macro', type: 'reference', refKind: 'ship', placeholder: 'Search ship macros… or type a variable', description: 'Searchable against the real installed game index (ships + DLC).' },
      { key: 'faction', label: 'Owner Faction', type: 'reference', refKind: 'faction', placeholder: 'Search factions… (stores the short code)', description: 'All factions from the installed game + DLC. Stored as the short code (e.g. argon); the compiler emits faction.argon.' },
      { key: 'sector', label: 'Sector / Spawn Zone', type: 'text', placeholder: 'player.sector' },
      { key: 'coords', label: 'Relative Coordinates (X,Y,Z)', type: 'coordinates', placeholder: '0,0,1000' }
    ],
    inputs: [
      { id: 'in_act', name: 'Action In', type: 'child' }
    ],
    outputs: [
      { id: 'out_next', name: 'Next Action', type: 'flow' }
    ]
  },
  {
    type: 'action',
    label: 'Reward Player',
    xmlTag: 'reward_player',
    properties: {
      money: 250000,
      notification: 'true',
      standing: '0.05',
      faction: 'argon'
    },
    propertiesSchema: [
      { key: 'money', label: 'Credits Reward', type: 'number', placeholder: '250000' },
      { key: 'notification', label: 'Display Notification', type: 'select', options: ['true', 'false'] },
      { key: 'standing', label: 'Faction Reputation Change', type: 'text', placeholder: '0.05 (Scale -1.0 to 1.0)' },
      { key: 'faction', label: 'Reputation Faction', type: 'reference', refKind: 'faction', placeholder: 'Search factions… (stores the short code)', description: 'All factions from the installed game + DLC. Stored as the short code (e.g. argon).' }
    ],
    inputs: [
      { id: 'in_act', name: 'Action In', type: 'child' }
    ],
    outputs: [
      { id: 'out_next', name: 'Next Action', type: 'flow' }
    ]
  },
  {
    type: 'action',
    label: 'Play Audio/Sound',
    xmlTag: 'play_sound',
    properties: {
      object: 'playership',
      sound: 'notification_generic'
    },
    propertiesSchema: [
      { key: 'object', label: 'Source Object', type: 'text', placeholder: 'playership' },
      { key: 'sound', label: 'Audio Clip ID', type: 'select', options: X4_SOUND_EFFECTS }
    ],
    inputs: [
      { id: 'in_act', name: 'Action In', type: 'child' }
    ],
    outputs: [
      { id: 'out_next', name: 'Next Action', type: 'flow' }
    ]
  },
  {
    type: 'action',
    label: 'Show Briefing',
    xmlTag: 'show_help',
    properties: {
      text: 'Custom mod cue successfully loaded!',
      duration: 5
    },
    propertiesSchema: [
      { key: 'text', label: 'Sub-screen Text Banner', type: 'text', placeholder: 'Type briefing alert notice...' },
      { key: 'duration', label: 'Duration (Seconds)', type: 'number', placeholder: '5' }
    ],
    inputs: [
      { id: 'in_act', name: 'Action In', type: 'child' }
    ],
    outputs: [
      { id: 'out_next', name: 'Next Action', type: 'flow' }
    ]
  },
  {
    type: 'action',
    label: 'Spawn Station',
    xmlTag: 'create_station',
    properties: {
      name: '$MyDefenseStation',
      macro: 'defence_arg_tube_01_macro',
      faction: 'player',
      sector: 'player.sector',
      coords: '5000,0,5000'
    },
    propertiesSchema: [
      { key: 'name', label: 'Station Entity Target', type: 'text', placeholder: '$MyStation' },
      { key: 'macro', label: 'Station Design Macro', type: 'reference', refKind: 'station', placeholder: 'Search station macros… or type a variable', description: 'Searchable against the real installed game index (stations + DLC).' },
      { key: 'faction', label: 'Owner Faction', type: 'reference', refKind: 'faction', placeholder: 'Search factions… (stores the short code)', description: 'All factions from the installed game + DLC. Stored as the short code (e.g. argon); the compiler emits faction.argon.' },
      { key: 'sector', label: 'Spawn Sector', type: 'text', placeholder: 'player.sector' },
      { key: 'coords', label: 'Coordinates (X,Y,Z)', type: 'coordinates', placeholder: '10000, 0, -5000' }
    ],
    inputs: [
      { id: 'in_act', name: 'Action In', type: 'child' }
    ],
    outputs: [
      { id: 'out_next', name: 'Next Action', type: 'flow' }
    ]
  },
  {
    type: 'action',
    label: 'Custom XML Action',
    xmlTag: 'custom_xml',
    properties: {
      rawXml: '<show_notification text="\'Target acquired!\'" timeout="5s" />'
    },
    propertiesSchema: [
      { key: 'rawXml', label: 'Raw XML Snippet', type: 'textarea', placeholder: 'Enter any valid Mission Director XML block...', description: 'This block will be printed raw directly into the actions block of the cue.' }
    ],
    inputs: [
      { id: 'in_act', name: 'Action In', type: 'child' }
    ],
    outputs: [
      { id: 'out_next', name: 'Next Action', type: 'flow' }
    ]
  },
  {
    type: 'event',
    label: 'Custom XML Event',
    xmlTag: 'custom_event',
    properties: {
      rawXml: '<event_cue_completed cue="md.MyPreviousCue" />'
    },
    propertiesSchema: [
      { key: 'rawXml', label: 'Raw Event XML Snippet', type: 'textarea', placeholder: 'Enter raw event XML...', description: 'This event is embedded in the conditions tag.' }
    ],
    inputs: [
      { id: 'in_cond', name: 'Condition In', type: 'child' }
    ],
    outputs: [
      { id: 'out_flow', name: 'Trigger Actions', type: 'flow' }
    ]
  },
  {
    type: 'condition',
    label: 'Custom XML Condition',
    xmlTag: 'custom_condition',
    properties: {
      rawXml: '<check_value value="player.ship.isclass.ship_xl" />'
    },
    propertiesSchema: [
      { key: 'rawXml', label: 'Raw Condition XML Snippet', type: 'textarea', placeholder: 'Enter raw check_value or condition XML...', description: 'This check_value is embedded in the conditions tag.' }
    ],
    inputs: [
      { id: 'in_cond', name: 'Condition In', type: 'child' }
    ],
    outputs: [
      { id: 'out_flow', name: 'Passed Flow', type: 'flow' }
    ]
  },
  {
    // Generic cue: a whole <cue>/<library> preserved verbatim when the node model can't
    // decompose it yet. Lossless by construction → the importer never needs passthrough.
    type: 'cue',
    label: 'Custom XML Cue',
    xmlTag: 'custom_xml_cue',
    properties: {
      name: 'RawCue',
      rawXml: '<cue name="RawCue">\n  <!-- raw MD preserved verbatim -->\n</cue>'
    },
    propertiesSchema: [
      { key: 'name', label: 'Cue ID / Name', type: 'text', placeholder: 'e.g. MyCue' },
      { key: 'rawXml', label: 'Raw Cue XML', type: 'textarea', placeholder: 'A whole <cue>…</cue> or <library>…</library> block', description: 'This entire cue is preserved verbatim — used when the node model cannot decompose it yet. Edit the XML directly.' }
    ],
    inputs: [
      { id: 'in_flow', name: 'Trigger Parent', type: 'parent' }
    ],
    outputs: [
      { id: 'out_sub', name: 'Sub Cues', type: 'child' }
    ]
  },
  // ── Control-flow containers (50th pass) ──────────────────────────────────
  // First-class spawnable branch/loop nodes. The `out_body` port is the chain
  // of actions INSIDE the branch; `out_next` is the sibling AFTER it closes.
  // This is what makes deterministic branch gating + body nesting reachable.
  {
    type: 'action',
    label: 'If (conditional)',
    xmlTag: 'do_if',
    properties: { value: '$threat ge 3' },
    propertiesSchema: [
      { key: 'value', label: 'Condition (expression)', type: 'text', placeholder: '$threat ge 3', description: 'Branch runs when this expression is true. Wire the body to the "Branch Body" port.' }
    ],
    inputs: [{ id: 'in_act', name: 'Action In', type: 'child' }],
    outputs: [
      { id: 'out_body', name: 'Branch Body', type: 'child' },
      { id: 'out_next', name: 'Next Action', type: 'flow' }
    ]
  },
  {
    type: 'action',
    label: 'Else-If',
    xmlTag: 'do_elseif',
    properties: { value: '$threat ge 1' },
    propertiesSchema: [
      { key: 'value', label: 'Condition (expression)', type: 'text', placeholder: '$threat ge 1', description: 'Runs when prior branches were false and this expression is true.' }
    ],
    inputs: [{ id: 'in_act', name: 'Action In', type: 'child' }],
    outputs: [
      { id: 'out_body', name: 'Branch Body', type: 'child' },
      { id: 'out_next', name: 'Next Action', type: 'flow' }
    ]
  },
  {
    type: 'action',
    label: 'Else',
    xmlTag: 'do_else',
    properties: {},
    propertiesSchema: [],
    inputs: [{ id: 'in_act', name: 'Action In', type: 'child' }],
    outputs: [
      { id: 'out_body', name: 'Branch Body', type: 'child' },
      { id: 'out_next', name: 'Next Action', type: 'flow' }
    ]
  },
  {
    type: 'action',
    label: 'While (loop)',
    xmlTag: 'do_while',
    properties: { value: '$count lt 5' },
    propertiesSchema: [
      { key: 'value', label: 'Condition (expression)', type: 'text', placeholder: '$count lt 5', description: 'Body repeats while this expression stays true. Iteration count is runtime-dependent.' }
    ],
    inputs: [{ id: 'in_act', name: 'Action In', type: 'child' }],
    outputs: [
      { id: 'out_body', name: 'Loop Body', type: 'child' },
      { id: 'out_next', name: 'Next Action', type: 'flow' }
    ]
  },
  {
    type: 'action',
    label: 'For Each',
    xmlTag: 'do_for_each',
    properties: { exact: '', counter: '$i' },
    propertiesSchema: [
      { key: 'exact', label: 'List / source', type: 'text', placeholder: '$ships', description: 'The list to iterate over.' },
      { key: 'counter', label: 'Counter variable', type: 'text', placeholder: '$i', description: 'Optional loop counter variable.' }
    ],
    inputs: [{ id: 'in_act', name: 'Action In', type: 'child' }],
    outputs: [
      { id: 'out_body', name: 'Loop Body', type: 'child' },
      { id: 'out_next', name: 'Next Action', type: 'flow' }
    ]
  }
];

const CURATED_XML_TAGS = new Set(NODE_TEMPLATES.map(template => template.xmlTag));

/**
 * Derive a VALID X4 MD script name (for <mdscript name="...">) from an arbitrary string.
 * The mod's display title (workspace.name, also used for content.xml) may contain spaces
 * and punctuation; the script name may not. An already-valid name is returned unchanged.
 */
export function safeMdScriptName(raw: string): string {
  const s = String(raw || '').trim();
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(s)) return s; // already a valid script name → unchanged
  const cleaned = s.replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return /^[A-Za-z]/.test(cleaned) ? cleaned : (cleaned ? `md_${cleaned}` : 'Sample_Mod');
}

/** The actual <mdscript name> a workspace emits: the imported name, else a sanitized title. */
export function effectiveMdScriptName(workspace: { mdScriptName?: string; name?: string }): string {
  return workspace.mdScriptName || safeMdScriptName(workspace.name || 'Sample_Mod');
}

export function templateFromSchemaElement(element: SchemaElement): Omit<MDNode, 'id' | 'x' | 'y'> {
  return schemaElementToTemplate(element);
}

export function renderGenericXMLNode(node: Pick<MDNode, 'xmlTag' | 'properties' | 'propertiesSchema'>, indent = ''): string {
  const attrKeys = (node.propertiesSchema || []).map(schema => schema.key);
  // Schema fields drive friendly ordering, but imported extension attributes outside the
  // current XSD/card vocabulary are still real source and must survive regeneration.
  const keys = [...new Set([...attrKeys, ...Object.keys(node.properties || {})])];
  const attrs = keys
    .filter(key => key !== 'rawXml' && !key.startsWith('__'))
    .map(key => [key, (node.properties || {})[key]] as const)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => `${key}="${escapeXMLAttribute(String(value))}"`)
    .join(' ');

  const rawChildren = String((node.properties || {}).__rawChildrenXml || '').trim();
  if (rawChildren) {
    return `${indent}<${node.xmlTag}${attrs ? ` ${attrs}` : ''}>\n${reindentRawXmlBlock(rawChildren, `${indent}  `)}\n${indent}</${node.xmlTag}>`;
  }
  return `${indent}<${node.xmlTag}${attrs ? ` ${attrs}` : ''} />`;
}

function escapeXMLAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function patchRawChildAttributes(raw: string, tag: string, values: Record<string, string>): string {
  const expression = new RegExp(`<${tag}\\b[^>]*>`, 'i');
  return raw.replace(expression, opening => {
    let next = opening;
    for (const [name, value] of Object.entries(values)) {
      const attr = new RegExp(`(\\s${name}\\s*=\\s*)(["'])(?:[\\s\\S]*?)\\2`, 'i');
      const escaped = escapeXMLAttribute(value);
      next = attr.test(next)
        ? next.replace(attr, (_match, prefix, quote) => `${prefix}${quote}${escaped}${quote}`)
        : next.replace(/(\/?>)$/, ` ${name}="${escaped}"$1`);
    }
    return next;
  });
}

/**
 * Format a value as an X4 time literal. X4 time-typed attributes (durations,
 * delays) require a unit suffix — a bare number like "8" fails at runtime with
 * "Evaluated value '8' is not of type time". A bare number gets "s" appended;
 * values that already carry a unit, or are MD expressions ({...}), pass through.
 */
export function formatX4Time(value: unknown): string {
  const s = String(value ?? '').trim();
  if (!s) return '0s';
  if (/^\d+(\.\d+)?$/.test(s)) return `${s}s`;     // bare number -> seconds
  return s;                                          // already has a unit or is an expression
}

/**
 * Re-indent a raw-passthrough XML block IDEMPOTENTLY (B68).
 *
 * The raw-passthrough render paths used to prepend a fixed indent to each line WITHOUT stripping
 * the line's own leading whitespace (`indent + l`). Because import serializes children WITH their
 * file indentation, every import→generate cycle added another layer → unbounded runaway indentation
 * (proven on-disk: `<actions>` drifting ~100 spaces right while `<library>` stayed put, since
 * re-serialization resets the first line but children accumulate). A common-minimum dedent can't fix
 * it (the first line sits at column 0 → min 0). This instead TRIMS every line and re-indents by
 * tag-nesting depth, so applying it twice is a fixed point: reindent(reindent(x)) === reindent(x).
 *
 * Idempotency comes from trim-first and is independent of the depth heuristic's precision; the
 * one-tag-per-line depth counting only affects prettiness on the common (serializer) shape.
 */
export function reindentRawXmlBlock(raw: string, baseIndent: string, step: string = '  '): string {
  const lines = String(raw ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let depth = 0;
  for (const rawLine of lines) {
    const t = rawLine.trim();
    if (!t) continue;                                   // drop blank/whitespace-only lines (no structure)
    const tags = t.match(/<[^>]+>/g) || [];
    const closes = tags.filter(g => /^<\//.test(g)).length;
    const selfCloses = tags.filter(g => /\/>$/.test(g)).length;
    const comments = tags.filter(g => /^<!--/.test(g) || /^<[?!]/.test(g)).length;
    const opens = tags.length - closes - selfCloses - comments;
    const beginsWithClose = /^<\//.test(t);
    const thisDepth = beginsWithClose ? Math.max(0, depth - 1) : depth;
    out.push(baseIndent + step.repeat(thisDepth) + t);
    depth = Math.max(0, depth + opens - closes);
  }
  return out.join('\n');
}

// Helper functions to generate the XML output cleanly
export function generateMDXML(originalWorkspace: ModWorkspace, selectedCueIds?: string[], scriptNameOverride?: string): string {
  // Filter out any nodes where includeInBuild is false
  const activeNodes = (originalWorkspace.nodes || []).filter(n => n.includeInBuild !== false);
  const activeNodeIds = new Set(activeNodes.map(n => n.id));
  const activeLinks = (originalWorkspace.links || []).filter(l => 
    activeNodeIds.has(l.sourceNodeId) && activeNodeIds.has(l.targetNodeId)
  );

  const workspace = {
    ...originalWorkspace,
    nodes: activeNodes,
    links: activeLinks
  };

  function renderCue(cue: any, indentDepth: number = 2): string {
    const indent = ' '.repeat(indentDepth);
    const indentPlus = ' '.repeat(indentDepth + 2);
    const indentDouble = ' '.repeat(indentDepth + 4);

    // Generic cue node: a whole <cue>/<library> the importer couldn't decompose into typed
    // nodes is preserved verbatim here. Lossless by construction → no cue is ever "too hard
    // to represent", so passthrough is never needed.
    if (cue.xmlTag === 'custom_xml_cue') {
      // B68: idempotent re-indent (was `indent + l` per line → unbounded runaway indentation on round-trip).
      return reindentRawXmlBlock(String(cue.properties?.rawXml || ''), indent) + '\n';
    }

    const cueName = cue.properties.name || cue.id;
    const isLib = cue.properties.isLibrary === 'true' || cue.properties.isLibrary === true;
    const inst = cue.properties.instantiate === 'true' ? ' instantiate="true"' : '';
    const ns = cue.properties.namespace ? ` namespace="${escapeXMLAttribute(String(cue.properties.namespace))}"` : '';
    const state = cue.properties.state && cue.properties.state !== 'active' ? ` state="${escapeXMLAttribute(String(cue.properties.state))}"` : '';
    const cueInternal = new Set([
      'name', 'instantiate', 'namespace', 'state', 'mdScript', 'mdFileStem', 'isLibrary',
      'libPurpose', 'purpose', 'libParamsXml', 'libDocXml', 'cueHeaderXml', 'cueTailXml',
      'hasConditionsElement', 'hasActionsElement', 'delayExact', 'delayMin', 'delayMax',
    ]);
    const extraCueAttrs = Object.entries(cue.properties || {})
      .filter(([key, value]) => !cueInternal.has(key) && !key.startsWith('__') && value !== undefined && value !== null && String(value) !== '')
      .map(([key, value]) => ` ${key}="${escapeXMLAttribute(String(value))}"`)
      .join('');

    // <library> is a cue variant: name only (no instantiate/namespace/state), with an
    // optional <documentation>/<params> header preserved verbatim before the cue body.
    const reindent = (raw: string, ind: string) =>
      String(raw || '').trim().split('\n').map(l => `${ind}${l.trim()}`).join('\n');
    // A library called via <run_actions ref> needs purpose="run_actions"; preserve whatever purpose
    // was captured on import so the generated <library> keeps it (else the cue fails at runtime).
    const libPurpose = cue.properties.libPurpose ? ` purpose="${escapeXMLAttribute(String(cue.properties.libPurpose))}"` : '';
    let xml = isLib
      ? `${indent}<library name="${escapeXMLAttribute(String(cueName))}"${libPurpose}${extraCueAttrs}>\n`
      : `${indent}<cue name="${escapeXMLAttribute(String(cueName))}"${inst}${ns}${state}${extraCueAttrs}>\n`;
    if (cue.properties.cueHeaderXml) {
      xml += `${reindent(cue.properties.cueHeaderXml, indentPlus)}\n`;
    } else if (isLib) {
      if (cue.properties.libDocXml) xml += `${reindent(cue.properties.libDocXml, indentPlus)}\n`;
      if (cue.properties.libParamsXml) xml += `${reindent(cue.properties.libParamsXml, indentPlus)}\n`;
    }
    
    // Conditions block parsing (find all nodes connected to out_cond)
    const condLinks = workspace.links.filter(l => l.sourceNodeId === cue.id && l.sourcePortId === 'out_cond');
    if (condLinks.length > 0 || cue.properties.hasConditionsElement === true) {
      xml += `${indentPlus}<conditions>\n`;
      condLinks.forEach(link => {
        const targetNode = workspace.nodes.find(n => n.id === link.targetNodeId);
        if (targetNode) {
          if (targetNode.xmlTag === 'custom_event' || targetNode.xmlTag === 'custom_condition') {
            // B68: idempotent re-indent (was per-line `indentDouble + l` with no per-line dedent → runaway).
            const raw = targetNode.properties.rawXml || '';
            if (raw.trim()) xml += reindentRawXmlBlock(raw, indentDouble) + '\n';
          } else if (targetNode.source && targetNode.xmlTag.startsWith('event_')) {
            // Imported event variants often use attributes that the friendly card does not
            // expose (group, object, param, custom event context). Their parsed attributes
            // are authoritative; template defaults are only for newly-authored nodes.
            xml += `${renderGenericXMLNode(targetNode, indentDouble)}\n`;
          } else if (targetNode.xmlTag === 'event_cue_signalled') {
            const importedEmptyCue = !!targetNode.source && !targetNode.properties.cue;
            xml += importedEmptyCue
              ? `${indentDouble}<event_cue_signalled />\n`
              : `${indentDouble}<event_cue_signalled cue="${escapeXMLAttribute(String(targetNode.properties.cue || 'md.Setup.Start'))}" />\n`;
          } else if (targetNode.xmlTag === 'event_object_destroyed') {
            // md.xsd: event_object_destroyed has no `faction` attribute; faction
            // filtering belongs in a follow-up condition, not here.
            xml += `${indentDouble}<event_object_destroyed object="${escapeXMLAttribute(String(targetNode.properties.object || 'player.target'))}" />\n`;
          } else if (targetNode.xmlTag === 'event_object_changed_sector') {
            xml += `${indentDouble}<event_object_changed_sector object="${escapeXMLAttribute(String(targetNode.properties.object || 'playership'))}" sector="${escapeXMLAttribute(String(targetNode.properties.sector || 'player.sector'))}" />\n`;
          } else if (targetNode.xmlTag === 'check_value') {
            // md.xsd: check_value can be EITHER a standalone boolean expression in `value`
            // (`value="$x ge 5"`) OR an operand `value` + a comparison attr (min/max/exact).
            // BUG FIX (G1): if `value` already contains a comparison/boolean operator it IS a
            // full expression — emit it standalone. Only add min/max/exact when the node was
            // authored with an explicit operator+amount AND value is a bare operand. (Previously
            // a default min="1000000" was always appended, making expression conditions never true.)
            const rawVal = String(targetNode.properties.value || 'player.money');
            const isExpression = /\b(ge|gt|le|lt|eq|ne|and|or|not)\b/.test(rawVal) || /(<=|>=|==|!=|<|>)/.test(rawVal);
            const hasOperator = targetNode.properties.operator !== undefined && String(targetNode.properties.operator) !== '';
            const hasAmount = targetNode.properties.amount !== undefined && String(targetNode.properties.amount) !== '';
            if (isExpression || (!hasOperator && !hasAmount)) {
              // full boolean expression, or a bare truthiness check — emit standalone
              xml += `${indentDouble}<check_value value="${escapeXMLAttribute(rawVal)}" />\n`;
            } else {
              const rawOp = String(targetNode.properties.operator || 'ge');
              const op = (rawOp.match(/\((\w+)\)/)?.[1] || rawOp).toLowerCase();
              const amt = targetNode.properties.amount ?? 0;
              let cmp: string;
              if (op === 'ge' || op === 'min' || op === 'gt') cmp = `min="${amt}"`;
              else if (op === 'le' || op === 'max' || op === 'lt') cmp = `max="${amt}"`;
              else if (op === 'ne') cmp = `exact="${amt}" negate="true"`;
              else cmp = `exact="${amt}"`;
              xml += `${indentDouble}<check_value value="${escapeXMLAttribute(rawVal)}" ${cmp} />\n`;
            }
          } else {
            // Any schema-derived/long-tail condition not handled by a bespoke renderer is
            // still a real X4 element. Attribute-only generic emission is the safe default;
            // silently omitting a curated tag is never acceptable.
            xml += `${renderGenericXMLNode(targetNode, indentDouble)}\n`;
          }
        }
      });
      xml += `${indentPlus}</conditions>\n`;
    }
    
    // <delay> — md.xsd cue order is conditions, delay, actions. Emitted from editable
    // cue fields so a timed cue keeps its timer on round-trip.
    {
      const dExact = cue.properties.delayExact, dMin = cue.properties.delayMin, dMax = cue.properties.delayMax;
      const has = (v: any) => v !== undefined && v !== null && String(v).trim() !== '';
      if (has(dExact) || has(dMin) || has(dMax)) {
        const da = [
          has(dExact) ? `exact="${escapeXMLAttribute(String(dExact))}"` : '',
          has(dMin) ? `min="${escapeXMLAttribute(String(dMin))}"` : '',
          has(dMax) ? `max="${escapeXMLAttribute(String(dMax))}"` : '',
        ].filter(Boolean).join(' ');
        xml += `${indentPlus}<delay ${da} />\n`;
      }
    }

    // Actions block — recursive emit so control-flow containers (do_if/do_while/…)
    // nest their out_body chain INSIDE the element; out_next continues the sibling
    // chain exactly as before. Cycle-safe via a single shared `emitSeen` set.
    const actLinks = workspace.links.filter(l => l.sourceNodeId === cue.id && l.sourcePortId === 'out_act');
    if (actLinks.length > 0 || cue.properties.hasActionsElement === true) {
      xml += `${indentPlus}<actions>\n`;
      const emitSeen = new Set<string>();

      const emitNode = (node: any, ind: string): void => {
        const tag = node.xmlTag;
        // ── control-flow container: open tag → nest out_body chain → close tag ──
        if (isContainerTag(tag)) {
          const attrs = Object.entries(node.properties || {})
            .filter(([k, v]) => v !== undefined && v !== null && String(v) !== '' && k !== 'rawXml')
            .map(([k, v]) => `${k}="${escapeXMLAttribute(String(v))}"`)
            .join(' ');
          const bodyLink = workspace.links.find(l => l.sourceNodeId === node.id && l.sourcePortId === 'out_body');
          if (bodyLink) {
            xml += `${ind}<${tag}${attrs ? ' ' + attrs : ''}>\n`;
            emitChain(bodyLink.targetNodeId, ind + '  ');
            xml += `${ind}</${tag}>\n`;
          } else {
            // body not wired → empty branch (honest: nothing runs inside)
            xml += `${ind}<${tag}${attrs ? ' ' + attrs : ''} />\n`;
          }
          return;
        }
        if (tag === 'custom_xml') {
          // B68: idempotent re-indent (was per-line `ind + l` with no per-line dedent → runaway).
          const raw = node.properties.rawXml || '';
          if (raw.trim()) xml += reindentRawXmlBlock(raw, ind) + '\n';
        } else if (tag === 'create_ship') {
          // md.xsd: owner is a child <owner exact="faction.x"/>; location via
          // the `sector` attribute + a <position> child. No `faction` attr, no <space>.
          const fac = node.properties.faction || 'player';
          const sector = node.properties.sector || 'player.sector';
          const extraAttrs = Object.entries(node.properties || {})
            .filter(([key, value]) => !['name', 'macro', 'sector', 'faction', 'coords'].includes(key) && !key.startsWith('__') && value !== undefined && value !== null && String(value) !== '')
            .map(([key, value]) => ` ${key}="${escapeXMLAttribute(String(value))}"`).join('');
          xml += `${ind}<create_ship name="${escapeXMLAttribute(String(node.properties.name || '$EscortShip'))}" macro="${escapeXMLAttribute(String((node.properties.macro || '').split(' (')[0]))}" sector="${escapeXMLAttribute(String(sector))}"${extraAttrs}>\n`;
          let preservedChildren = String(node.properties.__rawChildrenXml || '').trim();
          if (preservedChildren) {
            preservedChildren = patchRawChildAttributes(preservedChildren, 'owner', { exact: `faction.${String(fac)}` });
            if (node.properties.coords) {
              const [x = '0', y = '0', z = '0'] = String(node.properties.coords).split(',');
              preservedChildren = patchRawChildAttributes(preservedChildren, 'position', { x, y, z });
            }
            xml += reindentRawXmlBlock(preservedChildren, `${ind}  `) + '\n';
          } else {
            xml += `${ind}  <owner exact="faction.${escapeXMLAttribute(String(fac))}" />\n`;
          }
          if (!preservedChildren && node.properties.coords) {
            const xyz = node.properties.coords.split(',');
            xml += `${ind}  <position x="${escapeXMLAttribute(String(xyz[0] || '0'))}" y="${escapeXMLAttribute(String(xyz[1] || '0'))}" z="${escapeXMLAttribute(String(xyz[2] || '0'))}" />\n`;
          }
          xml += `${ind}</create_ship>\n`;
        } else if (tag === 'reward_player') {
          // md.xsd: reward_player takes a `money` attribute and no children.
          xml += `${ind}<reward_player money="${escapeXMLAttribute(String(node.properties.money || 0))}" />\n`;
        } else if (tag === 'play_sound') {
          xml += `${ind}<play_sound object="${escapeXMLAttribute(String(node.properties.object || 'playership'))}" sound="${escapeXMLAttribute(String(node.properties.sound || 'notification_generic'))}" />\n`;
        } else if (tag === 'show_help') {
          // md.xsd: custom text goes in `custom`, not `text`. `duration` is an
          // X4 time value — a bare number ("8") is rejected at runtime, it must
          // carry a unit ("8s").
          xml += `${ind}<show_help custom="'${escapeXMLAttribute(String(node.properties.text || ''))}'" duration="${escapeXMLAttribute(formatX4Time(node.properties.duration ?? 5))}" />\n`;
        } else if (tag === 'create_station') {
          // md.xsd: owner is a REQUIRED attribute (not a child); location via
          // the `sector` attribute + a <position> child. No `faction` attr, no <space>.
          const fac = node.properties.faction || 'player';
          const sector = node.properties.sector || 'player.sector';
          const extraAttrs = Object.entries(node.properties || {})
            .filter(([key, value]) => !['name', 'macro', 'owner', 'sector', 'faction', 'coords'].includes(key) && !key.startsWith('__') && value !== undefined && value !== null && String(value) !== '')
            .map(([key, value]) => ` ${key}="${escapeXMLAttribute(String(value))}"`).join('');
          xml += `${ind}<create_station name="${escapeXMLAttribute(String(node.properties.name || '$Station'))}" macro="${escapeXMLAttribute(String((node.properties.macro || '').split(' (')[0]))}" owner="faction.${escapeXMLAttribute(String(fac))}" sector="${escapeXMLAttribute(String(sector))}"${extraAttrs}>\n`;
          let preservedChildren = String(node.properties.__rawChildrenXml || '').trim();
          if (preservedChildren) {
            if (node.properties.coords) {
              const [x = '0', y = '0', z = '0'] = String(node.properties.coords).split(',');
              preservedChildren = patchRawChildAttributes(preservedChildren, 'position', { x, y, z });
            }
            xml += reindentRawXmlBlock(preservedChildren, `${ind}  `) + '\n';
          } else if (node.properties.coords) {
            const xyz = node.properties.coords.split(',');
            xml += `${ind}  <position x="${escapeXMLAttribute(String(xyz[0] || '0'))}" y="${escapeXMLAttribute(String(xyz[1] || '0'))}" z="${escapeXMLAttribute(String(xyz[2] || '0'))}" />\n`;
          }
          xml += `${ind}</create_station>\n`;
        } else {
          // Schema-driven actions vastly outnumber the small hand-curated card set. A tag
          // without a bespoke renderer remains an ordinary attribute-based X4 element.
          // The old CURATED_XML_TAGS exclusion silently emitted nothing for several valid
          // cards and forced the importer to collapse their whole cue into raw XML.
          xml += `${renderGenericXMLNode(node, ind)}\n`;
        }
      };

      const emitChain = (startId: string, ind: string): void => {
        let node = workspace.nodes.find(n => n.id === startId);
        while (node && !emitSeen.has(node.id)) {
          emitSeen.add(node.id);
          emitNode(node, ind);
          const nextLink = workspace.links.find(l => l.sourceNodeId === node!.id && l.sourcePortId === 'out_next');
          node = nextLink ? workspace.nodes.find(n => n.id === nextLink.targetNodeId) : undefined;
        }
      };

      actLinks.forEach(firstLink => emitChain(firstLink.targetNodeId, indentDouble));
      xml += `${indentPlus}</actions>\n`;
    }

    if (cue.properties.cueTailXml) {
      xml += `${reindent(cue.properties.cueTailXml, indentPlus)}\n`;
    }
    
    // Recursive nesting for child cues (out_sub -> in_flow)
    const subCueLinks = workspace.links.filter(l => l.sourceNodeId === cue.id && l.sourcePortId === 'out_sub');
    if (subCueLinks.length > 0) {
      xml += `${indentPlus}<cues>\n`;
      subCueLinks.forEach(link => {
        const subCue = workspace.nodes.find(n => n.id === link.targetNodeId);
        if (subCue && subCue.type === 'cue') {
          xml += renderCue(subCue, indentDepth + 4);
        }
      });
      xml += `${indentPlus}</cues>\n`;
    }

    xml += isLib ? `${indent}</library>\n` : `${indent}</cue>\n`;
    return xml;
  }

  // MD script name: keep the imported `<mdscript name>` verbatim; otherwise derive a
  // VALID name from the workspace title (X4 forbids spaces/punctuation in script names).
  const mdName = scriptNameOverride || effectiveMdScriptName(workspace); // scriptNameOverride: per-script export (multi-script support)

  let xml = `<?xml version="1.0" encoding="utf-8"?>
<mdscript name="${escapeXMLAttribute(String(mdName))}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="md.xsd">
  <!-- Generated by X4 Forge (version ${workspace.version || '1.0.0'}) -->
  <!-- Author: ${workspace.author || 'Mod Creator'} -->
  <!-- Description: ${workspace.description || 'Custom MD Script'} -->
  <cues>
`;

  const cueNodes = workspace.nodes.filter(n => n.type === 'cue');
  const targetCues = selectedCueIds && selectedCueIds.length > 0
    ? cueNodes.filter(n => selectedCueIds.includes(n.id))
    : cueNodes.filter(n => {
        return !workspace.links.some(l => l.targetNodeId === n.id && l.sourcePortId === 'out_sub');
      });

  targetCues.forEach(cue => {
    xml += renderCue(cue, 4);
  });

  xml += `  </cues>
</mdscript>`;
  return xml;
}

// Generate the Lua config / Egosoft UI Customization parameters XML for menus
export function generateUIXML(originalWorkspace: ModWorkspace): string {
  const activeWidgets = (originalWorkspace.uiWidgets || []).filter(w => w.includeInBuild !== false);
  const workspace = {
    ...originalWorkspace,
    uiWidgets: activeWidgets
  };

  const t = workspace.uiTheme;

  let layoutXML =`<?xml version="1.0" encoding="utf-8"?>
<ui_menu name="${workspace.name || 'Sample_Menu'}" version="${workspace.version || '1.0.0'}">
  <!-- X4 Foundations Theme Style Settings -->
  <theme>
    <background color="${t.backgroundColor}" opacity="${t.opacity}" />
    <border color="${t.borderColor}" thickness="1" />
    <accent color="${t.accentColor}" />
    <icons enabled="${t.showIcons ? 'true' : 'false'}" />
  </theme>

  <!-- Visual Widget layout tree configuration -->
  <layout width="1920" height="1080" anchor="center">
`;

  workspace.uiWidgets.forEach(w => {
    const title = w.label;
    if (w.type === 'window') {
      layoutXML += `    <container type="window" x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" title="${title}">\n`;
      layoutXML += `      <!-- Nested widgets render within window container boundaries -->\n`;
      layoutXML += `    </container>\n`;
    } else if (w.type === 'table') {
      layoutXML += `    <table x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" columns="3">\n`;
      layoutXML += `      <columns>\n`;
      layoutXML += `        <column width="200" title="Item ID" />\n`;
      layoutXML += `        <column width="300" title="Item Name" />\n`;
      layoutXML += `        <column width="150" title="Status" />\n`;
      layoutXML += `      </columns>\n`;
      layoutXML += `      <row>\n`;
      layoutXML += `        <cell text="01" />\n`;
      layoutXML += `        <cell text="${title || 'Ship Deliveries'}" />\n`;
      layoutXML += `        <cell text="COMPLETED" color="#00ff66" />\n`;
      layoutXML += `      </row>\n`;
      layoutXML += `    </table>\n`;
    } else if (w.type === 'button') {
      const action = w.properties.action || 'signal_cue';
      const dest = w.properties.targetCue || 'MyMissionCue';
      layoutXML += `    <button x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" label="${title}" action="${action}" target="${dest}" />\n`;
    } else if (w.type === 'progressbar') {
      const val = w.properties.value || 75;
      const col = w.properties.progressColor || '#df9825';
      layoutXML += `    <progressbar x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" value="${val}" max="100" fillcolor="${col}" />\n`;
    } else if (w.type === 'text') {
      const size = w.properties.fontSize || 'medium';
      const align = w.properties.alignment || 'left';
      layoutXML += `    <text x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" content="${title}" fontsize="${size}" align="${align}" />\n`;
    } else if (w.type === 'header') {
      layoutXML += `    <header x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" text="${title.toUpperCase()}" />\n`;
    } else if (w.type === 'dropdown') {
      const opts = w.properties.options ? w.properties.options.join(',') : 'Option 1,Option 2';
      layoutXML += `    <select x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" options="${opts}" />\n`;
    } else if (w.type === 'input') {
      const ph = w.properties.placeholder || 'Type transmission...';
      layoutXML += `    <input x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" placeholder="${ph}" />\n`;
    } else if (w.type === 'chat') {
      layoutXML += `    <chat_history x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" title="${title}" />\n`;
    }
  });

  layoutXML += `  </layout>
</ui_menu>`;
  return layoutXML;
}

/**
 * Generate the X4 UI extension index (`ui.xml`) that lives at the extension
 * ROOT and registers the mod's Lua menu file(s). Format verified against the
 * kuertee x4-mod-ui-extensions reference mod: an <addon> with an
 * <environment type="menus"> listing <file name="ui/..."/> entries, and a
 * noNamespaceSchemaLocation pointing at the game's ui/core/addon.xsd.
 */
export function generateUIIndexXML(workspace: ModWorkspace, modId: string): string {
  const luaPath = `ui/${modId}.lua`;
  return `<?xml version="1.0" encoding="utf-8"?>
<addon name="${modId}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="../../ui/core/addon.xsd">
  <environment type="menus">
    <file name="${luaPath}" />
  </environment>
</addon>`;
}

/** Generate the runnable X4 standalone-menu entry point used by package AND preview. */
export function generateUILuaScript(workspace: ModWorkspace, modId: string): string {
  const activeWidgets = (workspace.uiWidgets || [])
    .filter(w => w.includeInBuild !== false)
    .slice()
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const luaName = modId.replace(/[^a-zA-Z0-9_]/g, '_');
  const menuName = `${luaName}_menu`;
  const esc = (s: unknown) => String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  const n = (value: unknown, fallback: number) => (
    typeof value === 'number' && Number.isFinite(value) ? value : fallback
  );

  const widgetLines = activeWidgets.map(w => {
    const label = esc(w.label || '');
    return `    { type = "${esc(w.type)}", id = "${esc(w.id)}", label = "${label}", x = ${Math.round(w.x)}, y = ${Math.round(w.y)}, width = ${Math.round(w.w)}, height = ${Math.round(w.h)} },`;
  }).join('\n');

  const rowLines = activeWidgets.map((w, widgetIndex) => {
    const id = esc(w.id);
    const label = esc(w.label || w.type);
    const props = w.properties || {};
    if (w.type === 'window' || w.type === 'header') {
      return `  row = ftable:addRow(false, {})\n  row[1]:setColSpan(2):createText("${label}", Helper.headerRowCenteredProperties)`;
    }
    if (w.type === 'button') {
      return `  row = ftable:addRow(true, {})\n  row[1]:setColSpan(2):createButton({ active = true }):setText("${label}", { halign = "center" })\n  row[1].handlers.onClick = function() menu.emit("${id}", { widget = "${id}" }) end`;
    }
    if (w.type === 'input') {
      const placeholder = esc(props.placeholder || w.label || 'Enter text');
      return `  row = ftable:addRow(true, {})\n  row[1]:setColSpan(2):createEditBox({ defaultText = "${placeholder}", maxChars = 255 })\n  row[1].handlers.onEditBoxDeactivated = function(_, text) menu.emit("${id}", { text = text }) end`;
    }
    if (w.type === 'dropdown') {
      const rawOptions = Array.isArray(props.options) && props.options.length > 0 ? props.options : ['Option 1', 'Option 2'];
      const options = rawOptions.map((option: unknown, index: number) => `{ id = "${esc(String(index + 1))}", text = "${esc(option)}" }`).join(', ');
      return `  row = ftable:addRow(true, {})\n  row[1]:createText("${label}")\n  local options_${widgetIndex + 1} = { ${options} }\n  row[2]:createDropDown(options_${widgetIndex + 1}, { startOption = "1", active = true })\n  row[2].handlers.onDropDownConfirmed = function(_, option) menu.emit("${id}", { option = option }) end`;
    }
    if (w.type === 'progressbar') {
      const current = n(props.value, 75);
      const max = Math.max(1, n(props.max, 100));
      return `  row = ftable:addRow(false, {})\n  row[1]:createText("${label}")\n  row[2]:createStatusBar({ current = ${current}, start = ${current}, max = ${max} })`;
    }
    if (w.type === 'chat') {
      return `  row = ftable:addRow(false, {})\n  row[1]:setColSpan(2):createText(menu.transcript or "${label}", { wordwrap = true })`;
    }
    if (w.type === 'table') {
      return `  row = ftable:addRow(false, {})\n  row[1]:setColSpan(2):createText("${label}", Helper.subHeaderTextProperties)\n  row = ftable:addRow(false, {})\n  row[1]:createText("Item")\n  row[2]:createText("Value", { halign = "right" })`;
    }
    return `  row = ftable:addRow(false, {})\n  row[1]:setColSpan(2):createText("${label}", { wordwrap = true })`;
  }).join('\n');

  const widest = activeWidgets.reduce((max, w) => Math.max(max, n(w.w, 0)), 0);
  const frameWidth = Math.max(420, Math.min(1100, Math.round(widest + 120)));
  const frameHeight = Math.max(180, Math.min(900, activeWidgets.length * 56 + 100));
  const autoOpen = activeWidgets.some(w => w.properties?.autoOpen === true);

  return `-- ${workspace.name || modId} — X4 UI extension entry point
-- Packaged at: extensions/${modId}/ui/${modId}.lua
-- Registered by: extensions/${modId}/ui.xml (<environment type="menus">)
-- Generated from the visual designer by X4 Forge. Uses the corpus-backed
-- standalone-menu lifecycle: lazy Helper -> deferred registration -> OpenMenu
-- -> onShowMenu -> createFrameHandle/fTable -> frame:display().

local widgets = {
${widgetLines || '    -- (no widgets authored in the studio yet)'}
}

local Helper = rawget(_G, "Helper")
local function refreshHelper()
  if not Helper then Helper = rawget(_G, "Helper") end
  return Helper
end

local menu = {
  name = "${menuName}",
  layer = 4,
  active = false,
  widgets = widgets,
  transcript = "",
}

local function log(message)
  if DebugError then DebugError("[${luaName}] " .. tostring(message)) end
end

function menu.ensureRegistered()
  refreshHelper()
  _G.Menus = _G.Menus or {}
  local found = false
  for i, existing in ipairs(_G.Menus) do
    if existing.name == menu.name then _G.Menus[i] = menu; found = true; break end
  end
  if not found then table.insert(_G.Menus, menu) end
  if Helper and Helper.registerMenu and not menu._registered then
    local ok = pcall(Helper.registerMenu, menu)
    menu._registered = ok
  end
  return menu._registered == true
end

function menu.open(context)
  menu.context = type(context) == "table" and context or {}
  if not menu.ensureRegistered() then
    if SetScript then SetScript("onUpdate", menu.retryOpen) end
    return false
  end
  if OpenMenu then OpenMenu(menu.name, nil, nil, true)
  elseif menu.onShowMenu then menu.onShowMenu() end
  return true
end

function menu.retryOpen()
  if not menu.ensureRegistered() then return end
  if RemoveScript then RemoveScript("onUpdate", menu.retryOpen) end
  menu.open(menu.context)
end

function menu.onShowMenu()
  refreshHelper()
  menu.active = true
  menu.createFrame()
end

function menu.emit(widgetId, payload)
  if AddUITriggeredEvent then AddUITriggeredEvent(menu.name, widgetId, payload or {}) end
end

function menu.createFrame()
  refreshHelper()
  if not Helper then log("Helper unavailable; frame not built"); return end
  if menu.frame and Helper.clearDataForRefresh then Helper.clearDataForRefresh(menu, menu.layer) end
  local width = Helper.scaleX(${frameWidth})
  local height = Helper.scaleY(${frameHeight})
  local x = ((Helper.viewWidth or 1920) - width) / 2
  local y = ((Helper.viewHeight or 1080) - height) / 2
  menu.frame = Helper.createFrameHandle(menu, { x = x, y = y, width = width, height = height, layer = menu.layer, standardButtons = { close = true } })
  local ftable = menu.frame:addTable(2, { tabOrder = 1, width = width, highlightMode = "off" })
  ftable:setColWidthPercent(1, 55)
  ftable:setColWidthPercent(2, 45)
  local row
${rowLines || '  row = ftable:addRow(false, {})\n  row[1]:setColSpan(2):createText("No active widgets")'}
  menu.frame:display()
end

function menu.cleanup()
  menu.frame = nil
  menu.active = false
end

function menu.close()
  refreshHelper()
  if Helper and Helper.closeMenuAndReturn then Helper.closeMenuAndReturn(menu) end
  menu.cleanup()
end

-- Deliberate opening path for MD/companion Lua: <raise_lua_event name="'${menuName}.open'"/>.
if RegisterEvent then RegisterEvent("${menuName}.open", function(_, context) menu.open(context) end) end
_G["${menuName}"] = menu
${autoOpen ? `
-- The beginner template opts into one visible first result. Ordinary authored menus do not auto-open.
local function autoOpenWhenReady()
  refreshHelper()
  if not Helper then return end
  if RemoveScript then RemoveScript("onUpdate", autoOpenWhenReady) end
  menu.open({ source = "x4_forge_template" })
end
if SetScript then SetScript("onUpdate", autoOpenWhenReady) end
` : ''}

return menu
`;
}

// Validation logic returns specific diagnostics
export interface XMLDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  nodeId?: string;
  category: 'syntax' | 'references' | 'egosoft';
}

export type PackageDiagnostic = XMLDiagnostic & {
  code?: string;
  domain?: string;
  filePath?: string;
  sourceRef?: {
    kind: string;
    id?: string;
    label?: string;
  };
};

export function validateModWorkspace(workspace: ModWorkspace, code: string): XMLDiagnostic[] {
  const diagnostics: XMLDiagnostic[] = [];

  // ──────────────────────────────────────────────────────────────────
  // LAW 1: Script Name — Uppercase, no spaces, non-empty
  // ──────────────────────────────────────────────────────────────────
  // Validate the ACTUAL emitted <mdscript name> — the imported name if preserved, otherwise
  // a sanitized form of the display title. The display title (workspace.name, also used for
  // content.xml) is allowed spaces/punctuation; only the derived script name must be strict.
  // Since the script name is now auto-derived-valid, this only errors on a genuinely bad
  // imported name, and never punishes a human-readable mod title.
  if (!workspace.name) {
    diagnostics.push({
      severity: 'error',
      message: 'Mod Name must not be empty. The <mdscript name="..."> attribute is required by the X4 engine.',
      category: 'syntax'
    });
  } else {
    const mdName = effectiveMdScriptName(workspace);
    if (!/^[A-Za-z]/.test(mdName)) {
      diagnostics.push({
        severity: 'error',
        message: `MD script name "${mdName}" must start with a letter. The X4 MD engine requires <mdscript name="..."> to begin with [A-Z].`,
        category: 'egosoft'
      });
    }
    if (/\s/.test(mdName)) {
      diagnostics.push({
        severity: 'error',
        message: `MD script name "${mdName}" contains spaces. MD script names must not contain spaces so they can be used as references.`,
        category: 'egosoft'
      });
    } else if (!/^[A-Za-z0-9_]+$/.test(mdName)) {
      diagnostics.push({
        severity: 'warning',
        message: 'MD script name contains special characters. Use only alphanumeric characters and underscores (e.g. My_Custom_Script).',
        category: 'syntax'
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Helpers: resolve linked nodes for each cue in the flowchart
  // ──────────────────────────────────────────────────────────────────
  const cueNodes = workspace.nodes.filter(n => n.type === 'cue');

  /** Returns all condition/event nodes linked from a cue's out_cond port */
  function getConditionNodes(cue: MDNode): MDNode[] {
    return workspace.links
      .filter(l => l.sourceNodeId === cue.id && l.sourcePortId === 'out_cond')
      .map(l => workspace.nodes.find(n => n.id === l.targetNodeId))
      .filter((n): n is MDNode => !!n);
  }

  /** Returns the full action chain linked from a cue's out_act port */
  function getActionChain(cue: MDNode): MDNode[] {
    const actions: MDNode[] = [];
    const firstLinks = workspace.links.filter(l => l.sourceNodeId === cue.id && l.sourcePortId === 'out_act');
    firstLinks.forEach(link => {
      let current = workspace.nodes.find(n => n.id === link.targetNodeId);
      const seen = new Set<string>();
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        actions.push(current);
        const next = workspace.links.find(l => l.sourceNodeId === current!.id && l.sourcePortId === 'out_next');
        current = next ? workspace.nodes.find(n => n.id === next.targetNodeId) : undefined;
      }
    });
    return actions;
  }

  // ──────────────────────────────────────────────────────────────────
  // No cues at all
  // ──────────────────────────────────────────────────────────────────
  if (cueNodes.length === 0) {
    diagnostics.push({
      severity: 'warning',
      message: 'No "Mission Cue" nodes on the canvas. An MD script without cues will load but perform no actions.',
      category: 'egosoft'
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // Per-cue validation (MD Laws 1-8)
  // ──────────────────────────────────────────────────────────────────
  const cueNamesSeen = new Set<string>();

  cueNodes.forEach(cue => {
    const cueName = cue.properties.name || cue.id;
    const hasName = !!(cue.properties.name && String(cue.properties.name).trim());
    const conditionNodes = getConditionNodes(cue);
    const actionNodes = getActionChain(cue);

    // ── P3: empty cue name silently falls back to the internal machine id (cue.id) and
    // ships as the cue's <name>. Flag it clearly instead of leaving the user to wonder. ──
    if (!hasName) {
      diagnostics.push({
        severity: 'error',
        message: `Cue has no name — it would ship as the internal id "${cue.id}". Give the cue a name starting with an uppercase letter.`,
        nodeId: cue.id,
        category: 'egosoft'
      });
    }

    // ── LAW 1: Cue name must start with uppercase letter (only when a name is set; an
    // unnamed cue is already covered by the empty-name error above) ──
    if (hasName && !/^[A-Z]/.test(cueName)) {
      diagnostics.push({
        severity: 'error',
        message: `Cue name "${cueName}" must start with an uppercase letter. The X4 engine requires this for all <cue name="..."> attributes.`,
        nodeId: cue.id,
        category: 'egosoft'
      });
    }

    // ── LAW 1: Cue names must be unique within the SCRIPT — a multi-script workspace
    // (imported mod with several md files) carries per-cue `mdScript`, and the same cue
    // name in DIFFERENT scripts is legal (ground truth 2026-07-09: x4_ai_influence ships
    // "State" in both ai_influence_combat and ai_influence_conversation and runs in-game).
    // Scope the uniqueness key by the cue's script so multi-file imports don't cry wolf. ──
    const scriptScope = String((cue.properties as Record<string, unknown> | undefined)?.mdScript ?? '');
    const scopedCueName = `${scriptScope}::${cueName}`;
    if (cueNamesSeen.has(scopedCueName)) {
      diagnostics.push({
        severity: 'error',
        message: `Duplicate cue name "${cueName}"${scriptScope ? ` in script "${scriptScope}"` : ''}. All cue names must be unique within their script file.`,
        nodeId: cue.id,
        category: 'egosoft'
      });
    }
    cueNamesSeen.add(scopedCueName);

    // Classify condition nodes as events vs checks
    const eventNodes = conditionNodes.filter(n => n.xmlTag && n.xmlTag.startsWith('event_'));
    const checkNodes = conditionNodes.filter(n => n.xmlTag && !n.xmlTag.startsWith('event_') && n.type !== 'cue');
    // Custom events/conditions: classify by type
    const customEventNodes = conditionNodes.filter(n => n.xmlTag === 'custom_event');
    const customConditionNodes = conditionNodes.filter(n => n.xmlTag === 'custom_condition');
    const allEventLike = [...eventNodes, ...customEventNodes];
    const allCheckLike = [...checkNodes, ...customConditionNodes];
    const hasEvents = allEventLike.length > 0;
    const hasChecks = allCheckLike.length > 0;
    const hasConditions = conditionNodes.length > 0;

    // ── LAW 3: Event conditions must come first in conditions block ──
    if (hasEvents && hasChecks && conditionNodes.length > 0) {
      const firstNode = conditionNodes[0];
      const isFirstAnEvent = firstNode.xmlTag?.startsWith('event_') || firstNode.xmlTag === 'custom_event';
      if (!isFirstAnEvent) {
        diagnostics.push({
          severity: 'error',
          message: `Cue "${cueName}": Event conditions must be the FIRST condition wired to the cue, but a check/condition node is wired first. Re-order the out_cond links so the event node comes first.`,
          nodeId: cue.id,
          category: 'egosoft'
        });
      }
    }

    // ── LAW 5: Non-event cues with only checks MUST have onfail or checkinterval ──
    // A custom_condition imported from XML can embed events inside a check_any/check_all
    // wrapper (e.g. <check_any><event_game_loaded/></check_any>) — it collapses to ONE
    // node whose rawXml carries the event. Such a cue IS event-driven, so it must not be
    // flagged as check-only. Detect embedded events in any condition node's rawXml.
    const conditionEmbedsEvent = conditionNodes.some(n =>
      /<(?:event_|custom_event\b)/.test(String(n.properties?.rawXml ?? '')),
    );
    if (hasConditions && !hasEvents && hasChecks && !conditionEmbedsEvent) {
      const hasOnfail = cue.properties.onfail && cue.properties.onfail.trim().length > 0;
      const hasCheckinterval = cue.properties.checkinterval && cue.properties.checkinterval.trim().length > 0;
      if (!hasOnfail && !hasCheckinterval) {
        diagnostics.push({
          severity: 'error',
          message: `Cue "${cueName}" has check-only conditions (no events) but is missing "onfail" or "checkinterval" attribute. The X4 engine requires one of these to know how often to re-evaluate.`,
          nodeId: cue.id,
          category: 'egosoft'
        });
      }
    }

    // ── LAW 6: Event-based cues must NOT use onfail, checkinterval, or checktime ──
    if (hasEvents) {
      const forbiddenAttrs: string[] = [];
      if (cue.properties.onfail && cue.properties.onfail.trim().length > 0) forbiddenAttrs.push('onfail');
      if (cue.properties.checkinterval && cue.properties.checkinterval.trim().length > 0) forbiddenAttrs.push('checkinterval');
      if (cue.properties.checktime && cue.properties.checktime.trim().length > 0) forbiddenAttrs.push('checktime');
      if (forbiddenAttrs.length > 0) {
        diagnostics.push({
          severity: 'error',
          message: `Cue "${cueName}" uses event conditions but has forbidden attributes: ${forbiddenAttrs.join(', ')}. Event-based cues must NOT use onfail, checkinterval, or checktime.`,
          nodeId: cue.id,
          category: 'egosoft'
        });
      }
    }

    // ── LAW 7: Safe instantiation — only on event-based cues ──
    // (events embedded in an imported check_any custom_condition count — see LAW 5)
    if (cue.properties.instantiate === 'true' && !hasEvents && !conditionEmbedsEvent) {
      diagnostics.push({
        severity: 'warning',
        message: `Cue "${cueName}" uses instantiate="true" but has no event conditions. Instantiation on check-only or unconditional cues can cause memory leaks. Use events or remove instantiate.`,
        nodeId: cue.id,
        category: 'egosoft'
      });
    }

    // ── LAW 8: No reset_cue on instantiated cues ──
    if (cue.properties.instantiate === 'true') {
      const hasResetSelf = actionNodes.some(n => {
        if (n.xmlTag === 'custom_xml' && n.properties.rawXml) {
          return /reset_cue\s+cue="this"/i.test(n.properties.rawXml);
        }
        return false;
      });
      if (hasResetSelf) {
        diagnostics.push({
          severity: 'error',
          message: `Cue "${cueName}" uses instantiate="true" and contains <reset_cue cue="this" />. Resetting an instantiated cue stops it forever. Use a static cue with reset_cue instead.`,
          nodeId: cue.id,
          category: 'egosoft'
        });
      }
    }

    // ── Flowchart wiring: warn if cue has no conditions AND no actions ──
    if (conditionNodes.length === 0 && actionNodes.length === 0) {
      // Not an error — an unconditional cue with sub-cues is valid
      const hasSubCues = workspace.links.some(l => l.sourceNodeId === cue.id && l.sourcePortId === 'out_sub');
      if (!hasSubCues) {
        diagnostics.push({
          severity: 'info',
          message: `Cue "${cueName}" has no event/condition or action nodes wired. It will fire unconditionally with no effects. Wire condition/action nodes or add sub-cues.`,
          nodeId: cue.id,
          category: 'egosoft'
        });
      }
    }

    // ── Flowchart wiring: warn if conditions exist but no actions ──
    if (conditionNodes.length > 0 && actionNodes.length === 0) {
      const hasSubCues = workspace.links.some(l => l.sourceNodeId === cue.id && l.sourcePortId === 'out_sub');
      if (!hasSubCues) {
        diagnostics.push({
          severity: 'warning',
          message: `Cue "${cueName}" has trigger conditions wired but no action nodes. The cue will fire but do nothing. Wire action nodes to the out_act port.`,
          nodeId: cue.id,
          category: 'egosoft'
        });
      }
    }

    // ── LAW 2: Namespace scoping — warn if no namespace set ──
    if (!cue.properties.namespace || cue.properties.namespace.trim().length === 0) {
      diagnostics.push({
        severity: 'info',
        message: `Cue "${cueName}" has no namespace set. Consider setting namespace="this" to scope variables locally and prevent collisions.`,
        nodeId: cue.id,
        category: 'egosoft'
      });
    }
  });

  // ──────────────────────────────────────────────────────────────────
  // Orphan node detection — nodes not wired to any cue
  // ──────────────────────────────────────────────────────────────────
  const nonCueNodes = workspace.nodes.filter(n => n.type !== 'cue');
  nonCueNodes.forEach(node => {
    const isTargetOfAnyLink = workspace.links.some(l => l.targetNodeId === node.id);
    if (!isTargetOfAnyLink) {
      diagnostics.push({
        severity: 'warning',
        message: `${node.label || node.xmlTag || node.type} node "${node.id}" is not wired to any cue. It will be ignored during XML compilation.`,
        nodeId: node.id,
        category: 'references'
      });
    }
  });

  // ──────────────────────────────────────────────────────────────────
  // XML structural balance check
  // ──────────────────────────────────────────────────────────────────
  const matches = [...code.matchAll(/<([a-zA-Z_]+)(?:\s+[^>]*[^/>])?>$/gm)];
  const closers = [...code.matchAll(/<\/([a-zA-Z_]+)>/g)];

  if (matches.length > closers.length + code.split('/>').length - 1) {
    diagnostics.push({
      severity: 'info',
      message: 'Verified structural balance. XML contains self-terminating nested elements.',
      category: 'syntax'
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // UI widget size constraints
  // ──────────────────────────────────────────────────────────────────
  const tables = workspace.uiWidgets.filter(w => w.type === 'table');
  tables.forEach(table => {
    if (table.w < 200 || table.h < 100) {
      diagnostics.push({
        severity: 'warning',
        message: `Table dimensions for "${table.label}" are extremely small. X4 engine might truncate contents.`,
        category: 'egosoft'
      });
    }
  });

  return diagnostics;
}

// Preset samples to populate workspace instantly
export const PRESETS: Record<string, { name: string; desc: string; workspace: Omit<ModWorkspace, 'id'> }> = {
  escort: {
    name: "Elite Fighter Wing Escort",
    desc: "Spawns an Elite Vanguard fighter wing protecting the player when the game is loaded.",
    workspace: {
      name: "Player_Elite_Escort",
      version: "1.2.0",
      author: "EliteModder",
      description: "Automatically equips the user playership with heavy wing escorts on game entry.",
      nodes: [
        {
          id: "cue_0",
          type: "cue",
          label: "Mission Cue",
          xmlTag: "cue",
          x: 100,
          y: 100,
          properties: { name: "Escort_Trigger_Cue", instantiate: "true", namespace: "this", state: "active" },
          propertiesSchema: NODE_TEMPLATES[0].propertiesSchema,
          inputs: NODE_TEMPLATES[0].inputs,
          outputs: NODE_TEMPLATES[0].outputs
        },
        {
          id: "event_0",
          type: "event",
          label: "Event: Game Started",
          xmlTag: "event_cue_signalled",
          x: 100,
          y: 400,
          properties: { cue: "md.Setup.Start" },
          propertiesSchema: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'event_cue_signalled')].propertiesSchema,
          inputs: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'event_cue_signalled')].inputs,
          outputs: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'event_cue_signalled')].outputs
        },
        {
          id: "action_0",
          type: "action",
          label: "Spawn Ship",
          xmlTag: "create_ship",
          x: 450,
          y: 150,
          properties: {
            name: "$MyHeavyEscort",
            macro: "ship_arg_s_fighter_01_a_macro (Elite Vanguard)",
            faction: "player",
            sector: "player.sector",
            coords: "0,500,-1000"
          },
          propertiesSchema: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'create_ship')].propertiesSchema,
          inputs: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'create_ship')].inputs,
          outputs: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'create_ship')].outputs
        },
        {
          id: "action_1",
          type: "action",
          label: "Reward Player",
          xmlTag: "reward_player",
          x: 750,
          y: 150,
          properties: {
            money: 50000,
            notification: "true",
            standing: "0.02",
            faction: "argon"
          },
          propertiesSchema: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'reward_player')].propertiesSchema,
          inputs: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'reward_player')].inputs,
          outputs: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'reward_player')].outputs
        }
      ],
      links: [
        { id: "l0", sourceNodeId: "cue_0", sourcePortId: "out_cond", targetNodeId: "event_0", targetPortId: "in_cond" },
        { id: "l1", sourceNodeId: "cue_0", sourcePortId: "out_act", targetNodeId: "action_0", targetPortId: "in_act" },
        { id: "l2", sourceNodeId: "action_0", sourcePortId: "out_next", targetNodeId: "action_1", targetPortId: "in_act" }
      ],
      uiWidgets: [
        { id: "w_0", type: "window", x: 100, y: 100, w: 600, h: 400, label: "Escort Fleet Terminal", properties: {} },
        { id: "w_1", type: "header", x: 120, y: 150, w: 560, h: 40, label: "TACTICAL FLIGHT OPS", properties: {} },
        { id: "w_2", type: "progressbar", x: 120, y: 220, w: 560, h: 30, label: "Escort Integrity", properties: { value: 92, progressColor: "#00ccff" } },
        { id: "w_3", type: "button", x: 120, y: 300, w: 260, h: 50, label: "Signal Escort Jump", properties: { action: "signal_cue", targetCue: "Escort_Trigger_Cue" } },
        { id: "w_4", type: "button", x: 420, y: 300, w: 260, h: 50, label: "Dismiss Pilots", properties: { action: "dismiss", targetCue: "Escort_Trigger_Cue" } }
      ],
      uiTheme: {
        backgroundColor: "#111827",
        borderColor: "#df9825",
        accentColor: "#f59e0b",
        opacity: 0.9,
        showIcons: true
      }
    }
  },
  mission: {
    name: "Sector Intruder Bounty System",
    desc: "Rewards standing and major credit bonuses dynamically when defending argon sectors.",
    workspace: {
      name: "Argon_Sector_Bounty",
      version: "1.0.1",
      author: "StarCaptain",
      description: "Generates bounty and standing gains on entering border zones and destroying faction outcasts.",
      nodes: [
        {
          id: "cue_0",
          type: "cue",
          label: "Mission Cue",
          xmlTag: "cue",
          x: 100,
          y: 100,
          properties: { name: "Bounty_Active_Cue", instantiate: "true", namespace: "this", state: "active" },
          propertiesSchema: NODE_TEMPLATES[0].propertiesSchema,
          inputs: NODE_TEMPLATES[0].inputs,
          outputs: NODE_TEMPLATES[0].outputs
        },
        {
          id: "event_0",
          type: "event",
          label: "Event: Sector Entered",
          xmlTag: "event_object_changed_sector",
          x: 100,
          y: 400,
          properties: { object: "playership", sector: "player.sector" },
          propertiesSchema: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'event_object_changed_sector')].propertiesSchema,
          inputs: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'event_object_changed_sector')].inputs,
          outputs: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'event_object_changed_sector')].outputs
        },
        {
          id: "action_0",
          type: "action",
          label: "Play Audio/Sound",
          xmlTag: "play_sound",
          x: 450,
          y: 150,
          properties: { object: "playership", sound: "incoming_transmission" },
          propertiesSchema: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'play_sound')].propertiesSchema,
          inputs: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'play_sound')].inputs,
          outputs: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'play_sound')].outputs
        },
        {
          id: "action_1",
          type: "action",
          label: "Show Briefing",
          xmlTag: "show_help",
          x: 750,
          y: 150,
          properties: { text: "Argon Command: Active combat bounties are online for this sector!", duration: 6 },
          propertiesSchema: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'show_help')].propertiesSchema,
          inputs: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'show_help')].inputs,
          outputs: NODE_TEMPLATES[NODE_TEMPLATES.findIndex(t => t.xmlTag === 'show_help')].outputs
        }
      ],
      links: [
        { id: "l0", sourceNodeId: "cue_0", sourcePortId: "out_cond", targetNodeId: "event_0", targetPortId: "in_cond" },
        { id: "l1", sourceNodeId: "cue_0", sourcePortId: "out_act", targetNodeId: "action_0", targetPortId: "in_act" },
        { id: "l2", sourceNodeId: "action_0", sourcePortId: "out_next", targetNodeId: "action_1", targetPortId: "in_act" }
      ],
      uiWidgets: [
        { id: "w_0", type: "window", x: 50, y: 50, w: 800, h: 500, label: "COMMUNITY SERVICE INTERPRETER", properties: {} },
        { id: "w_1", type: "header", x: 80, y: 100, w: 740, h: 40, label: "BOUNTY SYSTEM HUB", properties: {} },
        { id: "w_2", type: "table", x: 80, y: 160, w: 740, h: 180, label: "Argon Defence Commissions", properties: {} },
        { id: "w_3", type: "progressbar", x: 80, y: 360, w: 400, h: 30, label: "Standing Progress", properties: { value: 65, progressColor: "#10b981" } },
        { id: "w_4", type: "text", x: 500, y: 360, w: 320, h: 30, label: "Tier: Argon Hero (+24)", properties: { fontSize: "medium", alignment: "right" } },
        { id: "w_5", type: "button", x: 80, y: 420, w: 350, h: 50, label: "Check Sector Standing", properties: { action: "standing", targetCue: "Bounty_Active_Cue" } },
        { id: "w_6", type: "button", x: 470, y: 420, w: 350, h: 50, label: "Claim Rewards", properties: { action: "claim", targetCue: "Bounty_Active_Cue" } }
      ],
      uiTheme: {
        backgroundColor: "#0d0e15",
        borderColor: "#10b981",
        accentColor: "#10b981",
        opacity: 0.95,
        showIcons: true
      }
    }
  }
};

export function sanitizeWorkspace(ws: any): ModWorkspace {
  if (!ws || typeof ws !== 'object') {
    return {
      id: `workspace_${Date.now()}`,
      name: 'X4_My_Custom_Mod',
      version: '1.0.0',
      author: 'Space_Pilot',
      description: 'Custom script developed using X4 Forge visual nodes generator',
      nodes: [],
      links: [],
      uiWidgets: [],
      uiTheme: {
        backgroundColor: '#0F1115',
        borderColor: '#06b6d4',
        accentColor: '#0891b2',
        opacity: 0.95,
        showIcons: true
      },
      templates: []
    };
  }

  const sanitizedNodes = (Array.isArray(ws.nodes) ? ws.nodes : []).map((node: any) => {
    if (!node || typeof node !== 'object') return null;
    
    // Find matching template by xmlTag or fallback to standard mapping
    let template = NODE_TEMPLATES.find(t => t.xmlTag === node.xmlTag);
    // Only fall back to a same-TYPE curated template when the node carries NO schema of its
    // own. Schema-driven nodes (the full md.xsd vocabulary) have no curated xmlTag match but
    // DO carry their own propertiesSchema; without this guard the fallback clobbered them with
    // the first curated template of that type (e.g. an event node got event_cue_signalled's
    // lone "cue" field), discarding their real attributes and reference pickers.
    if (!template && !Array.isArray(node.propertiesSchema)) {
      template = NODE_TEMPLATES.find(t => t.type === node.type);
    }
    
    return {
      id: node.id || `node_${Math.random().toString(36).substr(2, 9)}`,
      type: node.type || (template ? template.type : 'action'),
      xmlTag: node.xmlTag || (template ? template.xmlTag : 'create_ship'),
      label: node.label || (template ? template.label : 'MD Node'),
      x: typeof node.x === 'number' ? node.x : 100,
      y: typeof node.y === 'number' ? node.y : 100,
      properties: node.properties || (template ? { ...template.properties } : {}),
      // propertiesSchema is derived from the node's xmlTag (it's presentation, not user data),
      // so always re-hydrate it from the current template when one exists. This lets template
      // improvements (e.g. live object-index reference pickers) reach existing nodes on load,
      // not just newly created ones; fall back to the node's own schema only if no template.
      // C2-capstone fix: only adopt a template's schema when it's genuinely the SAME tag.
      // A same-TYPE fallback template (used for label/port defaults on bare API nodes)
      // must not impose its schema — renderGenericXMLNode filters attributes through the
      // schema keys, so a wrong schema silently drops every property (observed:
      // API-built debug_text nodes emitted as <debug_text /> because they wore
      // create_ship's schema). With no matching-tag template, keep the node's own
      // schema (or none — the renderer then falls back to Object.keys(properties)).
      propertiesSchema: ((template && template.xmlTag === (node.xmlTag || template.xmlTag)) ? template.propertiesSchema : node.propertiesSchema) || [],
      inputs: node.inputs || (template ? template.inputs : []),
      outputs: node.outputs || (template ? template.outputs : []),
      includeInBuild: typeof node.includeInBuild === 'boolean' ? node.includeInBuild : true
      ,...(node.source && typeof node.source.path === 'string' && typeof node.source.semanticPath === 'string'
        && Number.isInteger(node.source.start) && Number.isInteger(node.source.end) ? {
          source: {
            path: String(node.source.path).replace(/\\/g, '/').replace(/^\/+/, ''),
            semanticPath: String(node.source.semanticPath),
            start: Number(node.source.start),
            end: Number(node.source.end),
            modeled: node.source.modeled !== false,
          }
        } : {})
    };
  }).filter((n): n is MDNode => n !== null);

  const sanitizedWidgets = (Array.isArray(ws.uiWidgets) ? ws.uiWidgets : []).map((w: any) => ({
    ...w,
    includeInBuild: typeof w.includeInBuild === 'boolean' ? w.includeInBuild : true
  }));

  return {
    id: ws.id || `workspace_${Date.now()}`,
    name: ws.name || 'X4_My_Custom_Mod',
    version: ws.version || '1.0.0',
    author: ws.author || 'Space_Pilot',
    description: ws.description || '',
    ...(ws.mdScriptName ? { mdScriptName: ws.mdScriptName } : {}),
    ...(ws.mdFileStem ? { mdFileStem: ws.mdFileStem } : {}),
    ...(ws.sourceFolder ? { sourceFolder: ws.sourceFolder } : {}),
    ...(Array.isArray(ws.dependencies) && ws.dependencies.length ? { dependencies: ws.dependencies } : {}),
    ...(ws.contentId ? { contentId: ws.contentId } : {}),
    ...(ws.mdOriginal && ws.mdOriginal.content ? { mdOriginal: ws.mdOriginal } : {}),
    ...(ws.contentOriginal ? { contentOriginal: ws.contentOriginal } : {}),
    originalFiles: (Array.isArray(ws.originalFiles) ? ws.originalFiles : [])
      .filter((f: any) => f && typeof f.path === 'string' && typeof f.content === 'string')
      .map((f: any) => ({
        path: String(f.path).replace(/\\/g, '/').replace(/^\/+/, ''),
        content: String(f.content),
        kind: ['content', 'md', 'tfile', 'readme'].includes(f.kind) ? f.kind : 'readme',
        ...(typeof f.fingerprint === 'string' ? { fingerprint: f.fingerprint } : {}),
        ...(typeof f.stem === 'string' ? { stem: f.stem } : {}),
        ...(typeof f.graphRegenerable === 'boolean' ? { graphRegenerable: f.graphRegenerable } : {})
      })),
    nodes: sanitizedNodes,
    links: Array.isArray(ws.links) ? ws.links : [],
    uiWidgets: sanitizedWidgets,
    uiTheme: {
      backgroundColor: ws.uiTheme?.backgroundColor || '#0F1115',
      borderColor: ws.uiTheme?.borderColor || '#06b6d4',
      accentColor: ws.uiTheme?.accentColor || '#0891b2',
      opacity: typeof ws.uiTheme?.opacity === 'number' ? ws.uiTheme.opacity : 0.95,
      showIcons: typeof ws.uiTheme?.showIcons === 'boolean' ? ws.uiTheme.showIcons : true
    },
    tFiles: (Array.isArray(ws.tFiles) ? ws.tFiles : []).map((tf: any) => ({
      ...tf,
      includeInBuild: typeof tf.includeInBuild === 'boolean' ? tf.includeInBuild : true
    })),
    aiScripts: (Array.isArray(ws.aiScripts) ? ws.aiScripts : []).map((as: any) => ({
      ...as,
      includeInBuild: typeof as.includeInBuild === 'boolean' ? as.includeInBuild : true
    })),
    wares: (Array.isArray(ws.wares) ? ws.wares : []).map((w: any) => ({
      ...w,
      includeInBuild: typeof w.includeInBuild === 'boolean' ? w.includeInBuild : true
    })),
    jobs: (Array.isArray(ws.jobs) ? ws.jobs : []).map((j: any) => ({
      ...j,
      includeInBuild: typeof j.includeInBuild === 'boolean' ? j.includeInBuild : true
    })),
    xmlPatches: (Array.isArray(ws.xmlPatches) ? ws.xmlPatches : []).map((xp: any) => ({
      ...xp,
      includeInBuild: typeof xp.includeInBuild === 'boolean' ? xp.includeInBuild : true
    })),
    compileSettings: {
      md: typeof ws.compileSettings?.md === 'boolean' ? ws.compileSettings.md : true,
      ui: typeof ws.compileSettings?.ui === 'boolean' ? ws.compileSettings.ui : true,
      ai: typeof ws.compileSettings?.ai === 'boolean' ? ws.compileSettings.ai : true,
      library: typeof ws.compileSettings?.library === 'boolean' ? ws.compileSettings.library : true,
      translations: typeof ws.compileSettings?.translations === 'boolean' ? ws.compileSettings.translations : true,
      patches: typeof ws.compileSettings?.patches === 'boolean' ? ws.compileSettings.patches : true
    },
    templates: (Array.isArray(ws.templates) ? ws.templates : []).map((tNode: any) => ({
      ...tNode,
      includeInBuild: false // Templates must remain non-compilable by definition!
    })),
    integrationContract: ws.integrationContract && typeof ws.integrationContract === 'object'
      ? {
          namespace: String(ws.integrationContract.namespace || ''),
          baseUrl: String(ws.integrationContract.baseUrl || ''),
          httpClientExpr: ws.integrationContract.httpClientExpr ? String(ws.integrationContract.httpClientExpr) : undefined,
          jsonLibExpr: ws.integrationContract.jsonLibExpr ? String(ws.integrationContract.jsonLibExpr) : undefined,
          endpoints: Array.isArray(ws.integrationContract.endpoints)
            ? ws.integrationContract.endpoints.map((ep: any) => ({
                ...ep,
                fileBridge: ep?.fileBridge && typeof ep.fileBridge === 'object'
                  ? {
                      directory: ep.fileBridge.directory ? String(ep.fileBridge.directory) : undefined,
                      requestFile: ep.fileBridge.requestFile ? String(ep.fileBridge.requestFile) : undefined,
                      responseFile: ep.fileBridge.responseFile ? String(ep.fileBridge.responseFile) : undefined,
                      pollInterval: ep.fileBridge.pollInterval ? String(ep.fileBridge.pollInterval) : undefined,
                      timeout: ep.fileBridge.timeout ? String(ep.fileBridge.timeout) : undefined
                    }
                  : undefined
              }))
            : []
        }
      : undefined,
    customLua: typeof ws.customLua === 'string' ? ws.customLua : undefined,
    sourceStamp: (ws.sourceStamp && typeof ws.sourceStamp.dir === 'string' && typeof ws.sourceStamp.hash === 'string')
      ? { dir: String(ws.sourceStamp.dir), hash: String(ws.sourceStamp.hash), at: String(ws.sourceStamp.at || '') }
      : undefined,
    passthroughFiles: (Array.isArray(ws.passthroughFiles) ? ws.passthroughFiles : [])
      .filter((f: any) => f && typeof f.path === 'string' && (typeof f.content === 'string' || f.omitted === true))
      .map((f: any) => ({
        path: String(f.path).replace(/\\/g, '/').replace(/^\/+/, ''),
        ...(typeof f.content === 'string' ? { content: String(f.content) } : {}),
        reason: ['unknown_domain', 'unparsed', 'binary', 'partial', 'too_large'].includes(f.reason) ? f.reason : 'unknown_domain',
        ...(f.omitted === true ? { omitted: true } : {}),
        ...(Number.isFinite(Number(f.bytes)) ? { bytes: Number(f.bytes) } : {})
      }))
  };
}
