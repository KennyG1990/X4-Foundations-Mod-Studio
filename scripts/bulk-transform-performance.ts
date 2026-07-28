#!/usr/bin/env tsx

import { performance } from 'node:perf_hooks';
import { createBulkTransformPlan, type BulkTransformRule } from '../src/lib/bulkCorpusTransform';
import type { EffectiveReferenceDocument } from '../src/lib/referenceOverlay';

const fixtureXml = '<macros><macro name="fixture_macro" class="ship"><properties><hull max="216000"/></properties></macro></macros>';
const rule: BulkTransformRule = {
  pathPrefix: 'assets/units/size_xl/macros',
  selector: '/macros/macro/properties/hull/@max',
  operation: 'multiply',
  operand: 1.5,
  rounding: 'ceil',
  roundingIncrement: 1000,
  maxFiles: 500,
};

function percentile(values: number[], value: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))] || 0;
}

function run(size: number) {
  const logicalPaths = Array.from({ length: size }, (_, index) => `assets/units/size_xl/macros/ship_fixture_${String(index).padStart(4, '0')}.xml`);
  const resolve = (logicalPath: string): EffectiveReferenceDocument => ({
    available: true,
    root: 'performance-fixture',
    relativePath: logicalPath,
    content: fixtureXml,
    sources: [{ source: 'base', path: logicalPath, mode: 'base' }],
    findings: [],
    signature: `fixture:${logicalPath}`,
  });
  const durations: number[] = [];
  for (let iteration = 0; iteration < 6; iteration++) {
    const start = performance.now();
    const plan = createBulkTransformPlan({ rule, logicalPaths, corpusGeneration: 'performance-fixture', resolve });
    const duration = performance.now() - start;
    if (!plan.ok || plan.rows.length !== size || plan.files.length !== size || plan.rows.some(row => row.newValue !== '324000')) {
      throw new Error(`incorrect ${size}-file performance fixture result`);
    }
    if (iteration > 0) durations.push(duration);
  }
  return {
    files: size,
    p50Ms: Number(percentile(durations, 0.5).toFixed(1)),
    p95Ms: Number(percentile(durations, 0.95).toFixed(1)),
    maxMs: Number(Math.max(...durations).toFixed(1)),
  };
}

const results = [100, 250, 500].map(run);
const maximum = results.at(-1)!;
const pass = maximum.p95Ms < 5_000;
console.log(JSON.stringify({ pass, thresholdMs: 5_000, results }, null, 2));
process.exit(pass ? 0 : 1);
