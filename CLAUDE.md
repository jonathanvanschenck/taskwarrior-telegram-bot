# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Telegram bot that provides a chat interface to [Taskwarrior](https://taskwarrior.org/), the command-line task management tool. Users interact with tasks via Telegram commands, which the bot translates into `task` CLI invocations.

## Commands

- **Run**: `node index.js`
- **No build step** (plain Node.js with CommonJS modules)
- **No test framework or linter configured yet**

## Architecture

Three-layer design:

1. **Entry point** (`index.js`) — Initializes logger, Taskwarrior wrapper, and Telegram bot; handles graceful shutdown via SIGINT/SIGTERM.
2. **Taskwarrior wrapper** (`lib/taskwarrior.js`) — Spawns the external `task` CLI binary via `child_process.spawn()`. Provides async methods for task operations (list, info, add, modify, delete, done, etc.). Parses JSON export output and normalizes task data. Includes `parse_mods()` for extracting structured modifications (project:, priority:, due:, +tag/-tag, etc.) from free-text input.
3. **Telegram bot** (`lib/telegram.js`) — Built on Telegraf. Registers `/command` handlers that extract arguments from message text, call Taskwarrior methods, and format responses. Includes authorization middleware with optional `chat_id` and `user_id` restrictions.

**Config** (`env.js`) — Loads `.env` via dotenv, exports structured config for Taskwarrior paths (`bin`, `taskrc`, `taskdata`) and Telegram credentials (`bot_token`, `chat_id`, `user_id`).

## Key Dependencies

- **telegraf** — Telegram Bot API framework
- **dotenv** — Environment variable loading
- **yalls** — Logging library

## Environment Variables

Configured in `.env` (gitignored):

| Variable | Required | Description |
|---|---|---|
| `TW_BIN` | No | Path to `task` binary (default: `task`) |
| `TW_TASKRC` | No | Path to `.taskrc` |
| `TW_TASKDATA` | No | Path to task data directory |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot API token |
| `TELEGRAM_CHAT_ID` | No | Restrict bot to specific chat |
| `TELEGRAM_USER_ID` | No | Restrict bot to specific user |
