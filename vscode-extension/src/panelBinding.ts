export interface PanelBackendDescriptor {
  baseUrl: string;
  owned: boolean;
  port?: number;
  token?: string;
}

function backendIdentity(backend: PanelBackendDescriptor): string {
  return JSON.stringify([backend.baseUrl, backend.owned, backend.port ?? null, backend.token ?? null]);
}

/**
 * Tracks which backend session the Studio iframe currently represents. A token change is
 * significant even when the OS reuses the same port: the new server injects a new session
 * credential into its HTML, so the iframe must be loaded again.
 */
export class PanelBackendBinding {
  private boundIdentity: string | null = null;

  bind(backend: PanelBackendDescriptor, render: (backend: PanelBackendDescriptor) => void): boolean {
    const nextIdentity = backendIdentity(backend);
    if (this.boundIdentity === nextIdentity) return false;
    render(backend);
    this.boundIdentity = nextIdentity;
    return true;
  }

  reset(): void {
    this.boundIdentity = null;
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
