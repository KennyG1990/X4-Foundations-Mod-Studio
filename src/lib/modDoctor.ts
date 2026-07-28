/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModWorkspace, XMLDiagnostic, generateMDXML, validateModWorkspace } from '../types';
import { validatePackageReadiness, toContentVersion, toTFileName } from './modCompiler';

export interface ModDoctorDiagnostic extends XMLDiagnostic {
  code?: string;
  domain?: 'manifest' | 'mission_director' | 'ui_layout' | 'ai_scripts' | 'libraries' | 'translations' | 'xml_patches' | 'build';
  filePath?: string;
  sourceRef?: {
    kind: string;
    id?: string;
    label?: string;
  };
}

const DEFAULT_COMPILE_SETTINGS = {
  md: true,
  ui: true,
  ai: true,
  library: true,
  translations: true,
  patches: true
};

const active = <T extends { includeInBuild?: boolean }>(items: T[] | undefined): T[] => (
  (items || []).filter(item => item.includeInBuild !== false)
);

const excludedCount = <T extends { includeInBuild?: boolean }>(items: T[] | undefined): number => (
  (items || []).filter(item => item.includeInBuild === false).length
);

const isPositiveNumber = (value: unknown): boolean => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
);

const push = (
  diagnostics: ModDoctorDiagnostic[],
  diagnostic: ModDoctorDiagnostic
) => diagnostics.push(diagnostic);

export function runModDoctor(
  workspace: ModWorkspace,
  files: Record<string, string>,
  modId: string,
  options: { canonicalAiScripts?: Set<string> } = {},
): ModDoctorDiagnostic[] {
  const diagnostics: ModDoctorDiagnostic[] = [];
  const settings = { ...DEFAULT_COMPILE_SETTINGS, ...(workspace.compileSettings || {}) };

  if (!files['content.xml']) {
    push(diagnostics, {
      severity: 'error',
      category: 'egosoft',
      code: 'manifest.missing_content',
      domain: 'manifest',
      filePath: 'content.xml',
      message: 'Package is missing content.xml. X4 will not discover the extension without it.'
    });
  }

  if (!workspace.version?.trim()) {
    push(diagnostics, {
      severity: 'warning',
      category: 'egosoft',
      code: 'manifest.empty_version',
      domain: 'manifest',
      filePath: 'content.xml',
      message: 'Workspace version is empty. content.xml will fall back to version 100.'
    });
  } else if (!/^\d+(\.\d+){0,2}$/.test(workspace.version.trim())) {
    push(diagnostics, {
      severity: 'warning',
      category: 'egosoft',
      code: 'manifest.version_format',
      domain: 'manifest',
      filePath: 'content.xml',
      message: `Workspace version "${workspace.version}" is not numeric semver-like. content.xml will compile it as ${toContentVersion(workspace.version)}.`
    });
  }

  if (settings.md) {
    const mdPath = `md/${modId}.xml`;
    const mdDiagnostics = validateModWorkspace(workspace, files[mdPath] || generateMDXML(workspace));
    mdDiagnostics.forEach(diagnostic => {
      diagnostics.push({
        ...diagnostic,
        domain: 'mission_director',
        filePath: mdPath,
        sourceRef: diagnostic.nodeId ? { kind: 'md_node', id: diagnostic.nodeId } : undefined
      });
    });
  } else if ((workspace.nodes || []).length > 0) {
    push(diagnostics, {
      severity: 'info',
      category: 'egosoft',
      code: 'build.md_disabled',
      domain: 'build',
      message: `${workspace.nodes.length} MD node(s) exist, but Mission Director output is disabled in compile settings.`
    });
  }

  validatePackageReadiness(workspace).forEach(diagnostic => {
    diagnostics.push({
      ...diagnostic,
      code: 'package.readiness',
      domain: 'manifest',
      filePath: 'content.xml'
    });
  });

  const excluded = {
    nodes: excludedCount(workspace.nodes),
    uiWidgets: excludedCount(workspace.uiWidgets),
    aiScripts: excludedCount(workspace.aiScripts),
    wares: excludedCount(workspace.wares),
    jobs: excludedCount(workspace.jobs),
    tFiles: excludedCount(workspace.tFiles),
    xmlPatches: excludedCount(workspace.xmlPatches)
  };

  Object.entries(excluded)
    .filter(([, count]) => count > 0)
    .forEach(([domain, count]) => {
      push(diagnostics, {
        severity: 'info',
        category: 'egosoft',
        code: 'build.excluded_items',
        domain: 'build',
        message: `${count} ${domain} item(s) are excluded from the current build by includeInBuild=false.`
      });
    });

  if (settings.ui) {
    active(workspace.uiWidgets).forEach(widget => {
      if (widget.w <= 0 || widget.h <= 0) {
        push(diagnostics, {
          severity: 'error',
          category: 'egosoft',
          code: 'ui.invalid_size',
          domain: 'ui_layout',
          filePath: `ui/${modId}.lua`,
          sourceRef: { kind: 'ui_widget', id: widget.id, label: widget.label },
          message: `UI widget "${widget.label || widget.id}" has non-positive dimensions.`
        });
      }
    });

  } else if ((workspace.uiWidgets || []).length > 0) {
    push(diagnostics, {
      severity: 'info',
      category: 'egosoft',
      code: 'build.ui_disabled',
      domain: 'build',
      message: `${workspace.uiWidgets.length} UI widget(s) exist, but UI output is disabled in compile settings.`
    });
  }

  if (settings.ai) {
    active(workspace.aiScripts).forEach(script => {
      const fileName = script.name?.endsWith('.xml') ? script.name : `${script.name || 'unnamed_script'}.xml`;
      const filePath = `aiscripts/${fileName}`;
      if (!script.name?.trim()) {
        push(diagnostics, {
          severity: 'error',
          category: 'egosoft',
          code: 'ai.missing_name',
          domain: 'ai_scripts',
          filePath,
          sourceRef: { kind: 'ai_script', id: script.id },
          message: 'AI script is missing a script name. The aiscripts file name and root <aiscript name> require it.'
        });
      } else if (!/^[a-zA-Z0-9_.-]+$/.test(script.name)) {
        push(diagnostics, {
          severity: 'warning',
          category: 'egosoft',
          code: 'ai.name_format',
          domain: 'ai_scripts',
          filePath,
          sourceRef: { kind: 'ai_script', id: script.id, label: script.name },
          message: `AI script "${script.name}" contains spaces or unusual characters. Prefer stable script ids such as "move.my_custom_task".`
        });
      }

      if ((script.actions || []).length === 0) {
        push(diagnostics, {
          severity: 'warning',
          category: 'egosoft',
          code: 'ai.no_actions',
          domain: 'ai_scripts',
          filePath,
          sourceRef: { kind: 'ai_script', id: script.id, label: script.name },
          message: `AI script "${script.name || script.id}" has no actions. It will compile, but it has no behavior beyond the generated loop.`
        });
      }

      (script.params || []).forEach(param => {
        if (!param.name?.trim()) {
          push(diagnostics, {
            severity: 'error',
            category: 'egosoft',
            code: 'ai.param_missing_name',
            domain: 'ai_scripts',
            filePath,
            sourceRef: { kind: 'ai_param', id: script.id, label: script.name },
            message: `AI script "${script.name || script.id}" contains a parameter without a name.`
          });
        }
      });
    });
  } else if ((workspace.aiScripts || []).length > 0) {
    push(diagnostics, {
      severity: 'info',
      category: 'egosoft',
      code: 'build.ai_disabled',
      domain: 'build',
      message: `${workspace.aiScripts.length} AI script(s) exist, but AI script output is disabled in compile settings.`
    });
  }

  if (settings.library) {
    active(workspace.wares).forEach(ware => {
      const filePath = 'libraries/wares.xml';
      if (!ware.id?.trim()) {
        push(diagnostics, {
          severity: 'error',
          category: 'egosoft',
          code: 'ware.missing_id',
          domain: 'libraries',
          filePath,
          sourceRef: { kind: 'ware', id: ware.id, label: ware.name },
          message: 'Ware is missing an id. Ware ids are required for XML diff insertion and downstream references.'
        });
      } else if (!/^[a-z0-9_]+$/.test(ware.id)) {
        push(diagnostics, {
          severity: 'warning',
          category: 'egosoft',
          code: 'ware.id_format',
          domain: 'libraries',
          filePath,
          sourceRef: { kind: 'ware', id: ware.id, label: ware.name },
          message: `Ware id "${ware.id}" should use lowercase letters, numbers, and underscores for stable X4 references.`
        });
      }

      if (!isPositiveNumber(ware.volume) || !isPositiveNumber(ware.prodTime) || !isPositiveNumber(ware.prodAmount)) {
        push(diagnostics, {
          severity: 'error',
          category: 'egosoft',
          code: 'ware.invalid_numbers',
          domain: 'libraries',
          filePath,
          sourceRef: { kind: 'ware', id: ware.id, label: ware.name },
          message: `Ware "${ware.id || ware.name}" needs positive volume, production time, and production amount values.`
        });
      }

      if (!String(ware.tags || '').trim()) {
        push(diagnostics, {
          severity: 'warning',
          category: 'egosoft',
          code: 'ware.missing_tags',
          domain: 'libraries',
          filePath,
          sourceRef: { kind: 'ware', id: ware.id, label: ware.name },
          message: `Ware "${ware.id || ware.name}" has no explicit tags. Add tags such as "economy equipment" when the ware should be classified by X4 systems.`
        });
      }

      if (!Array.isArray(ware.primaryWares) || ware.primaryWares.length === 0) {
        push(diagnostics, {
          severity: 'warning',
          category: 'egosoft',
          code: 'ware.missing_primary_inputs',
          domain: 'libraries',
          filePath,
          sourceRef: { kind: 'ware', id: ware.id, label: ware.name },
          message: `Ware "${ware.id || ware.name}" has no explicit primary production inputs. The compiler will no longer invent ore/energycells; add primary inputs if this ware should be produced.`
        });
      }

      if (!(ware.minPrice <= ware.avgPrice && ware.avgPrice <= ware.maxPrice)) {
        push(diagnostics, {
          severity: 'error',
          category: 'egosoft',
          code: 'ware.price_order',
          domain: 'libraries',
          filePath,
          sourceRef: { kind: 'ware', id: ware.id, label: ware.name },
          message: `Ware "${ware.id || ware.name}" price ladder must satisfy min <= average <= max.`
        });
      }
    });

    active(workspace.jobs).forEach(job => {
      const filePath = 'libraries/jobs.xml';
      const missing = ['id', 'name', 'faction', 'shipMacro', 'taskScript'].filter(key => !String((job as any)[key] || '').trim());
      if (missing.length > 0) {
        push(diagnostics, {
          severity: 'error',
          category: 'egosoft',
          code: 'job.missing_fields',
          domain: 'libraries',
          filePath,
          sourceRef: { kind: 'job', id: job.id, label: job.name },
          message: `Job "${job.id || job.name || 'unnamed'}" is missing required field(s): ${missing.join(', ')}.`
        });
      }

      if (job.galaxyQuota < 0 || job.sectorQuota < 0) {
        push(diagnostics, {
          severity: 'error',
          category: 'egosoft',
          code: 'job.invalid_quota',
          domain: 'libraries',
          filePath,
          sourceRef: { kind: 'job', id: job.id, label: job.name },
          message: `Job "${job.id || job.name}" quotas must be zero or positive.`
        });
      }

      const scriptNames = new Set([
        ...active(workspace.aiScripts).map(script => script.name),
        ...(options.canonicalAiScripts || []),
      ]);
      if (job.taskScript && !scriptNames.has(job.taskScript)) {
        push(diagnostics, {
          severity: 'warning',
          category: 'references',
          code: 'job.task_script_missing',
          domain: 'libraries',
          filePath,
          sourceRef: { kind: 'job', id: job.id, label: job.name },
          message: `Job "${job.id || job.name}" references task script "${job.taskScript}", but it is absent from both the included workspace scripts and the configured canonical X4 corpus.`
        });
      }
    });
  } else if ((workspace.wares || []).length > 0 || (workspace.jobs || []).length > 0) {
    push(diagnostics, {
      severity: 'info',
      category: 'egosoft',
      code: 'build.library_disabled',
      domain: 'build',
      message: 'Library items exist, but wares/jobs output is disabled in compile settings.'
    });
  }

  if (settings.translations) {
    active(workspace.tFiles).forEach(tFile => {
      const filePath = `t/${toTFileName(tFile)}`;
      if (!/^\d+$/.test(String(tFile.languageId || ''))) {
        push(diagnostics, {
          severity: 'error',
          category: 'egosoft',
          code: 'tfile.language_id',
          domain: 'translations',
          filePath,
          sourceRef: { kind: 't_file', id: tFile.fileName },
          message: `Translation file "${tFile.fileName || filePath}" needs a numeric language id.`
        });
      }

      if (tFile.fileName && !/^0001-[lL]\d{3}\.xml$/.test(tFile.fileName)) {
        push(diagnostics, {
          severity: 'warning',
          category: 'egosoft',
          code: 'tfile.name_format',
          domain: 'translations',
          filePath,
          sourceRef: { kind: 't_file', id: tFile.fileName },
          message: `Translation file "${tFile.fileName}" does not match the common 0001-l044.xml naming convention.`
        });
      }

      const pageIds = new Set<string>();
      (tFile.pages || []).forEach(page => {
        if (pageIds.has(page.id)) {
          push(diagnostics, {
            severity: 'error',
            category: 'references',
            code: 'tfile.duplicate_page',
            domain: 'translations',
            filePath,
            sourceRef: { kind: 't_page', id: page.id, label: tFile.fileName },
            message: `Translation file "${tFile.fileName || filePath}" contains duplicate page id "${page.id}".`
          });
        }
        pageIds.add(page.id);

        const itemIds = new Set<string>();
        (page.items || []).forEach(item => {
          if (itemIds.has(item.id)) {
            push(diagnostics, {
              severity: 'error',
              category: 'references',
              code: 'tfile.duplicate_item',
              domain: 'translations',
              filePath,
              sourceRef: { kind: 't_item', id: item.id, label: page.id },
              message: `Translation page "${page.id}" contains duplicate text id "${item.id}".`
            });
          }
          itemIds.add(item.id);
        });
      });
    });
  } else if ((workspace.tFiles || []).length > 0) {
    push(diagnostics, {
      severity: 'info',
      category: 'egosoft',
      code: 'build.translations_disabled',
      domain: 'build',
      message: `${workspace.tFiles.length} translation file(s) exist, but translation output is disabled in compile settings.`
    });
  }

  if (settings.patches) {
    active(workspace.xmlPatches).forEach(patch => {
      const filePath = patch.targetFile || 'libraries/wares.xml';
      if (!patch.targetFile?.trim()) {
        push(diagnostics, {
          severity: 'warning',
          category: 'egosoft',
          code: 'patch.default_target',
          domain: 'xml_patches',
          filePath,
          sourceRef: { kind: 'xml_patch', id: patch.id },
          message: 'XML patch has no explicit target file. Set one — it will otherwise default to libraries/wares.xml, which is unlikely to be what you intend.'
        });
      }

      if (!patch.sel?.trim() || !patch.sel.trim().startsWith('/')) {
        push(diagnostics, {
          severity: 'error',
          category: 'egosoft',
          code: 'patch.invalid_selector',
          domain: 'xml_patches',
          filePath,
          sourceRef: { kind: 'xml_patch', id: patch.id },
          message: `XML patch "${patch.id}" needs an absolute XPath selector starting with "/".`
        });
      }

      if ((patch.action === 'add' || patch.action === 'replace') && !patch.content?.trim()) {
        push(diagnostics, {
          severity: 'error',
          category: 'egosoft',
          code: 'patch.missing_content',
          domain: 'xml_patches',
          filePath,
          sourceRef: { kind: 'xml_patch', id: patch.id },
          message: `XML patch "${patch.id}" uses ${patch.action} but has no XML content.`
        });
      }

      if (patch.action === 'remove' && patch.content?.trim()) {
        push(diagnostics, {
          severity: 'warning',
          category: 'egosoft',
          code: 'patch.remove_content_ignored',
          domain: 'xml_patches',
          filePath,
          sourceRef: { kind: 'xml_patch', id: patch.id },
          message: `XML patch "${patch.id}" uses remove; its content field will be ignored.`
        });
      }
    });
  } else if ((workspace.xmlPatches || []).length > 0) {
    push(diagnostics, {
      severity: 'info',
      category: 'egosoft',
      code: 'build.patches_disabled',
      domain: 'build',
      message: `${workspace.xmlPatches.length} XML patch block(s) exist, but XML patch output is disabled in compile settings.`
    });
  }

  return diagnostics;
}

export function runModDoctorReferenceSelftest() {
  const workspace = {
    id: 'doctor_reference_fixture', name: 'Doctor Reference Fixture', version: '1.0.0', author: 'Forge', description: '',
    nodes: [], links: [], uiWidgets: [], uiTheme: { backgroundColor: '#000', borderColor: '#000', accentColor: '#0ff', opacity: 1, showIcons: true },
    compileSettings: { md: false, ui: false, ai: false, library: true, translations: false, patches: false },
    jobs: [{ id: 'fixture_job', name: 'Fixture', faction: 'argon', shipClass: 'fighter', shipMacro: 'ship_arg_s_fighter_01_a_macro', galaxyQuota: 1, sectorQuota: 1, taskScript: 'order.patrol', rebuildOnDestroy: true, includeInBuild: true }],
  } as ModWorkspace;
  const files = { 'content.xml': '<content id="doctor_reference_fixture" name="Doctor Reference Fixture" author="Forge" version="100"/>', 'libraries/jobs.xml': '<jobs/>' };
  const canonical = runModDoctor(workspace, files, 'doctor_reference_fixture', { canonicalAiScripts: new Set(['order.patrol']) });
  const unknownWorkspace = { ...workspace, jobs: workspace.jobs!.map(job => ({ ...job, taskScript: 'order.definitely_missing' })) };
  const unknown = runModDoctor(unknownWorkspace, files, 'doctor_reference_fixture', { canonicalAiScripts: new Set(['order.patrol']) });
  const checks = [
    { name: 'canonical AI task does not false-warn', pass: !canonical.some(finding => finding.code === 'job.task_script_missing') },
    { name: 'unknown AI task remains an advisory warning', pass: unknown.some(finding => finding.code === 'job.task_script_missing' && finding.severity === 'warning') },
  ];
  const passed = checks.filter(check => check.pass).length;
  return { allPassed: passed === checks.length, pass: passed === checks.length, passed, total: checks.length, checks };
}
