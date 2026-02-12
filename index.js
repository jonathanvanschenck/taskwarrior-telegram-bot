const { Logger } = require("yalls");

const { version } = require('./package.json');

const { Taskwarrior, ExecutionError } = require('./lib/taskwarrior.js'); 
const { Telegram } = require('./lib/telegram.js');
const { DB } = require('./lib/database.js');
const { CronManager } = require('./lib/cron.js');

const env = require('./env.js');

const log = Logger.console();

const tw = new Taskwarrior(env.taskwarrior);
const db = new DB(env.db, log.create_child("DB"));
const bot = new Telegram(env.telegram, log.create_child("Bot"), tw, db);
const cron = new CronManager(env.cron, log.create_child("Cron"), tw, bot);

!async function main() {
    await tw.init();
    await db.init();
    await bot.launch();
    await cron.start();

    for ( const sig of ['SIGINT', 'SIGTERM'] ) {
        process.once(sig, () => {
            log.info(`Received ${sig}, stopping bot...`);
            cron.stop();
            bot.stop(sig);
        });
    }
}();

