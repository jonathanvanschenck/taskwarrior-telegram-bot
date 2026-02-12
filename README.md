# Taskwarrior Telegram Bot

A Telegram bot that provides a chat interface to [Taskwarrior](https://taskwarrior.org/), the command-line task management tool.


[![GitHub Release](https://img.shields.io/github/v/release/jonathanvanschenck/taskwarrior-telegram-bot)](https://github.com/jonathanvanschenck/taskwarrior-telegram-bot/releases)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

## Note from the author
I really just made this for myself, to get push notifications and easy task creation on mobile, but hopefully you will find it useful too!

This bot is still in early development and may have bugs or incomplete features. Use at your own risk, and feel free to contribute or report issues! Additionally, many features are still being worked on, so breaking changes may occur in the future.

Additionally, I primarily use Taskwarrior 3, but I hope to maintain some compatibility with Taskwarrior 2 as well. If you encounter any issues specific to one version, please let me know.

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
| `TELEGRAM_CHAT_ID` | No | Restrict bot to a specific chat. This is *highly* suggested, otherwise anyone can edit your tasks |
| `TELEGRAM_USER_ID` | No | Restrict bot to a specific user |
| `DB_DATA` | No | Path to directory for sqlite database, default is `$HOME/.ttb` (you can use ':memory:' to run in RAM, or set to empty string to turn the db off completely) |
| `TW_BIN` | No | Path to `task` binary, default is `task` |
| `TW_TASKRC` | No | Path to `.taskrc`, default is `$HOME/.task` |
| `TW_TASKDATA` | No | Path to task data directory, default is `$HOME/.taskrc` |
| `CRON_DATA` | No | Path to the diretory for the cron files (`*.json`) defualt is `$HOME/.ttb` |

### Cron
The bot can run scheduled commands using (Vixie) cron scheduling. To enable this feature, put a `cron.json` (well, any json file, actually) in the `CRON_DATA` directory with the following format:
```js
[
    {
        "schedule": "*/5 * * * * *", // <- Vixie cron format with seconds field
        "command": {
            "type": "list",  // <- any method of the Taskwarrior class can be used here
            "args": ["project:Work +mytag"] // <- array of arguments to pass to the method
        }
    }
]
```

### Docker

Pre-built images are available on GHCR for both Taskwarrior 2 and 3, on `amd64` and `arm64`:

```bash
# Taskwarrior 2
docker run -d \
  -e TELEGRAM_BOT_TOKEN=your-token \
  -e TELEGRAM_CHAT_ID=your-chat-id \
  -e DB_DATA=/data/ttb \
  -e CRON_DATA=/data/ttb \
  -e TW_TASKRC=/data/taskrc \
  -e TW_TASKDATA=/data/taskdata \
  -v /path/to/taskdata:/data/taskdata \
  -v /path/to/taskrc:/data/taskrc \
  -v /path/to/backup:/data/ttb \
  ghcr.io/jonathanvanschenck/taskwarrior-telegram-bot:tw2-latest

# Taskwarrior 3
docker run -d \
  -e TELEGRAM_BOT_TOKEN=your-token \
  -e TELEGRAM_CHAT_ID=your-chat-id \
  -e DB_DATA=/data/ttb \
  -e CRON_DATA=/data/ttb \
  -e TW_TASKRC=/data/taskrc \
  -e TW_TASKDATA=/data/taskdata \
  -v /path/to/taskdata:/data/taskdata \
  -v /path/to/taskrc:/data/taskrc \
  -v /path/to/backup:/data/ttb \
  ghcr.io/jonathanvanschenck/taskwarrior-telegram-bot:tw3-latest
```

### Docker Compose

```yaml
services:
  bot:
    image: ghcr.io/jonathanvanschenck/taskwarrior-telegram-bot:tw2-latest
    volumes:
      - /path/to/taskdata:/data/taskdata
      - /path/to/taskrc:/data/taskrc
      - ./cron:/data/ttb # <- put your cron json files in this directory
      - ./backup:/data/db # <- this is where the sqlite db will be stored, if you choose to use it
    environment:
      - CRON_DATA=/data/ttb
      - DB_DATA=/data/db
      - TW_TASKDATA=/data/taskdata
      - TW_TASKRC=/data/taskrc
      - TELEGRAM_BOT_TOKEN=your-token
      - TELEGRAM_CHAT_ID=your-chat-id
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
