import fs from 'fs';
import path from 'path';

const KNOWN_FIXES_PATH = path.resolve('data/known_fixes.json');

function loadKnownFixes() {
  try {
    if (fs.existsSync(KNOWN_FIXES_PATH)) {
      return JSON.parse(fs.readFileSync(KNOWN_FIXES_PATH, 'utf-8'));
    }
  } catch (e) {
    console.warn('⚠️ Could not load data/known_fixes.json:', e.message);
  }
  return [];
}

function saveKnownFixes(fixes) {
  try {
    const dir = path.dirname(KNOWN_FIXES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(KNOWN_FIXES_PATH, JSON.stringify(fixes, null, 2), 'utf-8');
  } catch (e) {
    console.error('❌ Could not save data/known_fixes.json:', e);
  }
}

// 1. INGEST FROM MARKDOWN DOCUMENTATION (KNOWN-BUGS.md, ROADMAP.md, HANDOFF.md)
export function ingestFromMarkdownDocs() {
  const extractedFixes = [];
  const docPaths = [
    { repo: 'X4_Forge', file: path.resolve('F:/DEV_ENV/X4_Forge/KNOWN-BUGS.md'), category: 'x4_forge' },
    { repo: 'X4_Forge', file: path.resolve('F:/DEV_ENV/X4_Forge/ROADMAP.md'), category: 'x4_forge' },
    { repo: 'X4_Forge', file: path.resolve('F:/DEV_ENV/X4_Forge/SESSION-HANDOFF.md'), category: 'x4_forge' },
    { repo: 'x4_ai_influence', file: path.resolve('F:/DEV_ENV/projects/Mods/X4Mods/x4_ai_influence/README.md'), category: 'x4_ailive' },
    { repo: 'x4_ai_influence', file: path.resolve('F:/DEV_ENV/projects/Mods/X4Mods/x4_ai_influence/docs/ROADMAP.md'), category: 'x4_ailive' },
    { repo: 'x4_ai_influence', file: path.resolve('F:/DEV_ENV/projects/Mods/X4Mods/x4_ai_influence/docs/BACKLOG.md'), category: 'x4_ailive' }
  ];

  for (const doc of docPaths) {
    if (!fs.existsSync(doc.file)) continue;
    try {
      const content = fs.readFileSync(doc.file, 'utf-8');
      const lines = content.split('\n');
      let currentSection = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('## ') || line.startsWith('### ')) {
          currentSection = line.replace(/^#+\s*/, '').toLowerCase();
        }

        // Look for bug or defect mentions under bug sections
        if (currentSection.includes('defect') || currentSection.includes('bug') || currentSection.includes('known')) {
          if (line.startsWith('- ') || line.startsWith('* ') || line.match(/^\d+\./)) {
            const itemText = line.replace(/^[-*\d.]+\s*/, '').trim();
            if (itemText.length > 15 && !itemText.toLowerCase().includes('none currently recorded')) {
              // Create short id & keywords from item title
              const cleanTitle = itemText.split(':')[0].split('—')[0].slice(0, 60);
              const keywords = cleanTitle
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 3);

              if (keywords.length >= 2) {
                const id = `doc-${doc.repo.toLowerCase()}-${keywords.slice(0, 3).join('-')}`;
                extractedFixes.push({
                  id,
                  title: cleanTitle,
                  keywords,
                  fix: itemText,
                  category: doc.category,
                  source: `Doc: ${doc.repo}/${path.basename(doc.file)}`,
                  matchCount: 0
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn(`⚠️ Warning reading doc ${doc.file}:`, e.message);
    }
  }

  return extractedFixes;
}

// 2. INGEST FROM GITHUB ISSUES API
export async function ingestFromGitHubIssues() {
  const extractedFixes = [];
  const repos = [
    { name: 'KennyG1990/X4_Forge', category: 'x4_forge' },
    { name: 'KennyG1990/x4_ai_influence', category: 'x4_ailive' }
  ];

  const githubToken = process.env.GITHUB_TOKEN || process.env.GH_PAT || '';
  const headers = { 'User-Agent': 'X4ForgeBot' };
  if (githubToken) {
    headers['Authorization'] = `token ${githubToken}`;
  }

  for (const repo of repos) {
    try {
      const url = `https://api.github.com/repos/${repo.name}/issues?state=all&per_page=30`;
      const res = await fetch(url, { headers });
      if (!res.ok) continue;

      const issues = await res.json();
      if (!Array.isArray(issues)) continue;

      for (const issue of issues) {
        if (issue.pull_request) continue; // Skip pull requests

        const isBug = (issue.labels || []).some(l => (l.name || '').toLowerCase().includes('bug')) ||
                      (issue.title || '').toLowerCase().includes('bug') ||
                      (issue.title || '').toLowerCase().includes('fix') ||
                      (issue.title || '').toLowerCase().includes('issue');

        if (isBug) {
          const cleanTitle = issue.title.slice(0, 80);
          const keywords = cleanTitle
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3);

          if (keywords.length >= 2) {
            const id = `gh-${issue.number}-${keywords.slice(0, 2).join('-')}`;
            let fixText = `GitHub Issue #${issue.number} (${issue.state}): ${issue.html_url}`;
            if (issue.body) {
              fixText += `\nSummary: ${issue.body.slice(0, 200).replace(/\r?\n/g, ' ')}`;
            }

            extractedFixes.push({
              id,
              title: cleanTitle,
              keywords,
              fix: fixText,
              category: repo.category,
              source: `GitHub Issue #${issue.number}`,
              matchCount: 0
            });
          }
        }
      }
    } catch (e) {
      console.warn(`⚠️ Warning fetching GitHub issues for ${repo.name}:`, e.message);
    }
  }

  return extractedFixes;
}

// 3. MASTER SYNC FUNCTION
export async function syncAllKnownFixes() {
  const existingFixes = loadKnownFixes();
  const existingMap = new Map(existingFixes.map(f => [f.id, f]));

  const docFixes = ingestFromMarkdownDocs();
  const ghFixes = await ingestFromGitHubIssues();

  let addedCount = 0;

  for (const item of [...docFixes, ...ghFixes]) {
    if (!existingMap.has(item.id)) {
      existingMap.set(item.id, item);
      addedCount++;
    } else {
      // Update fix text and source if changed, preserving matchCount
      const existing = existingMap.get(item.id);
      existing.fix = item.fix;
      existing.source = item.source || existing.source;
    }
  }

  const mergedList = Array.from(existingMap.values());
  saveKnownFixes(mergedList);
  console.log(`✅ Synced Known Fixes database: ${mergedList.length} total entries (${addedCount} newly ingested).`);
  return mergedList;
}

// CLI runner if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  syncAllKnownFixes().then(() => console.log('Ingestion complete!'));
}
