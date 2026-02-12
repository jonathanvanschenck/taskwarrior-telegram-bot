
const { homedir } = require('os');
const { join } = require('path');
require('dotenv').config({ quiet: true });

const home = homedir();
const default_config_dir = join(home, '.ttb');

module.exports = {
    db: {
        data: process.env.DB_DATA == ":memory:"
                ? ":memory:"
                : process.env.DB_DATA == ""
                    ? null
                    : join(process.env.DB_DATA ?? default_config_dir, 'db.sqlite'),
    },
    cron: {
        data_dir: process.env.CRON_DATA ?? default_config_dir,
        timezone: process.env.CRON_TIMEZONE ?? undefined,
    },
    taskwarrior: {
        bin: process.env.TW_BIN ?? 'task',
        taskrc: process.env.TW_TASKRC ?? join(home, '.taskrc'),
        taskdata: process.env.TW_TASKDATA ?? join(home, '.task'),
    },
    telegram: {
        bot_token: process.env.TELEGRAM_BOT_TOKEN,
        chat_id: process.env.TELEGRAM_CHAT_ID,
        user_id: process.env.TELEGRAM_USER_ID,
    }
};
