# Taskwarrior Telegram Bot

A Telegram bot that provides a chat interface to [Taskwarrior](https://taskwarrior.org/), the command-line task management tool.

[![GitHub Release](https://img.shields.io/github/v/release/jonathanvanschenck/taskwarrior-telegram-bot)](https://github.com/jonathanvanschenck/taskwarrior-telegram-bot/releases)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

## Features

| Command | Description |
|---|---|
| `/start` | Register with the bot and receive a welcome message |
| `/stop` | Unregister from the bot and stop receiving messages |
| `/help` | Show available commands |
| `/version` | Show bot and Taskwarrior versions |
| `/list [filter]` | List tasks (with optional filter) |
| `/info <id>` | Show detailed task info |
| `/add <description>` | Add a new task |
| `/modify <id> <mods>` | Modify an existing task |
| `/annotate <id> <text>` | Add an annotation to a task |
| `/begin <id>` | Start a task |
| `/end <id>` | Stop a task |
| `/done <id>` | Mark a task as done |
| `/delete <id>` | Delete a task |

## Setup

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot API token |
| `TELEGRAM_CHAT_ID` | No | Restrict bot to a specific chat |
| `TELEGRAM_USER_ID` | No | Restrict bot to a specific user |
| `DB_DATA` | No | Path to directory for sqlite database (if not set, database will be created in memory) |
| `TW_BIN` | No | Path to `task` binary (default: `task`) |
| `TW_TASKRC` | No | Path to `.taskrc` |
| `TW_TASKDATA` | No | Path to task data directory |

### Docker

Pre-built images are available on GHCR for both Taskwarrior 2 and 3, on `amd64` and `arm64`:

```bash
# Taskwarrior 2
docker run -d \
  -e TELEGRAM_BOT_TOKEN=your-token \
  -e DB_DATA=/data/botdb \
  -e TW_TASKRC=/data/taskrc \
  -e TW_TASKDATA=/data/taskdata \
  -v /path/to/taskdata:/data \
  ghcr.io/jonathanvanschenck/taskwarrior-telegram-bot:tw2-latest

# Taskwarrior 3
docker run -d \
  -e TELEGRAM_BOT_TOKEN=your-token \
  -e DB_DATA=/data/botdb \
  -e TW_TASKRC=/data/taskrc \
  -e TW_TASKDATA=/data/taskdata \
  -v /path/to/taskdata:/data \
  ghcr.io/jonathanvanschenck/taskwarrior-telegram-bot:tw3-latest
```

### Docker Compose

```yaml
services:
  bot:
    image: ghcr.io/jonathanvanschenck/taskwarrior-telegram-bot:tw2-latest
    volumes:
      - ./taskdata:/data
    environment:
      - DB_DATA=/data/botdb
      - TW_TASKDATA=/data/taskdata
      - TW_TASKRC=/data/taskrc
      - TELEGRAM_BOT_TOKEN=your-token
```

## Development

### Local Run

```bash
cp example.env .env  # then fill in your bot token
npm install
node index.js
```

### Dev Compose

```bash
# Taskwarrior 2
npm run build:dev:tw2
npm run start:dev:tw2

# Taskwarrior 3
npm run build:dev:tw3
npm run start:dev:tw3
```

## License

[ISC](LICENSE)
