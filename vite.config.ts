import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {execSync} from 'child_process';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// API server port in split-dev mode (Vite serves the UI on 3000 and proxies /api here).
const API_PORT = process.env.API_PORT || '3001';

// App version, computed at BUILD TIME and baked into the bundle as compile-time constants
// (__APP_VERSION__ / __APP_BUILD__). The DISPLAYED patch number is the git commit count, so
// the header version moves with every commit — a user who updates the extension (installs a
// bundle built from a newer commit) sees a higher number. major.minor come from package.json
// (bump those manually at real milestones). The shipped app has no .git, but that's fine: the
// value is frozen into the bundle at build time, exactly when .git IS present. Falls back to
// the plain package.json version if git is unavailable.
const {APP_VERSION, APP_BUILD} = (() => {
  const pkgVersion = (() => {
    try {
      return String(JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')).version || '0.0.0');
    } catch {
      return '0.0.0';
    }
  })();
  const git = (cmd: string) =>
    execSync(cmd, {cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore']}).toString().trim();
  try {
    const count = git('git rev-list --count HEAD');
    const sha = git('git rev-parse --short HEAD');
    const date = git('git show -s --format=%cs HEAD'); // commit date, YYYY-MM-DD
    const dirty = git('git status --porcelain').length > 0;
    const [major = '1', minor = '0'] = pkgVersion.split('.');
    return {
      APP_VERSION: `${major}.${minor}.${count}`,
      APP_BUILD: `commit ${sha} · ${date}${dirty ? ' · uncommitted build' : ''}`,
    };
  } catch {
    return {APP_VERSION: pkgVersion, APP_BUILD: `v${pkgVersion}`};
  }
})();

/**
 * Dev-only: inject the shared studio API token into index.html, mirroring
 * server.ts's injectStudioToken. In split-dev mode Vite (not Express) serves the
 * page, so without this the client never gets window.__STUDIO_API_TOKEN__ and
 * every /api call 401s. Reads the same `.studio-api-token` file the API writes,
 * so both processes agree on the token. `apply: 'serve'` keeps it out of builds.
 */
function studioTokenPlugin(): Plugin {
  return {
    name: 'studio-api-token-inject',
    apply: 'serve',
    transformIndexHtml(html) {
      // In combined fallback mode server.ts already injected the token; don't double up.
      if (html.includes('__STUDIO_API_TOKEN__')) return html;
      try {
        // B31s2: an EPHEMERAL stack (e2e) passes the token via env — both processes get
        // it without touching this checkout's .studio-api-token file.
        const token = (process.env.STUDIO_API_TOKEN?.trim())
          || fs
          .readFileSync(path.resolve(__dirname, '.studio-api-token'), 'utf8')
          .trim();
        if (token) {
          return html.replace(
            '</head>',
            `  <script>window.__STUDIO_API_TOKEN__=${JSON.stringify(token)};</script>\n  </head>`,
          );
        }
      } catch {
        // Token file not created yet (the API server writes it on first start).
        // The page will pick it up on the next load once the API is up.
      }
      return html;
    },
  };
}

export default defineConfig(() => {
  return {
    // `public/` contains tracked validation fixtures and must never be copied into a
    // production app. Only explicitly curated browser assets live in this clean root.
    publicDir: path.resolve(__dirname, 'public-assets'),
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
      __APP_BUILD__: JSON.stringify(APP_BUILD),
    },
    plugins: [react(), tailwindcss(), studioTokenPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Vite owns the browser-facing port. It does NOT restart when the API
      // (tsx watch on API_PORT) restarts, so backend edits stop reloading the page.
      port: 3000,
      strictPort: true,
      // Forward API calls to the standalone API server. Use 127.0.0.1 (not
      // "localhost") to match the API's IPv4 bind and avoid an IPv6 (::1) miss.
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${API_PORT}`,
          changeOrigin: true,
          // The API (tsx watch) restarts on backend edits — there's a ~2-3s window
          // where 3001 isn't listening yet. Handle ECONNREFUSED gracefully: return a
          // soft 503 the client can retry, instead of dumping proxy-error stack traces.
          configure: (proxy) => {
            proxy.on('error', (_err, _req, res) => {
              const r = res as any;
              if (r && typeof r.writeHead === 'function' && !r.headersSent) {
                try {
                  r.writeHead(503, {'Content-Type': 'application/json'});
                  r.end(
                    JSON.stringify({error: 'API server is restarting, retry shortly.'}),
                  );
                } catch {
                  /* socket already closed */
                }
              }
            });
          },
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // When watching IS on, ignore files the app/docs/tooling write at runtime so
      // they don't trigger spurious full-page reloads (the app writes the token,
      // snapshots, logs, config, and round-trip temp files into the project tree).
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {
              ignored: [
                // Pure-backend files the client never imports. Vite can't HMR them,
                // so without this it does a FULL PAGE RELOAD on every backend edit —
                // the API server (tsx watch) restarts on its own and the page stays put.
                '**/server.ts',
                '**/install_mod.ts',
                '**/use_agent_api.py',
                // App/doc/tooling writes that shouldn't trigger reloads.
                '**/.studio-api-token',
                // B2s3 workspace persistence: the API writes active/parked state on every
                // commit — without this every canvas edit full-reloads every client.
                '**/.studio-state/**',
                // B26 runtime-writes audit: server runtime data (AI usage meter, harvested
                // schemas, api-registry) — same spurious-reload class as .studio-state.
                '**/data/**',
                // B24s1: project-local debuglog fixtures (findDebugLogCandidates fallback).
                '**/debuglog.txt',
                '**/uidata.log',
                '**/.tmp_*',
                '**/*.log',
                '**/.snapshots/**',
                '**/dist/**',
                '**/temp_import/**',
                '**/temp_package_test.json',
                '**/config.json',
                '**/*.md',
              ],
            },
    },
  };
});
