import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  routeProjectFile,
  runSchemaRoutingSelftest,
  validateRoutedFiles,
} from '../src/lib/schemaRouting';
import { isDedicatedScriptFile } from '../src/server/projectValidation';
import type { SchemaRegistry } from '../src/lib/schemaRegistry';

const xsd = (body: string) =>
  '<?xml version="1.0" encoding="utf-8"?>\n'
  + '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">\n'
  + body
  + '\n</xs:schema>';

const check = (name: string, condition: boolean, detail?: unknown) => {
  assert.ok(condition, name + (detail === undefined ? '' : ': ' + JSON.stringify(detail)));
};

const run = () => {
  const existing = runSchemaRoutingSelftest();
  check('existing schema routing selftest', existing.allPassed, existing.checks.filter(c => !c.pass));

  const mdPlain = { path: 'md/plain.xml', kind: 'md' as const, content: '<mdscript name="plain"/>' };
  const mdDiff = { path: 'md/patch.xml', kind: 'md' as const, content: '<diff><add sel="/mdscript"/></diff>' };
  const aiPlain = { path: 'aiscripts/plain.xml', kind: 'aiscript' as const, content: '<aiscript name="plain"/>' };
  const aiDiff = { path: 'aiscripts/patch.xml', kind: 'aiscript' as const, content: '<diff><add sel="/aiscript"/></diff>' };

  check('plain md stays dedicated-only', routeProjectFile(mdPlain.path, mdPlain.content) === null);
  check('plain aiscript stays dedicated-only', routeProjectFile(aiPlain.path, aiPlain.content) === null);
  check('md direct validator accepts plain document', isDedicatedScriptFile(mdPlain, 'md'));
  check('md direct validator skips diff document', !isDedicatedScriptFile(mdDiff, 'md'));
  check('aiscript direct validator accepts plain document', isDedicatedScriptFile(aiPlain, 'aiscript'));
  check('aiscript direct validator skips diff document', !isDedicatedScriptFile(aiDiff, 'aiscript'));

  const mdRoute = routeProjectFile(mdDiff.path, mdDiff.content);
  check('md diff routes through merged domain', mdRoute?.kind === 'schema'
    && mdRoute.domain === 'md' && mdRoute.wrapper === 'diff' && mdRoute.rootElement === 'diff', mdRoute);
  const aiRoute = routeProjectFile(aiDiff.path, aiDiff.content);
  check('aiscript diff routes through merged domain', aiRoute?.kind === 'schema'
    && aiRoute.domain === 'aiscripts' && aiRoute.wrapper === 'diff' && aiRoute.rootElement === 'diff', aiRoute);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x4forge-project-validation-diff-'));
  try {
    const write = (name: string, content: string) => {
      const filePath = path.join(tmp, name);
      fs.writeFileSync(filePath, content, 'utf8');
      return filePath;
    };
    const diffPath = write('diff.xsd', xsd([
      '  <xs:element name="diff"><xs:complexType><xs:sequence>',
      '    <xs:element ref="add" minOccurs="0" maxOccurs="unbounded"/>',
      '    <xs:element ref="replace" minOccurs="0" maxOccurs="unbounded"/>',
      '    <xs:element ref="remove" minOccurs="0" maxOccurs="unbounded"/>',
      '  </xs:sequence></xs:complexType></xs:element>',
      '  <xs:element name="add"><xs:complexType><xs:sequence><xs:any minOccurs="0" maxOccurs="unbounded"/></xs:sequence><xs:attribute name="sel" use="required"/></xs:complexType></xs:element>',
      '  <xs:element name="replace"><xs:complexType><xs:sequence><xs:any minOccurs="0" maxOccurs="unbounded"/></xs:sequence><xs:attribute name="sel" use="required"/></xs:complexType></xs:element>',
      '  <xs:element name="remove"><xs:complexType><xs:attribute name="sel" use="required"/></xs:complexType></xs:element>',
    ].join('\n')));
    const mdPath = write('md.xsd', xsd([
      '  <xs:element name="mdscript"><xs:complexType><xs:attribute name="name" use="required"/></xs:complexType></xs:element>',
    ].join('\n')));
    const aiscriptsPath = write('aiscripts.xsd', xsd([
      '  <xs:element name="aiscript"><xs:complexType><xs:attribute name="name" use="required"/></xs:complexType></xs:element>',
    ].join('\n')));
    const registry: SchemaRegistry = {
      roots: [tmp],
      domains: [
        { domain: 'diff', path: diffPath, sizeBytes: 1, includes: [], missingIncludes: [], shadowedCopies: 0 },
        { domain: 'md', path: mdPath, sizeBytes: 1, includes: [], missingIncludes: [], shadowedCopies: 0 },
        { domain: 'aiscripts', path: aiscriptsPath, sizeBytes: 1, includes: [], missingIncludes: [], shadowedCopies: 0 },
      ],
    };
    const provenDomains = new Set(['diff', 'md', 'aiscripts']);
    const mdPatch = '<diff><add sel="/mdscript"><mdscript name="added"/></add><replace sel="/mdscript"><mdscript name="replaced"/></replace><remove sel="/mdscript"/></diff>';
    const aiPatch = '<diff><add sel="/aiscript"><aiscript name="added"/></add></diff>';
    const routed = validateRoutedFiles([
      { path: mdDiff.path, content: mdPatch },
      { path: aiDiff.path, content: aiPatch },
    ], registry, { provenDomains, strictStructure: true });

    check('each script diff is routed exactly once', routed.length === 2
      && routed.filter(r => r.path === mdDiff.path).length === 1
      && routed.filter(r => r.path === aiDiff.path).length === 1, routed);
    check('md diff merged validation is clean', routed.find(r => r.path === mdDiff.path)?.findings.length === 0, routed.find(r => r.path === mdDiff.path)?.findings);
    check('aiscript diff merged validation is clean', routed.find(r => r.path === aiDiff.path)?.findings.length === 0, routed.find(r => r.path === aiDiff.path)?.findings);
    check('no false diff or action diagnostics', routed.every(r => !r.findings.some(f =>
      f.code === 'XSD_UNKNOWN_ELEMENT'
      || (f.code === 'XSD_UNKNOWN_ATTRIBUTE' && /^(add|replace|remove)@/i.test(f.sourceRef || '')))), routed);

    const missingSel = validateRoutedFiles([
      { path: mdDiff.path, content: '<diff><add><mdscript name="missing-selector"/></add></diff>' },
    ], registry, { provenDomains, strictStructure: true });
    check('missing diff sel is rejected by diff schema', missingSel.length === 1
      && missingSel[0].findings.some(f => f.code === 'XSD_MISSING_REQUIRED' && /add@sel/i.test(f.sourceRef || '')), missingSel);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  check('temporary schema corpus was cleaned', !fs.existsSync(tmp));
};

try {
  run();
  console.log('project-validation-diff-routing: PASS');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
