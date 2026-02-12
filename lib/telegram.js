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

        this.commands = [];
    }

    set_command(cmd, doc, handler) {
        if ( doc ) this.commands.push({
            command:cmd,
            description: doc
        });

        switch (cmd) {
            case 'start':
                this.bot.start(this._wrap_handler(cmd, handler));
                break;
            case 'help':
                this.bot.help(this._wrap_handler(cmd, handler));
                break;
            default:
                this.bot.command(cmd, this._wrap_handler(cmd, handler));
                break;
        }
    }


    stop(sig) {
        this.log.info(`Received ${sig} signal, stopping bot...`);
        this.bot.stop();
    }

    async launch() {

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
        this.bot.use(async (ctx,next) => {
            // Commands:
            const match = ctx.message && ctx.message.text && ctx.message.text.match(/^(\/\w+)/);
            if (match) {
                const command = match[1];
                this.log.info(`Received command: ${command} from user: ${ctx.from ? ctx.from.username || ctx.from.id : 'unknown'} in chat: ${ctx.chat ? ctx.chat.id : 'unknown'}`);
            } else {
                this.log.info(`Received message from user: ${ctx.from ? ctx.from.username || ctx.from.id : 'unknown'} in chat: ${ctx.chat ? ctx.chat.id : 'unknown'}`);
            }

            this.log.debug(`Message text: '${ctx.message && ctx.message.text ? ctx.message.text : ''}'`);

            return await next();
        });

        this.set_command('start', undefined, this._handle_start);
        this.set_command('help', '/help - show this menu', this._handle_help);
        this.set_command('version', '/version - get the version', this._handle_version);
        this.set_command('list', '/list [filter] - list tasks matching a filter', this._handle_list);
        this.set_command('info', '/info <id|uuid> - show info on a task', this._handle_info);
        this.set_command('add', '/add <description> [mods] - add a new task', this._handle_add);
        this.set_command('begin', '/begin <id|uuid> - start a task', this._handle_start_task);
        this.set_command('stop', '/stop <id|uuid> - stop a task', this._handle_stop_task);
        this.set_command('sync', '/sync - run synchronization with the server', this._handle_sync);
        this.set_command('undo', '/undo - undo the last operation', this._handle_undo);
        this.set_command('modify', '/modify <id|uuid> <mods> - modify a task', this._handle_modify);
        this.set_command('delete', '/delete <id|uuid> - delete a task', this._handle_delete);
        this.set_command('done', '/done <id|uuid> - mark a task complete', this._handle_done);
        this.set_command('annotate', '/annotate <id|uuid> <annotation - add an annotation to a task', this._handle_annotate);

        await this.bot.telegram.setMyCommands(this.commands);

        this.bot.launch();
        this.log.info('Telegram bot launched');
    }

    async _wrap_reply(ctx, message, args = {}) {
        try {
            await ctx.reply(message, args);
        } catch (err) {
            this.log.error('Error sending message: '+err.stack);
        }
    }
    
    _wrap_reply_block(ctx, message) {
        return this._wrap_reply(ctx, "```text\n"+message+"\n```", { parse_mode: 'MarkdownV2' });
    }

    _wrap_handler(cmd, fn) {
        return async (ctx) => {
            try {
                ctx.arg_string = extract_command_args(cmd, ctx?.message?.text)
                await fn.call(this, ctx);
            } catch (err) {
                if (err instanceof ParserError) {
                    return this._wrap_reply(ctx, err.message);
                }
                if (err instanceof ExecutionError) {
                    this.log.error('Taskwarrior error: ' + err.stack);
                    return this._wrap_reply(ctx, err.stdout.trim() || err.stderr.trim() || 'An error occurred');
                }
                this.log.error('Unexpected error: ' + err.stack);
                return this._wrap_reply(ctx, 'An error occurred while executing the command');
            }
        };
    }


    _handle_start(ctx) {
        const message = `Hello! I'm a Taskwarrior bot. I can help you manage your tasks using Taskwarrior commands. Type /help to see available commands.`;
        this._wrap_reply(ctx, message);
    }

    _handle_help(ctx) {
        const message = this.commands.length > 0 ?
            'Available commands:\n' + this.commands.map(c => `${c.description}`).join('\n') :
            'No commands available.';
        this._wrap_reply(ctx, message);
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

    async _handle_sync(ctx) {}
    async _handle_undo(ctx) {}

    async _handle_list(ctx) {
        const msg = ctx.arg_string;
        const resp = await this.tw.list(msg);
        if (!resp || resp.includes('No matches.')) {
            return this._wrap_reply(ctx, 'No matches.');
        }
        this._wrap_reply_block(ctx, resp);
    }

    async _handle_info(ctx) {
        const msg = ctx.arg_string;
        const [id] = extract_id(msg);
        const resp = await this.tw.info(id);
        if (!resp || resp.includes('No matches.')) {
            return this._wrap_reply(ctx, 'No matches.');
        }
        this._wrap_reply_block(ctx, resp);
    }

    async _handle_add(ctx) {
        const msg = ctx.arg_string;
        if (!msg) throw new ParserError('No task description provided');
        const resp = await this.tw.add(msg);
        this._wrap_reply(ctx, resp);
    }
    async _handle_start_task(ctx) {
        const msg = ctx.arg_string;
        const [id] = extract_id(msg);
        const resp = await this.tw.start(id);
        this._wrap_reply(ctx, resp);
    }
    async _handle_stop_task(ctx) {
        const msg = ctx.arg_string;
        const [id] = extract_id(msg);
        const resp = await this.tw.stop(id);
        this._wrap_reply(ctx, resp);
    }
    async _handle_modify(ctx) {
        const msg = ctx.arg_string;
        const [id, rest] = extract_id(msg);
        if (!rest) throw new ParserError('No modifications provided');
        const resp = await this.tw.modify(id, rest);
        this._wrap_reply(ctx, resp);
    }
    async _handle_delete(ctx) {
        const msg = ctx.arg_string;
        const [id] = extract_id(msg);
        const resp = await this.tw.delete(id);
        this._wrap_reply(ctx, resp);
    }
    async _handle_done(ctx) {
        const msg = ctx.arg_string;
        const [id] = extract_id(msg);
        const resp = await this.tw.done(id);
        this._wrap_reply(ctx, resp);
    }
    async _handle_annotate(ctx) {
        const msg = ctx.arg_string;
        const [id, rest] = extract_id(msg);
        if (!rest) throw new ParserError('No annotation provided');
        const resp = await this.tw.annotate(id, rest);
        this._wrap_reply(ctx, resp);
    }
}


module.exports = {
    Telegram
};
