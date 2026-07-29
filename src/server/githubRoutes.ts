/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GitHub proxy routes — stage 3 of the server modularization (2026-07-08).
 * Extracted verbatim from server.ts ("SECURE GITHUB API SYSTEM PROXY"): load, push,
 * create-repo, device-flow start/poll, and commit history. Self-contained: only
 * fetch/Buffer/express — no Forge services. All routes stay behind the bearer-token
 * auth middleware (none are in PUBLIC_READONLY_GETS).
 */

import type { Express, Response } from "express";
import { createGithubCredentialStore } from './githubCredentialStore';

const credentialStore = createGithubCredentialStore();
const MAX_PUSH_FILES = 100;
const MAX_PUSH_BYTES = 10 * 1024 * 1024;
const MAX_LOADED_FILE_BYTES = 10 * 1024 * 1024;

function storedCredential(res: Response): string | null {
  const token = credentialStore.get();
  if (token) return token;
  res.status(401).json({ error: 'GitHub is not connected. Connect in Source Control settings first.', code: 'GITHUB_NOT_CONNECTED' });
  return null;
}

export function registerGithubRoutes(app: Express): void {

  app.get('/api/github/credential', (_req, res) => {
    return res.json({ configured: credentialStore.configured() });
  });

  app.post('/api/github/credential', (req, res) => {
    try {
      credentialStore.set(String(req.body?.token || ''));
      return res.json({ configured: true });
    } catch (error) {
      return res.status(400).json({ configured: credentialStore.configured(), error: (error as Error).message });
    }
  });

  app.delete('/api/github/credential', (_req, res) => {
    credentialStore.clear();
    return res.json({ configured: false, deleted: true });
  });

  app.post("/api/github/load", async (req, res) => {
    const { owner, repo, path: filePath, branch } = req.body;

    const pat = storedCredential(res);
    if (!pat) return;

    if (!owner || !repo || !filePath) {
      return res.status(400).json({ error: "Missing repo parameters (owner, repo, or path)." });
    }

    // Token is optional if repo is public, but helpful to configure
    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "x4-md-studio-proxy"
    };

    headers["Authorization"] = `token ${pat}`;

    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch || "main"}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          error: `GitHub returned error: ${response.statusText}`,
          details: errorText
        });
      }

      const data: any = await response.json();
      if (data.type !== "file") {
        return res.status(400).json({ error: "Selected path is not a single file." });
      }

      if (Number(data.size || 0) > MAX_LOADED_FILE_BYTES) {
        return res.status(413).json({ error: `GitHub file exceeds the ${MAX_LOADED_FILE_BYTES}-byte load limit.`, code: 'GITHUB_FILE_TOO_LARGE' });
      }

      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      if (Buffer.byteLength(decoded, 'utf8') > MAX_LOADED_FILE_BYTES) {
        return res.status(413).json({ error: `GitHub file exceeds the ${MAX_LOADED_FILE_BYTES}-byte load limit.`, code: 'GITHUB_FILE_TOO_LARGE' });
      }
      return res.json({
        success: true,
        sha: data.sha,
        content: decoded,
        fileName: data.name
      });
    } catch (error) {
      console.error("GitHub file load error: ", error);
      return res.status(500).json({ error: (error as Error).message || "Failed to load file from GitHub." });
    }
  });

  app.post("/api/github/push", async (req, res) => {
    const { owner, repo, branch, commitMessage, files } = req.body;

    const pat = storedCredential(res);
    if (!pat) return;
    if (!owner || !repo) {
      return res.status(400).json({ error: "Owner and repository name are required." });
    }
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "No files provided to push." });
    }
    if (files.length > MAX_PUSH_FILES) {
      return res.status(413).json({ error: `GitHub push is limited to ${MAX_PUSH_FILES} files per request.`, code: 'GITHUB_PUSH_TOO_LARGE' });
    }
    const totalBytes = files.reduce((sum: number, file: any) => sum + Buffer.byteLength(String(file?.content ?? ''), 'utf8'), 0);
    if (totalBytes > MAX_PUSH_BYTES) {
      return res.status(413).json({ error: `GitHub push exceeds the ${MAX_PUSH_BYTES}-byte request limit.`, code: 'GITHUB_PUSH_TOO_LARGE' });
    }

    const selectedBranch = branch || "main";
    const msg = commitMessage || "Update mod files from X4 Forge";
    const results: any[] = [];

    try {
      // For each file, we'll sequentially commit it
      for (const file of files) {
        const { path: filePath, content } = file;
        if (!filePath || content === undefined) continue;

        const headers: Record<string, string> = {
          "Accept": "application/vnd.github.v3+json",
          "Authorization": `token ${pat}`,
          "User-Agent": "x4-md-studio-proxy"
        };

        // 1. Get the pre-existing SHA if it exists
        let currentSha: string | undefined;
        const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${selectedBranch}`;

        try {
          const getRes = await fetch(getUrl, { headers });
          if (getRes.status === 200) {
            const getData: any = await getRes.json();
            currentSha = getData.sha;
          }
        } catch {
          // Log error but ignore (might be new file)
          console.log(`Pre-fetch SHA failed for ${filePath}, assuming new file.`);
        }

        // 2. Put file contents back
        const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
        const base64Content = Buffer.from(content).toString("base64");

        const bodyPayload: any = {
          message: msg,
          content: base64Content,
          branch: selectedBranch
        };

        if (currentSha) {
          bodyPayload.sha = currentSha;
        }

        const putRes = await fetch(putUrl, {
          method: "PUT",
          headers: {
            ...headers,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(bodyPayload)
        });

        if (!putRes.ok) {
          const errDetails = await putRes.text();
          throw new Error(`Failed to push file: ${filePath}. Status: ${putRes.status}, Response: ${errDetails}`);
        }

        const putData: any = await putRes.json();
        results.push({
          path: filePath,
          sha: putData.content.sha,
          success: true
        });
      }

      return res.json({
        success: true,
        message: `Successfully pushed ${results.length} files to ${owner}/${repo} on branch ${selectedBranch}.`,
        results
      });

    } catch (error) {
      console.error("GitHub push error: ", error);
      return res.status(500).json({ error: (error as Error).message || "Failed to commit files to GitHub." });
    }
  });

  /**
   * POST /api/github/create
   * Creates a new GitHub repository under the authenticated user (from the PAT),
   * so a mod-in-progress can be published as a fresh repo in one click.
   */
  app.post("/api/github/create", async (req, res) => {
    const { name, description, private: isPrivate } = req.body;

    const pat = storedCredential(res);
    if (!pat) return;
    if (!name) {
      return res.status(400).json({ error: "Repository name is required." });
    }

    try {
      const response = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "Authorization": `token ${pat}`,
          "User-Agent": "x4-md-studio-proxy",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          description: description || "X4 Foundations mod created with X4 Forge",
          private: !!isPrivate,
          auto_init: false
        })
      });

      const data: any = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({
          error: data?.message || `GitHub returned error code ${response.status}`,
          details: data?.errors
        });
      }

      return res.json({
        success: true,
        owner: data.owner?.login,
        repo: data.name,
        full_name: data.full_name,
        html_url: data.html_url,
        default_branch: data.default_branch || "main"
      });
    } catch (error) {
      console.error("GitHub create-repo error: ", error);
      return res.status(500).json({ error: (error as Error).message || "Failed to create GitHub repository." });
    }
  });

  /**
   * POST /api/github/device/start
   * Begins the GitHub OAuth Device Flow: requests a device + user code so the user can
   * authorize in their browser (no PAT copy-paste, no client secret needed).
   */
  app.post("/api/github/device/start", async (req, res) => {
    const clientId = String(req.body?.client_id || process.env.GITHUB_CLIENT_ID || "").trim();
    const scope = String(req.body?.scope || "repo").trim();
    if (!clientId) {
      return res.status(400).json({ error: "Missing GitHub OAuth Client ID. Register an OAuth App (with Device Flow enabled) and provide its Client ID." });
    }
    try {
      const response = await fetch("https://github.com/login/device/code", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json", "User-Agent": "x4-md-studio" },
        body: JSON.stringify({ client_id: clientId, scope })
      });
      const data: any = await response.json();
      if (!response.ok || data.error) {
        return res.status(400).json({ error: data.error_description || data.error || "Failed to start GitHub device authorization." });
      }
      // data: device_code, user_code, verification_uri, expires_in, interval
      return res.json(data);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message || "Device authorization request failed." });
    }
  });

  /**
   * POST /api/github/device/poll
   * Polls GitHub for the device-flow access token. Returns { pending: true } until the
   * user approves, then stores the token server-side and returns status/login only.
   */
  app.post("/api/github/device/poll", async (req, res) => {
    const clientId = String(req.body?.client_id || process.env.GITHUB_CLIENT_ID || "").trim();
    const deviceCode = String(req.body?.device_code || "").trim();
    if (!clientId || !deviceCode) {
      return res.status(400).json({ error: "Missing client_id or device_code." });
    }
    try {
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json", "User-Agent": "x4-md-studio" },
        body: JSON.stringify({
          client_id: clientId,
          device_code: deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code"
        })
      });
      const data: any = await response.json();

      if (data.access_token) {
        credentialStore.set(String(data.access_token));
        // Fetch the authenticated user's login so the client can auto-fill the repo owner.
        let login: string | undefined;
        try {
          const userRes = await fetch("https://api.github.com/user", {
            headers: {
              "Accept": "application/vnd.github.v3+json",
              "Authorization": `token ${data.access_token}`,
              "User-Agent": "x4-md-studio"
            }
          });
          const userData: any = await userRes.json();
          login = userData?.login;
        } catch {
          // Non-fatal; owner can be entered manually.
        }
        return res.json({ connected: true, token_type: data.token_type, scope: data.scope, login });
      }

      // Still waiting / throttled / expired — surface the GitHub error code to the poller.
      return res.json({ pending: true, error: data.error, interval: data.interval });
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message || "Device token poll failed." });
    }
  });

  /**
   * POST /api/github/commits
   * Returns the real commit history for the connected repo/branch so the Graph Log
   * reflects the actual mod repository instead of seeded placeholder data.
   */
  app.post("/api/github/commits", async (req, res) => {
    const { owner, repo, branch } = req.body;
    const pat = storedCredential(res);
    if (!pat) return;
    if (!owner || !repo) {
      return res.status(400).json({ error: "Missing owner or repo." });
    }
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch || "main")}&per_page=50`;
      const response = await fetch(url, {
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "Authorization": `token ${pat}`,
          "User-Agent": "x4-md-studio-proxy"
        }
      });
      const data: any = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ error: data?.message || `GitHub returned ${response.status}` });
      }
      const commits = (Array.isArray(data) ? data : []).map((c: any) => ({
        sha: (c.sha || "").substring(0, 7),
        message: (c.commit?.message || "").split("\n")[0],
        body: c.commit?.message || "",
        author: c.commit?.author?.name || c.author?.login || "unknown",
        email: c.commit?.author?.email || "",
        date: c.commit?.author?.date || "",
        html_url: c.html_url
      }));
      return res.json({ commits });
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message || "Failed to fetch repository commits." });
    }
  });
}
