const { Cron } = require('croner');

const { join } = require('path');
const { existsSync, mkdirSync } = require('fs');
const { readFile, readdir } = require('fs/promises');

class CronManager {
    constructor(config, log, taskwarrior, bot) {
        this.config = config;
        this.log = log;
        this.tw = taskwarrior;
        this.bot = bot;
    }

    async start() {
        this.jobs = [];

        if ( !this.config.data_dir ) {
            this.log.warn("No cron data file specified, skipping cron jobs");
            return;
        }

        this.log.info(`Using cron data directory: ${this.config.data_dir}`);
        if ( !existsSync(this.config.data_dir) ) {
            this.log.info(`Data directory ${this.config.data_dir} does not exist, creating it`);
            mkdirSync(this.config.data_dir, { recursive: true });
        }

        const files = (await readdir(this.config.data_dir)).filter(f => f.endsWith('.json')).map(f => join(this.config.data_dir, f));
        if ( !files.length ) {
            this.log.warn(`No cron data files found in ${this.config.data_dir}, skipping cron jobs`);
            return;
        }

        this.log.info(`Found ${files.length} cron data files in ${this.config.data_dir}`);
        for ( const file of files ) {
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
