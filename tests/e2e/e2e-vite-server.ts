import fs from 'node:fs';
import path from 'node:path';
import { createServer, type ViteDevServer } from 'vite';
import {
  E2E_API_PORT,
  E2E_TOKEN,
  E2E_VITE_ENV,
  E2E_WEB_PORT,
} from '../../playwright.config';

const E2E_VITE_HOST = '127.0.0.1';
const ENV_KEYS = Object.keys(E2E_VITE_ENV) as Array<keyof typeof E2E_VITE_ENV>;

export interface E2EViteServerOptions {
  rootDir?: string;
  port?: number;
  apiPort?: number;
  token?: string;
}

export interface E2EViteServerHandle {
  port: number;
  server: ViteDevServer;
  close(): Promise<void>;
}

type EnvironmentSnapshot = Record<keyof typeof E2E_VITE_ENV, string | undefined>;

function assertPort(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 65_535) {
    throw new RangeError(`${name} must be an integer between 0 and 65535`);
  }
}

function snapshotEnvironment(): EnvironmentSnapshot {
  return Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]])) as EnvironmentSnapshot;
}

function applyEnvironment(apiPort: number, token: string): void {
  const desired = {
    ...E2E_VITE_ENV,
    API_PORT: String(apiPort),
    STUDIO_API_TOKEN: token,
    DISABLE_HMR: 'true',
  };
  for (const key of ENV_KEYS) process.env[key] = desired[key];
}

function restoreEnvironment(snapshot: EnvironmentSnapshot): void {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function listeningPort(server: ViteDevServer): number {
  const address = server.httpServer?.address();
  if (address === null || address === undefined || typeof address === 'string') {
    throw new Error('Vite did not expose a TCP listener after listen()');
  }
  if (!Number.isInteger(address.port) || address.port <= 0) {
    throw new Error('Vite exposed an invalid TCP listener port after listen()');
  }
  return address.port;
}

function startupError(error: unknown, cleanupError: unknown): Error {
  const startMessage = error instanceof Error ? error.message : String(error);
  if (cleanupError === undefined) return error instanceof Error ? error : new Error(startMessage);
  const closeMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
  return new Error(`Vite startup failed and cleanup failed: ${startMessage}; cleanup: ${closeMessage}`, {
    cause: error,
  });
}

/**
 * Start the E2E UI server in the calling Playwright runner process.
 *
 * The repository Vite config is loaded after the temporary environment is applied so its
 * token plugin and /api proxy observe the isolated E2E values. The environment remains
 * applied until close because transformIndexHtml reads the token at request time.
 */
export async function startE2EViteServer(options: E2EViteServerOptions = {}): Promise<E2EViteServerHandle> {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const configFile = path.join(rootDir, 'vite.config.ts');
  const port = options.port ?? E2E_WEB_PORT;
  const apiPort = options.apiPort ?? E2E_API_PORT;
  const token = options.token ?? E2E_TOKEN;
  assertPort('Vite port', port);
  assertPort('API proxy port', apiPort);
  if (token.trim().length === 0) throw new Error('E2E Vite token must not be empty');
  if (!fs.existsSync(configFile)) throw new Error(`Vite config not found: ${configFile}`);

  const environment = snapshotEnvironment();
  let server: ViteDevServer | undefined;
  try {
    applyEnvironment(apiPort, token);
    server = await createServer({
      root: rootDir,
      configFile,
      clearScreen: false,
      logLevel: 'error',
      server: {
        host: E2E_VITE_HOST,
        port,
        strictPort: true,
        hmr: false,
        watch: null,
      },
    });
    await server.listen();
    const actualPort = listeningPort(server);
    let closePromise: Promise<void> | undefined;
    return {
      port: actualPort,
      server,
      close: () => {
        closePromise ??= (async () => {
          try {
            await server!.close();
          } finally {
            restoreEnvironment(environment);
          }
        })();
        return closePromise;
      },
    };
  } catch (error) {
    let cleanupError: unknown;
    try {
      await server?.close();
    } catch (closeError) {
      cleanupError = closeError;
    } finally {
      restoreEnvironment(environment);
    }
    throw startupError(error, cleanupError);
  }
}
