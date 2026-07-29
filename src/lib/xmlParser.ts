/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DOMParser as XmlDomParser, XMLSerializer as XmlDomSerializer } from '@xmldom/xmldom';
import { ModWorkspace, MDNode, MDLink, NODE_TEMPLATES, X4_SHIP_MACROS, X4_STATION_MACROS } from '../types';
import { isContainerTag } from './portSemantics';

function elementChildrenOf(node: any): Element[] {
  return Array.from(node?.childNodes || []).filter((child: any) => child?.nodeType === 1) as Element[];
}
import { checkXmlWellformed } from './xmlWellformed';
import { assertXmlInputWithinLimits } from './xmlInputLimits';
import { indexXmlElementSpans, xmlElementSemanticPath } from './xmlSourceSpans';

const DOMParserToUse = typeof window !== 'undefined' && window.DOMParser ? window.DOMParser : XmlDomParser;
const XMLSerializerToUse = typeof window !== 'undefined' && window.XMLSerializer ? window.XMLSerializer : XmlDomSerializer;

let schemaTemplatesByTag = new Map<string, Omit<MDNode, 'id' | 'x' | 'y'>>();

export function setSchemaTemplatesForImport(templates: Omit<MDNode, 'id' | 'x' | 'y'>[]) {
  schemaTemplatesByTag = new Map((templates || []).map(template => [template.xmlTag, template]));
}

function attributesToProperties(element: Element): Record<string, any> {
  return Array.from(element.attributes).reduce<Record<string, any>>((props, attr) => {
    props[attr.name] = attr.value;
    return props;
  }, {});
}

function stripMacroPrefix(value: string): string {
  return String(value || '').replace(/^macro\./, '');
}

function stripFactionPrefix(value: string): string {
  return String(value || '').replace(/^faction\./, '');
}

function matchOption(options: string[], value: string): string {
  const clean = stripMacroPrefix(value);
  return options.find(option => option.startsWith(clean)) || clean || value;
}

function parseCheckValueProperties(element: Element): Record<string, any> {
  const value = element.getAttribute("value") || 'player.money';
  const exact = element.getAttribute("exact");
  const min = element.getAttribute("min");
  const max = element.getAttribute("max");
  const list = element.getAttribute("list");

  if (exact !== null) return { value, comparison: 'exact', amount: Number(exact) || exact };
  if (min !== null) return { value, comparison: 'min', amount: Number(min) || min };
  if (max !== null) return { value, comparison: 'max', amount: Number(max) || max };
  if (list !== null) return { value, comparison: 'list', list };

  const oldOperator = element.getAttribute("operator");
  const oldValue2 = element.getAttribute("value2");
  if (oldOperator || oldValue2) {
    const comparison = oldOperator === 'le' || oldOperator === 'lt'
      ? 'max'
      : oldOperator === 'eq' || oldOperator === 'exact'
        ? 'exact'
        : 'min';
    return { value, comparison, amount: Number(oldValue2) || oldValue2 || 1000000 };
  }

  return { value, comparison: 'expression' };
}

// Parser: Egosoft XML script mapping to visual flowchart nodegraph
/**
 * Extract every TOP-LEVEL <cue>/<library> from an mdscript as verbatim XML. Used by the
 * lossless generic-cue fallback: when a file can't be decomposed into typed nodes, each cue
 * is preserved whole as a custom_xml_cue node — so the import never falls back to passthrough.
 */
export function extractTopLevelCueXml(xmlText: string): { name: string; xml: string }[] {
  try {
    const parser = new DOMParserToUse();
    const doc = parser.parseFromString(xmlText, 'text/xml') as unknown as Document;
    const md = doc.getElementsByTagName('mdscript')[0];
    if (!md) return [];
    const ser = new XMLSerializerToUse();
    const out: { name: string; xml: string }[] = [];
    const cuesEls = (Array.from((md as any).childNodes || []) as any[]).filter((n: any) => n && n.nodeType === 1 && n.tagName === 'cues');
    for (const cuesEl of cuesEls) {
      for (const ch of Array.from((cuesEl as any).childNodes || []) as any[]) {
        if (ch && ch.nodeType === 1 && (ch.tagName === 'cue' || ch.tagName === 'library')) {
          out.push({ name: ch.getAttribute('name') || 'Cue', xml: ser.serializeToString(ch) });
        }
      }
    }
    return out;
  } catch { return []; }
}

export function parseXMLToWorkspace(xmlText: string, options: { path?: string } = {}): ModWorkspace | null {
  try {
    assertXmlInputWithinLimits(xmlText);
    // Well-formedness gate FIRST. @xmldom/xmldom (the Node-side parser) does not emit a
    // <parsererror> element for a mismatched/unclosed tag — it warns and returns a partial
    // tree — so a malformed file (e.g. <do_if>…</do_elseif>, which X4 rejects on load) would
    // otherwise import "successfully". This deterministic scan closes that gap on both host
    // and browser. (The browser DOMParser parsererror check below stays as a backstop.)
    const wf = checkXmlWellformed(xmlText);
    if (!wf.ok) {
      const first = wf.errors.slice(0, 3).map((e) => `${e.message} (line ${e.line}, col ${e.col})`).join('; ');
      throw new Error(`Malformed XML — not well-formed: ${first}`);
    }

    const parser = new DOMParserToUse();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml") as unknown as Document;

    const parserError = xmlDoc.getElementsByTagName("parsererror");
    if (parserError.length > 0) {
      throw new Error("Malformatted XML script syntax.");
    }

    const mdscript = xmlDoc.getElementsByTagName("mdscript")[0];
    if (!mdscript) {
      throw new Error("Missing main root <mdscript> node.");
    }

    const modName = mdscript.getAttribute("name") || "Parsed_X4_Mod";
    // Treat <library> as a cue variant so reusable-subroutine cues model + round-trip like
    // any other cue. Collect <cue> and <library> in DOCUMENT ORDER (not cues-then-libraries)
    // so the regenerated MD preserves the author's top-level ordering — required for the
    // byte-fidelity (emit-original-when-unedited) path.
    const cuesList: any[] = [];
    const walkCueLike = (node: any) => {
      const kids = (node && node.childNodes) ? Array.from(node.childNodes) : [];
      for (const ch of kids as any[]) {
        if (ch && ch.nodeType === 1) {
          if (ch.tagName === "cue" || ch.tagName === "library") cuesList.push(ch);
          walkCueLike(ch);
        }
      }
    };
    walkCueLike(mdscript);
    
    const nodes: MDNode[] = [];
    const links: MDLink[] = [];
    
    const elementToId = new Map<Element, string>();
    const cueDepth = new Map<Element, number>();
    const depthCounts = new Map<number, number>();
    
    function getDepth(el: Element): number {
      if (cueDepth.has(el)) return cueDepth.get(el)!;
      let depth = 0;
      let parent = el.parentElement;
      while (parent) {
        if (parent.tagName === "cue") {
          depth += 1;
        }
        parent = parent.parentElement;
      }
      cueDepth.set(el, depth);
      return depth;
    }

    const serializer = new XMLSerializerToUse();
    const indexedSpans = options.path ? indexXmlElementSpans(xmlText) : null;
    const sourceForElement = (element: Element, modeled = true): MDNode['source'] | undefined => {
      if (!indexedSpans || !options.path) return undefined;
      const semanticPath = xmlElementSemanticPath(element);
      const span = indexedSpans.get(semanticPath);
      return span ? { path: options.path.replace(/\\/g, '/'), semanticPath, start: span.start, end: span.end, modeled } : undefined;
    };

    // Pass 1: Parse all cues
    for (let i = 0; i < cuesList.length; i++) {
      const cue = cuesList[i];
      const name = cue.getAttribute("name") || `cue_${i}`;
      const instantiate = cue.getAttribute("instantiate") || "false";
      const namespace = cue.getAttribute("namespace") || "this";
      const cueAttributes = attributesToProperties(cue);

      // <delay> (md.xsd cue order: conditions, delay, actions) — model as editable cue
      // fields so timed cues round-trip instead of silently losing their timer.
      const delayEl = elementChildrenOf(cue).find((c: Element) => c.tagName === 'delay');
      const delayProps: Record<string, any> = delayEl ? {
        delayExact: delayEl.getAttribute('exact') || '',
        delayMin: delayEl.getAttribute('min') || '',
        delayMax: delayEl.getAttribute('max') || '',
      } : {};
      const cueChildren = elementChildrenOf(cue);
      const bodyIndexes = cueChildren
        .map((child, index) => ['conditions', 'delay', 'actions'].includes(child.tagName) ? index : -1)
        .filter(index => index >= 0);
      const firstBodyIndex = bodyIndexes.length ? Math.min(...bodyIndexes) : Number.MAX_SAFE_INTEGER;
      const cueHeaderXml = cueChildren
        .filter((child, index) => !['conditions', 'delay', 'actions', 'cues'].includes(child.tagName) && index < firstBodyIndex)
        .map((child: Element) => serializer.serializeToString(child as any))
        .join('\n');
      const cueTailXml = cueChildren
        .filter((child, index) => !['conditions', 'delay', 'actions', 'cues'].includes(child.tagName) && index >= firstBodyIndex)
        .map((child: Element) => serializer.serializeToString(child as any))
        .join('\n');

      // <library> = a reusable-subroutine cue variant. Preserve its <documentation>/<params>
      // header verbatim; its <actions> flow through the normal action parser as editable boxes.
      const isLibrary = cue.tagName === 'library';
      const libProps: Record<string, any> = {};
      if (isLibrary) {
        const paramsEl = elementChildrenOf(cue).find((c: Element) => c.tagName === 'params');
        const docEl = elementChildrenOf(cue).find((c: Element) => c.tagName === 'documentation');
        libProps.isLibrary = 'true';
        // A library invoked via <run_actions ref="..."> REQUIRES purpose="run_actions" — the X4
        // engine refuses to run a purposeless library's actions ("library requires purpose
        // 'run_actions'"). Capture it so the node round-trip never drops it.
        const purpose = cue.getAttribute('purpose');
        if (purpose) libProps.libPurpose = purpose;
        libProps.libParamsXml = paramsEl ? serializer.serializeToString(paramsEl as any) : '';
        libProps.libDocXml = docEl ? serializer.serializeToString(docEl as any) : '';
      }

      const cueId = `cue_${Date.now()}_${i}`;
      elementToId.set(cue, cueId);
      
      const depth = getDepth(cue);
      const count = depthCounts.get(depth) || 0;
      depthCounts.set(depth, count + 1);
      
      // Separate Cues widely to prevent overlap (since we have flowchart nodes inside)
      const x = 100 + depth * 1500;
      const y = 80 + count * 450;

      const cueNode: MDNode = {
        id: cueId,
        type: 'cue',
        label: isLibrary
          ? `Library: ${cue.getAttribute("name") || name}`
          : (cue.getAttribute("name") ? `Cue: ${cue.getAttribute("name")}` : 'Mission Cue'),
        xmlTag: 'cue',
        x,
        y,
        properties: {
          ...cueAttributes, name, instantiate, namespace, mdScript: modName, ...delayProps, ...libProps,
          hasConditionsElement: cueChildren.some(child => child.tagName === 'conditions'),
          hasActionsElement: cueChildren.some(child => child.tagName === 'actions'),
          ...(cueHeaderXml ? { cueHeaderXml } : {}),
          ...(cueTailXml ? { cueTailXml } : {}),
        },
        propertiesSchema: NODE_TEMPLATES[0].propertiesSchema,
        inputs: NODE_TEMPLATES[0].inputs,
        outputs: NODE_TEMPLATES[0].outputs
        ,source: sourceForElement(cue, cue.getAttribute('data-x4forge-opaque') !== 'true')
      };
      
      nodes.push(cueNode);
    }
    
    // Pass 2: Reconstruct parent-child cue links (out_sub ➔ in_flow)
    for (let i = 0; i < cuesList.length; i++) {
      const cue = cuesList[i];
      const cueId = elementToId.get(cue);
      if (!cueId) continue;
      
      const parentCuesBlock = cue.parentElement;
      if (parentCuesBlock && parentCuesBlock.tagName === "cues") {
        const parentCueElement = parentCuesBlock.parentElement;
        if (parentCueElement && parentCueElement.tagName === "cue") {
          const parentCueId = elementToId.get(parentCueElement);
          if (parentCueId) {
            links.push({
              id: `link_sub_${Date.now()}_${parentCueId}_${cueId}`,
              sourceNodeId: parentCueId,
              sourcePortId: 'out_sub',
              targetNodeId: cueId,
              targetPortId: 'in_flow'
            });
          }
        }
      }
    }

    // Pass 3: Parse conditions and actions for each cue
    for (let i = 0; i < cuesList.length; i++) {
      const cue = cuesList[i];
      const cueId = elementToId.get(cue);
      if (!cueId) continue;
      const cueNode = nodes.find(n => n.id === cueId)!;

      // Parse conditions
      const conditionsElement = elementChildrenOf(cue).find((c: Element) => c.tagName === "conditions");
      if (conditionsElement) {
        const conditionChildren = elementChildrenOf(conditionsElement);
        let condIndex = 0;
        conditionChildren.forEach((child: Element) => {
          const tag = child.tagName;
          let nodeType: MDNode['type'] = 'condition';
          let xmlTag = tag;
          let label = tag;
          let properties: Record<string, any> = {};

          if (tag === 'event_cue_signalled') {
            nodeType = 'event';
            label = 'Event: Game Started';
            properties = attributesToProperties(child);
          } else if (tag === 'event_object_destroyed') {
            nodeType = 'event';
            label = 'Event: Object Destroyed';
            properties = attributesToProperties(child);
          } else if (tag === 'event_object_changed_sector') {
            nodeType = 'event';
            label = 'Event: Sector Entered';
            properties = attributesToProperties(child);
          } else if (tag === 'check_value') {
            nodeType = 'condition';
            label = 'Check: Player Wealth';
            properties = parseCheckValueProperties(child);
          } else {
            // Unrecognized / escape hatch
            const schemaTemplate = schemaTemplatesByTag.get(tag);
            if (schemaTemplate) {
              nodeType = schemaTemplate.type;
              xmlTag = schemaTemplate.xmlTag;
              label = schemaTemplate.label;
              properties = attributesToProperties(child);
              const rawChildren = Array.from(child.childNodes || [])
                .map((nested: any) => serializer.serializeToString(nested))
                .join('')
                .trim();
              if (rawChildren) properties.__rawChildrenXml = rawChildren;
            } else {
              if (tag.startsWith('event_')) {
                nodeType = 'event';
                xmlTag = 'custom_event';
                label = `Event: <${tag}>`;
              } else {
                nodeType = 'condition';
                xmlTag = 'custom_condition';
                label = `Condition: <${tag}>`;
              }
              properties = { rawXml: serializer.serializeToString(child as any), sourceTag: tag };
            }
          }

          const template = NODE_TEMPLATES.find(t => t.xmlTag === xmlTag) || schemaTemplatesByTag.get(xmlTag);
          if (template) {
            const condNodeId = `${xmlTag}_${Date.now()}_${i}_${condIndex}`;
            const condNode: MDNode = {
              id: condNodeId,
              type: nodeType,
              label,
              xmlTag,
              x: cueNode.x + 300,
              y: cueNode.y + condIndex * 150,
              properties,
              propertiesSchema: template.propertiesSchema,
              inputs: template.inputs,
              outputs: template.outputs
              ,source: sourceForElement(child, xmlTag !== 'custom_event' && xmlTag !== 'custom_condition')
            };
            nodes.push(condNode);

            // Connect Cue -> Condition
            links.push({
              id: `link_cond_${Date.now()}_${cueId}_${condNodeId}`,
              sourceNodeId: cueId,
              sourcePortId: 'out_cond',
              targetNodeId: condNodeId,
              targetPortId: 'in_cond'
            });

            condIndex++;
          }
        });
      }

      // Parse actions
      const actionsElement = elementChildrenOf(cue).find((c: Element) => c.tagName === "actions");
      if (actionsElement) {
        const actionChildren = elementChildrenOf(actionsElement);
        let actIndex = 0;

        // Build a single action node from an <actions> child element (returns null if untemplated).
        const buildActionNode = (child: any): MDNode | null => {
          const tag = child.tagName;
          let xmlTag = tag;
          let label = tag;
          let properties: Record<string, any> = {};

          if (tag === 'create_ship') {
            label = 'Spawn Ship';
            const name = child.getAttribute("name") || '$EscortShip';
            const ownerEl = child.getElementsByTagName("owner")[0];
            const faction = stripFactionPrefix(ownerEl?.getAttribute("exact") || child.getAttribute("faction") || 'player');
            const macroVal = child.getAttribute("macro") || '';
            const matchingMacro = matchOption(X4_SHIP_MACROS, macroVal);
            const spaceObj = child.getAttribute("sector") || child.getAttribute("zone") || child.getElementsByTagName("space")[0]?.getAttribute("object") || 'player.sector';
            const posEl = child.getElementsByTagName("position")[0];
            const coords = posEl ? `${posEl.getAttribute("x") || 0},${posEl.getAttribute("y") || 0},${posEl.getAttribute("z") || 0}` : '0,0,1000';
            properties = { ...attributesToProperties(child), name, macro: matchingMacro, faction, sector: spaceObj, coords };
          } else if (tag === 'reward_player') {
            label = 'Reward Player';
            const money = child.getAttribute("money") || '0';
            properties = { money };
          } else if (tag === 'play_sound') {
            label = 'Play Audio/Sound';
            properties = {
              object: child.getAttribute("object") || 'playership',
              sound: child.getAttribute("sound") || 'notification_generic'
            };
          } else if (tag === 'show_help') {
            label = 'Show Briefing';
            const rawText = child.getAttribute("custom") || child.getAttribute("text") || '';
            const text = rawText.replace(/^'|'$/g, '');
            properties = { custom: text, duration: Number(child.getAttribute("duration")) || 5 };
          } else if (tag === 'create_station') {
            label = 'Spawn Station';
            const name = child.getAttribute("name") || '$MyDefenseStation';
            const faction = stripFactionPrefix(child.getAttribute("owner") || child.getAttribute("faction") || 'player');
            const macroVal = child.getAttribute("macro") || '';
            const matchingMacro = matchOption(X4_STATION_MACROS, macroVal);
            const spaceObj = child.getAttribute("sector") || child.getAttribute("zone") || child.getElementsByTagName("space")[0]?.getAttribute("sector") || 'player.sector';
            const posEl = child.getElementsByTagName("position")[0];
            const coords = posEl ? `${posEl.getAttribute("x") || 0},${posEl.getAttribute("y") || 0},${posEl.getAttribute("z") || 0}` : '5000,0,5000';
            properties = { ...attributesToProperties(child), name, macro: matchingMacro, faction, sector: spaceObj, coords };
          } else if (isContainerTag(tag)) {
            // control-flow container (do_if/do_while/…): keep its own attributes (e.g. value);
            // its body is parsed separately into out_body by the recursive walker below.
            const t = NODE_TEMPLATES.find(n => n.xmlTag === tag);
            label = t ? t.label : tag;
            properties = attributesToProperties(child);
          } else {
            // Unrecognized / escape hatch
            const schemaTemplate = schemaTemplatesByTag.get(tag);
            if (schemaTemplate) {
              xmlTag = schemaTemplate.xmlTag;
              label = schemaTemplate.label;
              properties = attributesToProperties(child);
              // Many valid MD instructions own data children rather than executable action
              // children: create_order/order/param, find_* match blocks, boarding marines,
              // and extension-defined payloads. Keep those exact children on the parent node;
              // otherwise an XSD-known node looks modeled while its payload vanishes on export.
              const rawChildren = Array.from(child.childNodes || [])
                .map((nested: any) => serializer.serializeToString(nested))
                .join('')
                .trim();
              if (rawChildren) properties.__rawChildrenXml = rawChildren;
            } else {
              xmlTag = 'custom_xml';
              label = `XML: <${tag}>`;
              properties = { rawXml: serializer.serializeToString(child as any), sourceTag: tag };
            }
          }

          if (!isContainerTag(xmlTag) && xmlTag !== 'custom_xml') {
            const rawChildren = Array.from(child.childNodes || [])
              .map((nested: any) => serializer.serializeToString(nested))
              .join('')
              .trim();
            if (rawChildren) properties.__rawChildrenXml = rawChildren;
          }

          const template = NODE_TEMPLATES.find(t => t.xmlTag === xmlTag)
            || schemaTemplatesByTag.get(xmlTag)
            || (isContainerTag(xmlTag) ? {
              xmlTag,
              label,
              type: 'action' as const,
              properties,
              propertiesSchema: Object.keys(properties).map(key => ({ key, label: key, type: 'text' as const })),
              inputs: [{ id: 'in_act', name: 'Action In', type: 'flow' as const }],
              outputs: [
                { id: 'out_body', name: 'Branch Body', type: 'child' as const },
                { id: 'out_next', name: 'Next Action', type: 'flow' as const },
              ],
            } : undefined);
          if (!template) return null;
          const actNodeId = `${xmlTag}_${Date.now()}_${i}_${actIndex}`;
          actIndex++;
          const actNode: MDNode = {
            id: actNodeId,
            type: 'action',
            label,
            xmlTag,
            x: cueNode.x + 600 + actIndex * 300,
            y: cueNode.y,
            properties,
            propertiesSchema: template.propertiesSchema,
            inputs: template.inputs,
            outputs: template.outputs
            ,source: sourceForElement(child, xmlTag !== 'custom_xml')
          };
          nodes.push(actNode);
          return actNode;
        };

        // Recursive walk: chain siblings via out_next (first via parentPort). A control-flow
        // container recurses its element children into out_body, so nested do_if/do_while
        // round-trips losslessly instead of dropping its body (gap G3).
        const walkActions = (children: any[], parentId: string, parentPort: string) => {
          let prevId = parentId, prevPort = parentPort;
          for (const child of children) {
            const node = buildActionNode(child);
            if (!node) continue;
            links.push({
              id: `link_act_${Date.now()}_${prevId}_${node.id}`,
              sourceNodeId: prevId,
              sourcePortId: prevPort,
              targetNodeId: node.id,
              targetPortId: 'in_act'
            });
            if (isContainerTag(node.xmlTag)) {
              walkActions(elementChildrenOf(child), node.id, 'out_body');
            }
            prevId = node.id;
            prevPort = 'out_next';
          }
        };
        walkActions(actionChildren, cueId, 'out_act');
      }
    }
    
    return {
      id: `workspace_${Date.now()}`,
      name: modName,
      version: mdscript.getAttribute("version") || "1.0.0",
      author: mdscript.getAttribute("author") || "ImportedAuthor",
      description: mdscript.getAttribute("description") || `Imported and visually reconstructed with ${nodes.length} cue nodes.`,
      nodes,
      links,
      uiWidgets: [],
      uiTheme: {
        backgroundColor: "#0F1115",
        borderColor: "#06b6d4",
        accentColor: "#0891b2",
        opacity: 0.95,
        showIcons: true
      }
    };
  } catch (err) {
    console.warn("XML Import Parsing Error: ", err);
    return null;
  }
}
