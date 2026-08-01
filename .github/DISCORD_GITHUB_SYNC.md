# Discord ↔ GitHub Issue Synchronization

## Authority model

GitHub Issues is the canonical issue database. Discord is a submission and discussion surface.

The synchronizer maintains one stable relationship:

```text
one GitHub issue ↔ one Discord forum thread
```

It synchronizes identity and issue state. It does not mirror every message in both directions.

## Provenance contract

Every synchronized relationship carries an immutable marker:

```text
discord-sync:v1 origin=<discord|github> repo=<owner/repo> guild=<id> forum=<id> thread=<id> issue=<number>
```

- Discord-origin reports store the marker in the GitHub issue body.
- GitHub-origin reports store the marker in a GitHub issue comment after Discord returns the created thread ID.
- Discord thread IDs and GitHub issue numbers are the deduplication keys. Titles are never identity.

## Discord → GitHub

A Discord forum thread creates a GitHub issue only when all of the following are true:

- the thread was created by a human, not the sync bot;
- the starter message is not bot-authored;
- the title or starter content does not identify a GitHub mirror;
- no issue in this repository already carries that Discord thread ID.

The created issue receives an `origin=discord` marker and a link to the source thread. The bot replies in the Discord thread with the canonical GitHub issue link.

## GitHub → Discord

A GitHub issue creates a Discord thread only when it has no recorded Discord mapping.

After Discord creates the thread, the workflow writes an `origin=github` mapping comment back to the issue. Repeated workflow delivery, reopening, or title edits must never create another thread.

State transitions are synchronized as follows:

- `opened`: create a thread only when no mapping exists;
- `reopened`: unarchive the mapped thread and post a state notice;
- `closed`: post a state notice, then archive and lock the mapped thread.

A Discord-origin issue uses its original Discord thread for these state transitions. It is never echoed into a second thread.

## Repository isolation

Each repository must use its own bug-report and feature-request forums unless a separate central router assigns threads to repositories. Two independent repository workflows must never watch the same human-submission forums, because both would correctly interpret an unmapped human thread as their own report.

Configuration:

- secret: `DISCORD_TOKEN`
- variable: `DISCORD_GUILD_ID`
- variable: `DISCORD_BUG_FORUM_ID`
- variable: `DISCORD_FEATURE_FORUM_ID`

X4 Forge retains its original IDs as backward-compatible defaults. Other repositories must configure explicit variables.

## Failure policy

The synchronizer fails closed when it cannot establish provenance. It must not import threads when the bot identity cannot be resolved, create an issue without a stable thread marker, or create a Discord mirror without recording the returned thread ID.

The design rule is:

> Synchronize state, not messages.
