const { Telegraf } = require('telegraf');

const { ExecutionError } = require('./taskwarrior.js');

const { version:bot_version } = require('../package.json');

function extract_command_args(cmd, text) {
    if ( !text ) return '';

    const regex = new RegExp(`/${cmd}`, 'g');
    return text.replace(regex, '').trim();
}

class ParserError extends Error {}

function extract_id(text) {
    if ( !text ) throw new ParserError('No id provided');
    const match_id = text.match(/(\d+)/);
    const match_uuid = text.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/)

    if ( !match_id && !match_uuid ) throw new ParserError('No id found in provided text');

    if ( match_uuid ) {
        return [ match_uuid[1], text.replace(match_uuid[0], '').trim() ];
    }

    return [ match_id[1], text.replace(match_id[0], '').trim() ];
}

class Telegram {
    constructor(config, log, taskwarrior) {
        this.config = config;
        this.log = log;
        this.tw = taskwarrior;
        this.bot = new Telegraf(this.config.bot_token);
    }


    stop(sig) {
        this.log.info(`Received ${sig} signal, stopping bot...`);
        this.bot.stop();
    }

    launch() {

        if ( this.config.chat_id ) {
            this.log.info(`Bot is locked to chat ID: ${this.config.chat_id}`);
            this.bot.use(async (ctx, next) => {
                if (ctx.chat && ctx.chat.id.toString() === this.config.chat_id.toString()) {
                    return next();
                } else {
                    this.log.warn(`Unauthorized access attempt from chat ID: ${ctx.chat ? ctx.chat.id : 'unknown'}`);
                    await new Promise(resolve => setTimeout(resolve, 3000)); // Delay response to mitigate brute-force attempts
                    return ctx.reply('Unauthorized');
                }
            });
        } else {
            this.log.warn('No chat_id configured, bot will accept commands from any chat (consider setting TELEGRAM_CHAT_ID to restrict access)');
        }

        if ( this.config.user_id ) {
            this.log.info(`Bot is locked to user ID: ${this.config.user_id}`);
            this.bot.use(async (ctx, next) => {
                if (ctx.from && ctx.from.id.toString() === this.config.user_id.toString()) {
                    return next();
                } else {
                    this.log.warn(`Unauthorized access attempt from user ID: ${ctx.from ? ctx.from.id : 'unknown'}`);
                    await new Promise(resolve => setTimeout(resolve, 3000)); // Delay response to mitigate brute-force attempts
                    return ctx.reply('Unauthorized');
                }
            });
        } else {
            this.log.warn('No user_id configured, bot will accept commands from any user (consider setting TELEGRAM_USER_ID to restrict access)');
        }

        // Logging middleware
        this.bot.use((ctx,next) => {
            // Commands:
            const match = ctx.message && ctx.message.text && ctx.message.text.match(/^(\/\w+)/);
            if (match) {
                const command = match[1];
                this.log.info(`Received command: ${command} from user: ${ctx.from ? ctx.from.username || ctx.from.id : 'unknown'} in chat: ${ctx.chat ? ctx.chat.id : 'unknown'}`);
            } else {
                this.log.info(`Received message from user: ${ctx.from ? ctx.from.username || ctx.from.id : 'unknown'} in chat: ${ctx.chat ? ctx.chat.id : 'unknown'}`);
            }

            this.log.debug(`Message text: '${ctx.message && ctx.message.text ? ctx.message.text : ''}'`);

            next();
        });

        this.bot.start(ctx => this._handle_start(ctx));
        this.bot.help(ctx => this._handle_help(ctx));
        this.bot.command('version', ctx => this._handle_version(ctx));
        this.bot.command('list', ctx => this._handle_list(ctx));
        this.bot.command('info', ctx => this._handle_info(ctx));
        this.bot.command('add', ctx => this._handle_add(ctx));
        this.bot.command('start', ctx => this._handle_start_task(ctx));
        this.bot.command('stop', ctx => this._handle_stop_task(ctx));
        this.bot.command('sync', ctx => this._handle_sync(ctx));
        this.bot.command('undo', ctx => this._handle_undo(ctx));
        this.bot.command('modify', ctx => this._handle_modify(ctx));
        this.bot.command('delete', ctx => this._handle_delete(ctx));
        this.bot.command('done', ctx => this._handle_done(ctx));
        this.bot.command('annotate', ctx => this._handle_annotate(ctx));

        this.bot.launch();
        this.log.info('Telegram bot launched');
    }

    _wrap_reply(ctx, message, args = {}) {
        try {
            ctx.reply(message, args);
        } catch (err) {
            this.log.error('Error sending message: '+err.stack);
        }
    }
    
    _wrap_reply_block(ctx, message) {
        return this._wrap_reply(ctx, "```text\n"+message+"\n```", { parse_mode: 'MarkdownV2' });
    }

    async _wrap_tw_call(promise, ctx) {
        try {
            return await promise;
        } catch (err) {
            this.log.error('Error executing Taskwarrior command: '+err.stack);
            if ( err instanceof ExecutionError ) {
                this._wrap_reply(ctx, err.stdout.trim() || err.stderr.trim() || 'An error occurred while executing the command');
                throw err;
            }
            this._wrap_reply(ctx, 'An error occurred while executing the command');
            throw err;
        }
    }


    _handle_start(ctx) {
        const message = `Hello! I'm a Taskwarrior bot. I can help you manage your tasks using Taskwarrior commands. Type /help to see available commands.`;
        this._wrap_reply(ctx, message);
    }

    _handle_help(ctx) {
        // TODO
        this._wrap_reply(ctx, 'Help is not implemented yet');
    }

    async _handle_version(ctx) {
        let tw_version;
        try {
            tw_version = await this.tw.get_version();
        } catch (err) {
            this.log.error('Error fetching Taskwarrior version '+err.stack);
        }
        if ( tw_version ) {
            this._wrap_reply(ctx, `Bot version: ${bot_version}\nTaskwarrior version: ${tw_version}`);
        } else {
            this._wrap_reply(ctx, `Bot version: ${bot_version}\nFailed to fetch Taskwarrior version`);
        }
    }

    async _handle_list(ctx) {
        const msg = extract_command_args('list', ctx.message?.text);
        let resp;
        try {
            resp = await this._wrap_tw_call(this.tw.list(msg), ctx);
        } catch (err) {
            return; // Error already handled in _wrap_tw_call
        }
        this._wrap_reply_block(ctx, resp);
    }

    async _handle_info(ctx) {
        const msg = extract_command_args('list', ctx.message?.text);
        let id, expr;
        try {
            [ id, expr ] = extract_id(msg);
        } catch (err) {
            if ( err instanceof ParserError ) {
                return this._wrap_reply(ctx, err.message);
            }
            this.log.error('Error parsing ID from message: '+err.stack);
            return this._wrap_reply(ctx, 'An error occurred while parsing the command arguments');
        }

        let resp;
        try {
            resp = await this._wrap_tw_call(this.tw.info(id), ctx);
        } catch (err) {
            return; // Error already handled in _wrap_tw_call
        }
        this._wrap_reply_block(ctx, resp);
    }

    async _handle_add(ctx) {}
    async _handle_start_task(ctx) {}
    async _handle_stop_task(ctx) {}
    async _handle_sync(ctx) {}
    async _handle_undo(ctx) {}
    async _handle_modify(ctx) {}
    async _handle_delete(ctx) {}
    async _handle_done(ctx) {}
    async _handle_annotate(ctx) {}
}


module.exports = {
    Telegram
};
