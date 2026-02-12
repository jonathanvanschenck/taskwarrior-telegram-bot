
require('dotenv').config({ quiet: true });

module.exports = {
    db: {
        data: process.env.DB_DATA ?? undefined,
    },
    cron: {
        data: process.env.CRON_DATA ?? undefined,
        timezone: process.env.CRON_TIMEZONE ?? undefined,
    },
    taskwarrior: {
        bin: process.env.TW_BIN ?? undefined,
        taskrc: process.env.TW_TASKRC ?? undefined,
        taskdata: process.env.TW_TASKDATA ?? undefined,
    },
    telegram: {
        bot_token: process.env.TELEGRAM_BOT_TOKEN,
        chat_id: process.env.TELEGRAM_CHAT_ID,
        user_id: process.env.TELEGRAM_USER_ID,
    }
};
