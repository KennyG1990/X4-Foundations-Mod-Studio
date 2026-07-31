/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Server-side AI provider key store. Plaintext keys never leave this process; the
 * browser can set a key and read boolean configuration status only.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { dataPath } from "../lib/dataDir";
import { atomicWriteJson, type AtomicWriteOptions } from "../lib/workspaceState";

export const AI_KEY_PROVIDERS = ["gemini", "claude", "openai", "openrouter"] as const;
export type AiKeyProvider = (typeof AI_KEY_PROVIDERS)[number];

const STORE_PATH = dataPath("ai-keys.json");

interface AiKeyStoreOptions {
  file: string;
  writeJson?: (file: string, value: unknown, options?: AtomicWriteOptions) => void;
}

export function createAiKeyStore(options: AiKeyStoreOptions) {
  const writeJson = options.writeJson || atomicWriteJson;
  const readStore = (strict: boolean): Record<string, string> => {
    try {
      const parsed = JSON.parse(fs.readFileSync(options.file, "utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
          !Object.entries(parsed).every(([provider, value]) => AI_KEY_PROVIDERS.includes(provider as AiKeyProvider) && typeof value === "string")) {
        throw new Error("credential store has an invalid shape");
      }
      return parsed as Record<string, string>;
    } catch (error: unknown) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
      if (code === "ENOENT") return {};
      if (strict) throw new Error(`AI credential store is unreadable; refusing to overwrite it: ${error instanceof Error ? error.message : String(error)}`);
      return {};
    }
  };

  const status = (): Record<string, boolean> => {
    const stored = readStore(false);
    const result: Record<string, boolean> = {};
    for (const provider of AI_KEY_PROVIDERS) result[provider] = typeof stored[provider] === "string" && stored[provider].length > 0;
    return result;
  };

  return {
    get(provider: string): string {
      if (!AI_KEY_PROVIDERS.includes(provider as AiKeyProvider)) return "";
      const value = readStore(false)[provider];
      return typeof value === "string" ? value : "";
    },
    set(provider: string, key: string): Record<string, boolean> {
      if (!AI_KEY_PROVIDERS.includes(provider as AiKeyProvider)) {
        throw new Error(`Unknown AI provider "${provider}". Valid: ${AI_KEY_PROVIDERS.join(", ")}`);
      }
      const stored = readStore(true);
      const trimmed = String(key || "").trim();
      if (trimmed) stored[provider] = trimmed;
      else delete stored[provider];
      writeJson(options.file, stored, { mode: 0o600 });
      return status();
    },
    status,
  };
}

const defaultStore = createAiKeyStore({ file: STORE_PATH });

export function getStoredAiKey(provider: string): string { return defaultStore.get(provider); }
export function setStoredAiKey(provider: string, key: string): Record<string, boolean> { return defaultStore.set(provider, key); }
export function aiKeyStatus(): Record<string, boolean> { return defaultStore.status(); }

export function runAiKeyStoreSelftest(): { pass: boolean; checks: Array<{ name: string; pass: boolean; detail?: string }> } {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
  const ok = (name: string, pass: boolean, detail?: string) => checks.push({ name, pass: !!pass, detail });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "x4forge-ai-keys-"));
  const file = path.join(root, "ai-keys.json");
  try {
    const store = createAiKeyStore({ file });
    ok("missing_store_is_empty", Object.values(store.status()).every(value => value === false));
    const afterSet = store.set("gemini", " secret-value ");
    ok("set_roundtrip_and_status", store.get("gemini") === "secret-value" && afterSet.gemini === true);
    ok("plaintext_never_returned_by_status", !JSON.stringify(afterSet).includes("secret-value"));
    ok("restricted_mode", process.platform === "win32" || (fs.statSync(file).mode & 0o777) === 0o600);
    store.set("gemini", "");
    ok("empty_key_deletes", store.get("gemini") === "" && store.status().gemini === false);

    const writeInvalidStore = (text: string) => fs.writeFileSync(file, text, "utf8");
    writeInvalidStore("{corrupt");
    const corruptBytes = fs.readFileSync(file, "utf8");
    let corruptRejected = false;
    try { store.set("openai", "must-not-write"); } catch (error) { corruptRejected = /refusing to overwrite/.test(String(error)); }
    ok("corrupt_store_refuses_mutation", corruptRejected && fs.readFileSync(file, "utf8") === corruptBytes);
    writeInvalidStore('{"gemini":42}');
    let invalidShapeRejected = false;
    try { store.set("openai", "must-not-write-shape"); } catch (error) { invalidShapeRejected = /invalid shape/.test(String(error)); }
    ok("invalid_shape_refuses_mutation", invalidShapeRejected && fs.readFileSync(file, "utf8") === '{"gemini":42}');

    atomicWriteJson(file, { gemini: "last-known-good" }, { mode: 0o600 });
    const failing = createAiKeyStore({
      file,
      writeJson: (target, value, options) => atomicWriteJson(target, value, {
        ...options,
        beforeRename: () => { throw new Error("injected write failure"); },
      }),
    });
    let failureReported = false;
    try { failing.set("openai", "new-secret"); } catch (error) { failureReported = /injected write failure/.test(String(error)); }
    const reopened = createAiKeyStore({ file });
    ok("failed_write_preserves_previous_credentials", failureReported && reopened.get("gemini") === "last-known-good" && reopened.get("openai") === "");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  return { pass: checks.every(check => check.pass), checks };
}
