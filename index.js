const { Logger } = require("yalls");

const { version } = require('./package.json');

const { Taskwarrior, ExecutionError } = require('./lib/taskwarrior.js'); 
const { Telegram } = require('./lib/telegram.js');
const { DB } = require('./lib/database.js');

const env = require('./env.js');

const log = Logger.console();

const tw = new Taskwarrior(env.taskwarrior);
const db = new DB(env.db, log.create_child("DB"));
const bot = new Telegram(env.telegram, log.create_child("Bot"), tw, db);

!async function main() {
    await tw.init();
    await db.init();
    await bot.launch();
    for ( const sig of ['SIGINT', 'SIGTERM'] ) {
        process.once(sig, () => {
            log.info(`Received ${sig}, stopping bot...`);
            bot.stop(sig);
        });
    }
}();

