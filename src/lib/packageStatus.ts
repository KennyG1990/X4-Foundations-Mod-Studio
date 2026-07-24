import type { PackageDiagnostic } from '../types';

export type DiagnosticSource = 'checking' | 'project' | 'local';

export function summarizePackageStatus(
  diagnostics: PackageDiagnostic[],
  source: DiagnosticSource,
): { label: 'CHECK' | 'OFFLINE' | 'ERRORS' | 'WARN' | 'OK'; tone: 'red' | 'amber' | 'green'; errors: number; warnings: number } {
  const errors = diagnostics.filter(d => d.severity === 'error').length;
  const warnings = diagnostics.filter(d => d.severity === 'warning').length;
  if (source === 'checking') return { label: 'CHECK', tone: 'amber', errors, warnings };
  if (source === 'local') return { label: 'OFFLINE', tone: 'amber', errors, warnings };
  if (errors > 0) return { label: 'ERRORS', tone: 'red', errors, warnings };
  if (warnings > 0) return { label: 'WARN', tone: 'amber', errors, warnings };
  return { label: 'OK', tone: 'green', errors, warnings };
}

export function runPackageStatusSelftest() {
  const error = { severity: 'error', category: 'egosoft', message: 'bad' } as PackageDiagnostic;
  const warning = { severity: 'warning', category: 'egosoft', message: 'warn' } as PackageDiagnostic;
  const checks = [
    { name: 'checking_never_green', pass: summarizePackageStatus([], 'checking').tone === 'amber' },
    { name: 'offline_never_green', pass: summarizePackageStatus([], 'local').label === 'OFFLINE' && summarizePackageStatus([], 'local').tone === 'amber' },
    { name: 'project_error_red', pass: summarizePackageStatus([error], 'project').tone === 'red' },
    { name: 'project_warning_amber', pass: summarizePackageStatus([warning], 'project').label === 'WARN' },
    { name: 'only_confirmed_clean_is_green', pass: summarizePackageStatus([], 'project').tone === 'green' },
  ];
  const passed = checks.filter(check => check.pass).length;
  return { allPassed: passed === checks.length, passed, total: checks.length, checks };
}
