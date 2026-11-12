# @delthin/dsh-cardex

Record one discussion inside any DSH conversation, then let an organizing model split it into self-contained Markdown knowledge cards, keep a knowledge tree up to three levels deep, and build an offline HTML graph. Ported from the Pi extension [`pi-cardex`](https://github.com/Delthin/pi-cardex); it uses the `~/journal/cardex` v2 data format and can read v1 indexes.

[中文](./README.md)

## Features

- `/cardex <question>` opens the recording and asks the question; every later turn in that conversation belongs to the discussion automatically.
- `/cardex end` runs two model calls: organize the notes (title, summary, background, Markdown body, source message indices), then plan the archive (match existing cards, create groups, keep the three-level tree, add semantic links).
- The model can match a new discussion to an existing card and add to it; archive batches are kept in dated sections.
- Produces `index.html`: offline reading, tree navigation, semantic relations, and per-batch sections. No external resources.

## Differences from the Pi version

The old extension intercepted input, pushed messages that arrived mid-run back into the editor, and required a manual `end`. This port instead:

| Before | Now |
| --- | --- |
| `input` interception swallowed messages during a run | No interception; the transcript is read from the durable session log at archive time |
| Manual `/card end` after every session | Still `end`, but you can keep asking at any time |
| `/card end extra words` silently became a question | Subcommands reject extra arguments and point at `/cardex --` |
| A failed archive re-read the conversation | After organization succeeds, the transcript and record id are frozen before archive writes and reused on retry |
| Opening a discussion could cost an extra retrieval call | Retrieval is a hint; failures never block recording |

No agent preset is used: DSH presets are fixed before the first turn, so switching presets starts a different conversation and loses the discussion context. Recording therefore lives inside the session behind `/cardex`.

## Install

```bash
npm install @delthin/dsh-cardex
```

Then send `/cardex help` in any conversation to confirm it is active.

## Commands

| Command | Purpose |
| --- | --- |
| `/cardex <question>` | Open the recording and send the question |
| `/cardex end` | Close the recording: organize cards, archive, rebuild the graph |
| `/cardex cancel` | Drop this recording (chat messages stay) |
| `/cardex status` | Show the open recording, directory and organizing model |
| `/cardex dir [path]` | Show or set the default archive directory |
| `/cardex model` / `follow` / `current` / `provider/model-id` | Show or set the organizing model |
| `/cardex graph` | Rebuild the offline graph only |
| `/cardex help` | Command list |
| `/cardex -- <question>` | Escape a question that starts with a subcommand word |

The organizing model follows the current session model by default; it can be pinned to any `provider/model-id`. Organizing calls never enter a tool loop, accept text JSON only, and time out after 120 seconds by default.

## Configuration

The settings file defaults to `$DSH_HOME/cardex.json` (`~/.dsh/cardex.json` when unset), shaped like the old `~/.pi/agent/pi-cardex.json`:

```json
{
  "version": 1,
  "directory": "~/journal/cardex",
  "model": null,
  "timeoutMs": 120000
}
```

If the settings file omits `directory`, the plugin default applies, falling back to `~/journal/cardex`; a `null` `model` follows the session model. Plugin values `directory`, `model`, and `timeoutMs` provide defaults that the settings file overrides. Changes to these defaults apply live: an operation keeps its starting configuration, and later commands read the new values. An open recording keeps its original archive directory. `configPath` selects the settings file; changing it reloads the plugin.

## Data

```
<directory>/
  index.json            knowledge tree index (version 2, reads v1)
  index.html            offline reader and relation graph
  cards/<id>.md         one card, sectioned by archive batch
  discussions/<id>.md   original Q&A for card back-references
```

Writes use atomic replacement (temp file + `fsync` + `rename`) with a transaction file and lock. Once the lock is acquired, a valid pending transaction is replayed on the next run. An abnormal exit can leave `.pi-cardex.lock` behind; after confirming no process is writing to the knowledge base, remove the lock file manually and retry. The record id is the first 20 hex characters of SHA-256 over the draft id and transcript, so archiving the same discussion twice cannot duplicate cards.

## Safety

- Organization sends the discussion to the selected model provider; archive planning and optional catalog retrieval also send existing catalog titles, summaries and structural metadata. Cards, transcripts and the graph are written locally.
- Input JSON is marked as data, and the prompt tells the model to ignore instructions inside it.
- Only user-authored messages are archived; injected user-role messages (schedules, approvals, titles) are excluded.
- No telemetry. Organizing and optional knowledge-index retrieval use the configured model through the host; archive files stay local.
- The offline HTML graph embeds card text, which may include original questions and answers. Review its contents before sharing.

## FAQ

**Archiving is slow or failed?** `end` is the expensive step (two model calls). After organization succeeds the transcript is frozen before archive writes, and a later retry reuses it; already written records are reported as recovered. If the organization call itself fails, a retry reads the conversation again.

**How many discussions per conversation?** One at a time. After `end` or `cancel` you can start another in the same conversation.

**Why is a reply missing from the card?** Only Q&A before `end` is archived, and a trailing unanswered question must be answered first.
