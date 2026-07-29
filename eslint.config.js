// X4 Forge ESLint flat config (added at the 1.0 release-prep pass).
// Run requires one host `npm install` (deps pinned in package.json devDeps);
// the sandbox registry policy blocks installing from agent sessions.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'temp_import/', 'dev-docs/', '*.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Keep the established React Hooks 5 gate while the plugin is upgraded for
      // ESLint 10 compatibility. The plugin's newer compiler rules are a separate,
      // repo-wide migration rather than a dependency-remediation side effect.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // The codebase predates typing discipline in endpoint glue; tighten over time.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Added to eslint:recommended in ESLint 10. They expose substantial legacy
      // cleanup and are not part of the previously enforced lint contract.
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off'
    }
  }
);
