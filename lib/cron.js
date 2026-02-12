const { Cron } = require('croner');

const { join } = require('path');
const { existsSync } = require('fs');
const { readFile } = require('fs/promises');

class CronManager {
    constructor(config, log, taskwarrior, bot) {
        this.config = config;
        this.log = log;
        this.tw = taskwarrior;
        this.bot = bot;
    }

    async start() {
        this.jobs = [];

        if ( !this.config.data ) {
            this.log.warn("No cron data file specified, skipping cron jobs");
            return;
        }

        const file = join(this.config.data, 'cron.json');
        if ( !existsSync(file) ) {
            this.log.warn(`Cron data file ${file} not found, skipping cron jobs`);
            return;
        }

        this.log.info(`Loading cron jobs from ${file}`);
        const data = JSON.parse(await readFile(file, 'utf-8'));
        this.log.info(`Loaded ${data.length} cron jobs`);
        for ( const d of data ) {
            this.log.debug(`Scheduling cron job with schedule '${d.schedule}' and command '${JSON.stringify(d.command)}'`);
            const job = new Cron(
                d.schedule,
                {
                    timezone: d.timezone ?? this.config.timezone ?? undefined,
                    catch: (e) => this.log.error(`Error in cron job with schedule ${d.schedule}: ${e.message}`)
                },
                this._parse_command(d.command).bind(this)
            )
            this.jobs.push(job);
        }
    }

    _parse_command(command) {
        const type = command.type;
        const args = command.args || [];

        if ( !this.tw[ type ] ) {
            this.log.error(`Unknown cron command type: ${type}`);
            return async () => {};
        }

        return async () => {
            let resp;
            try {
                resp = await this.tw[ type ](...args);
            } catch ( e ) {
                this.log.error(`Error executing cron command ${type}: ${e.message}`);
            }

            let msg;
            let opts = {}
            if ( type == 'list' || type == 'info' ) {
                msg = `Cron job executed: ${type} \`${JSON.stringify(args)}\`\n`;
                msg = msg + '```text\n'+resp+'\n```';
                opts.parse_mode = 'MarkdownV2';
            } else {
                msg = `Cron job executed: ${type} '${JSON.stringify(args)}'\n`;
                msg = msg + resp;
            }

            try {
                await this.bot.push_notification(msg, opts);
            } catch ( e ) {
                this.log.error(`Error sending cron notification: ${e.message}`);
            }
        };
    }

    async stop() {
        for ( const job of this.jobs ) job.stop();
    }
}

module.exports = { CronManager };
