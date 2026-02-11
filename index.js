/**
 *
 * TODO : try-catch all the replies, etc...
 *
 */
const { Logger } = require("yalls");

const { version } = require('./package.json');

const { Taskwarrior, ExecutionError } = require('./lib/taskwarrior.js'); 
const { Telegram } = require('./lib/telegram.js');

const env = require('./env.js');

const tw = new Taskwarrior(env.taskwarrior);
const log = Logger.console();
const bot = new Telegram(env.telegram, log.create_child("Bot"), tw);

bot.launch();

for ( const sig of ['SIGINT', 'SIGTERM'] ) {
    process.once(sig, () => {
        log.info(`Received ${sig}, stopping bot...`);
        bot.stop(sig);
    });
}

