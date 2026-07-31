import https from 'https';
import { EmbedBuilder, ChannelType } from 'discord.js';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('data/galaxy_database.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS github_discord_sync (
    repo_name TEXT,
    issue_number INTEGER,
    guild_id TEXT,
    thread_id TEXT,
    issue_type TEXT,
    status TEXT DEFAULT 'open',
    PRIMARY KEY(repo_name, issue_number, guild_id)
  );
`);

const stmtGetSyncedIssue = db.prepare('SELECT * FROM github_discord_sync WHERE repo_name = ? AND issue_number = ? AND guild_id = ?');
const stmtInsertSyncedIssue = db.prepare('INSERT INTO github_discord_sync (repo_name, issue_number, guild_id, thread_id, issue_type, status) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(repo_name, issue_number, guild_id) DO UPDATE SET thread_id=excluded.thread_id, status=excluded.status');
const stmtDeleteSyncedIssue = db.prepare('DELETE FROM github_discord_sync WHERE repo_name = ? AND issue_number = ? AND guild_id = ?');
const stmtGetAllSyncedForGuild = db.prepare('SELECT * FROM github_discord_sync WHERE guild_id = ?');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

async function fetchGitHubIssues(repo) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/KennyG1990/${repo}/issues?state=all&per_page=100`,
      method: 'GET',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'NodeJS-Discord-Sync',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve([]);
          }
        } else {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

// STRICT REPO TO DISCORD SERVER ROUTING MATRIX
function isGuildForRepo(guildName, repoName) {
  const gLower = guildName.toLowerCase();
  if (repoName === 'X4_Forge') {
    return gLower.includes('forge');
  }
  if (repoName === 'x4_ai_influence') {
    return gLower.includes('ailive') || gLower.includes('ai influence');
  }
  return false;
}

export async function cleanupMismatchedPosts(clientInstances) {
  for (const clientInst of clientInstances) {
    for (const guild of clientInst.guilds.cache.values()) {
      const isForgeGuild = isGuildForRepo(guild.name, 'X4_Forge');
      const isAiLiveGuild = isGuildForRepo(guild.name, 'x4_ai_influence');

      const synced = stmtGetAllSyncedForGuild.all(guild.id);
      for (const row of synced) {
        // If X4_Forge issue was posted on AiLive server, delete it!
        if (row.repo_name === 'X4_Forge' && !isForgeGuild) {
          try {
            const thread = guild.channels.cache.get(row.thread_id);
            if (thread) await thread.delete('Mismatched repo cleanup');
            stmtDeleteSyncedIssue.run(row.repo_name, row.issue_number, guild.id);
            console.log(`🧹 Deleted mismatched X4_Forge issue #${row.issue_number} from ${guild.name}`);
          } catch (e) {}
        }
        // If x4_ai_influence issue was posted on Forge server, delete it!
        else if (row.repo_name === 'x4_ai_influence' && !isAiLiveGuild) {
          try {
            const thread = guild.channels.cache.get(row.thread_id);
            if (thread) await thread.delete('Mismatched repo cleanup');
            stmtDeleteSyncedIssue.run(row.repo_name, row.issue_number, guild.id);
            console.log(`🧹 Deleted mismatched x4_ai_influence issue #${row.issue_number} from ${guild.name}`);
          } catch (e) {}
        }
      }
    }
  }
}

export async function syncGitHubIssuesToDiscord(clientInstances) {
  // First clean up any wrong cross-posted threads
  await cleanupMismatchedPosts(clientInstances);

  const repos = ['X4_Forge', 'x4_ai_influence'];

  for (const repo of repos) {
    const issues = await fetchGitHubIssues(repo);
    if (!issues || !issues.length) continue;

    for (const clientInst of clientInstances) {
      for (const guild of clientInst.guilds.cache.values()) {
        // STRICT FILTERING: Match exact repo to exact guild!
        if (!isGuildForRepo(guild.name, repo)) {
          continue; // Skip! X4_Forge ONLY goes to Forge Discord; x4_ai_influence ONLY goes to AiLive Discord!
        }

        const bugChannel = guild.channels.cache.find(c => c.name === 'bug-reports' || c.name === '🐛-bug-reports');
        const featureChannel = guild.channels.cache.find(c => c.name === 'feature-requests' || c.name === '💡-feature-requests' || c.name === 'feature-board');

        for (const issue of issues) {
          if (issue.pull_request) continue;

          const isBug = issue.labels.some(l => l.name.toLowerCase().includes('bug'));
          const isFeature = issue.labels.some(l => l.name.toLowerCase().includes('enhancement') || l.name.toLowerCase().includes('feature'));

          const targetChannel = isBug ? bugChannel : (isFeature ? featureChannel : null);
          if (!targetChannel) continue;

          const existingSync = stmtGetSyncedIssue.get(repo, issue.number, guild.id);

          // CASE 1: Issue is OPEN on GitHub -> Ensure populated on appropriate Discord server
          if (issue.state === 'open') {
            if (!existingSync) {
              const embed = new EmbedBuilder()
                .setTitle(`[#${issue.number}] ${issue.title}`)
                .setURL(issue.html_url)
                .setColor(isBug ? 15548997 : 5763719)
                .setDescription((issue.body || 'No description provided.').slice(0, 2000))
                .setFooter({ text: `${repo} Issue #${issue.number} • Reported by @${issue.user?.login || 'community'}` });

              try {
                let threadOrMsg;
                if (targetChannel.type === ChannelType.GuildForum) {
                  threadOrMsg = await targetChannel.threads.create({
                    name: `[#${issue.number}] ${issue.title}`.slice(0, 100),
                    message: { embeds: [embed] }
                  });
                } else {
                  threadOrMsg = await targetChannel.send({ embeds: [embed] });
                }

                stmtInsertSyncedIssue.run(repo, issue.number, guild.id, threadOrMsg.id, isBug ? 'bug' : 'feature', 'open');
                console.log(`📌 Synced ${repo} #${issue.number} (${issue.title}) ONLY to ${guild.name}`);
              } catch (e) {
                console.warn(`⚠️ Could not post issue #${issue.number} to Discord: ${e.message}`);
              }
            }
          }
          // CASE 2: Issue is CLOSED on GitHub -> Automatically delete from Discord!
          else if (issue.state === 'closed' && existingSync) {
            try {
              if (targetChannel.type === ChannelType.GuildForum) {
                const thread = guild.channels.cache.get(existingSync.thread_id);
                if (thread) await thread.delete('Issue closed/deleted on GitHub');
              } else {
                const msg = await targetChannel.messages.fetch(existingSync.thread_id).catch(() => null);
                if (msg) await msg.delete();
              }
              console.log(`🗑️ Auto-deleted closed ${repo} #${issue.number} from ${guild.name}`);
            } catch (e) {
              console.warn(`⚠️ Could not auto-delete closed issue #${issue.number}: ${e.message}`);
            }
            stmtDeleteSyncedIssue.run(repo, issue.number, guild.id);
          }
        }
      }
    }
  }
}
