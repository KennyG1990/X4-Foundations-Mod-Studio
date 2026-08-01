from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]


def require(path: str, tokens: list[str]) -> list[str]:
    text = (ROOT / path).read_text(encoding="utf-8")
    return [f"{path}: missing {token!r}" for token in tokens if token not in text]


errors: list[str] = []
errors += require(
    ".github/workflows/discord-to-github.yml",
    [
        "discord-sync:v1 origin=discord",
        "BOT_USER_ID",
        "gh issue list --state all",
        "sync-origin:discord",
        "thread=$THREAD_ID",
        "Skipping bot-owned GitHub mirror",
    ],
)
errors += require(
    ".github/workflows/issue-sync.yml",
    [
        "types: [opened, closed, reopened]",
        "record_mapping \"github\"",
        "issues/$ISSUE_NUM/comments",
        "patch_thread_state \"$THREAD_ID\" false false",
        "patch_thread_state \"$THREAD_ID\" true true",
        "discord-sync:v1 origin=$origin",
    ],
)
errors += require(
    ".github/DISCORD_GITHUB_SYNC.md",
    [
        "one GitHub issue ↔ one Discord forum thread",
        "Discord thread IDs and GitHub issue numbers are the deduplication keys",
        "Synchronize state, not messages.",
    ],
)

if errors:
    print("Discord/GitHub synchronization contract FAILED:")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("Discord/GitHub synchronization contract PASS")
