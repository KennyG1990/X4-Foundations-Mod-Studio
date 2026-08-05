export interface PanelBackendDescriptor {
  baseUrl: string;
  owned: boolean;
  port?: number;
  token?: string;
}

function backendIdentity(backend: PanelBackendDescriptor): string {
  return JSON.stringify([backend.baseUrl, backend.owned, backend.port ?? null, backend.token ?? null]);
}

type PanelRenderer = (backend: PanelBackendDescriptor) => void;

interface TrackedPanel {
  render: PanelRenderer;
  boundIdentity: string | null;
}

const LEGACY_PANEL_KEY = "\u0000legacy-panel";

/**
 * Tracks the backend session represented by each Studio iframe. A token change is significant
 * even when the OS reuses the same port: the new server injects a new session credential into
 * its HTML, so every affected iframe must be loaded again.
 */
export class PanelBackendBinding {
  private readonly panels = new Map<string, TrackedPanel>();
  private activePanelKey: string | null = null;

  track(panelKey: string, render: PanelRenderer): void {
    if (!panelKey) throw new Error("A Studio panel key is required.");
    if (this.panels.has(panelKey)) return;
    this.panels.set(panelKey, { render, boundIdentity: null });
    if (this.activePanelKey === null) this.activePanelKey = panelKey;
  }

  untrack(panelKey: string): void {
    if (!this.panels.delete(panelKey)) return;
    if (this.activePanelKey !== panelKey) return;
    this.activePanelKey = this.panels.keys().next().value ?? null;
  }

  setActive(panelKey: string): boolean {
    if (!this.panels.has(panelKey)) return false;
    this.activePanelKey = panelKey;
    return true;
  }

  getActiveKey(): string | null {
    return this.activePanelKey;
  }

  bind(backend: PanelBackendDescriptor, legacyRender?: PanelRenderer): boolean {
    if (legacyRender) this.track(LEGACY_PANEL_KEY, legacyRender);
    const nextIdentity = backendIdentity(backend);
    let rebound = false;
    for (const panel of this.panels.values()) {
      if (panel.boundIdentity === nextIdentity) continue;
      panel.render(backend);
      panel.boundIdentity = nextIdentity;
      rebound = true;
    }
    return rebound;
  }

  reset(panelKey?: string): void {
    if (panelKey !== undefined) {
      const panel = this.panels.get(panelKey);
      if (panel) panel.boundIdentity = null;
      return;
    }
    for (const panel of this.panels.values()) panel.boundIdentity = null;
  }
}

/**
 * Coalesces backend startup without skipping per-caller readiness work. Every caller that
 * joins the shared promise still runs `onReady` after it resolves. This matters for restored
 * webviews: the startup owner may have completed before the serializer tracks its panel.
 */
export class SharedBackendEnsure<T> {
  private pending: Promise<T> | null = null;

  async run(start: () => Promise<T>, onReady: (value: T) => void): Promise<T> {
    const active = this.pending ?? start();
    if (!this.pending) this.pending = active;
    try {
      const value = await active;
      onReady(value);
      return value;
    } finally {
      if (this.pending === active) this.pending = null;
    }
  }
}
