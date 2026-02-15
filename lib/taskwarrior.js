const { spawn } = require('child_process');
const { existsSync } = require('fs');
const { writeFile, mkdir } = require('fs/promises');

class ExecutionError extends Error {
    constructor(code, stdout, stderr) {
        super(stdout || stderr || `Process exited with code ${code}`);
        this.stdout = stdout;
        this.stderr = stderr;
        this.code = code;
    }
}

function parse_id(id) {
    let _int = parseInt(id);
    if ( !isNaN(_int) && _int > 0 ) {
        return _int.toString();
    } else if (id.match(/^[0-9a-fA-F-]{36}$/)) {
        return id;
    } else {
        throw new Error("Invalid id format");
    }
}

function parse_priority(priority) {
    if (priority === "H") return "high";
    if (priority === "M") return "medium";
    if (priority === "L") return "low";
    return null;
}

function parse_task(task) {
    return {
        // raw: task,
        id: task.id,
        uuid: task.uuid,
        description: task.description || null,
        project: task.project || null,
        priority: parse_priority(task.priority),
        status: task.status,
        tags: task.tags || [],
        urgency: task.urgency,
        annotation: (task.annotation || []).map(a => ({
            entry: parse_date(a.entry),
            description: a.description,
        })),
        dates: {
            entry: parse_date(task.entry),
            start: parse_date(task.start),
            end: parse_date(task.end),
            due: parse_date(task.due),
            scheduled: parse_date(task.scheduled),
            until: parse_date(task.until), // task expires and is deleted
            wait: parse_date(task.wait),   // task is hidden until this date (status waiting)
            modified: parse_date(task.modified),
        },
        recurrence: {
            type: task.rtype || null,
            interval: task.recur || null,
        },
        dependency: task.depends || [], // uuid
        parent: task.parent || null, // uuid
    }
};


/**
 * Convert tw output '20260211T012335Z' to Date object
 * @param {string} dateStr - Date string in Taskwarrior format
 * @returns {Date|null} - Parsed Date object or null if invalid
 */
function parse_date(dateStr) {
    if (!dateStr) return null;
    regex = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;
    const match = dateStr.match(regex);
    if (!match) return null;
    return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`);
}

class Taskwarrior {
    constructor({
        bin = 'task',
        taskrc = null,
        taskdata = null,
    }) {
        this.bin = bin;
        this.taskrc = taskrc;
        this.taskdata = taskdata;
    }

    async init() {

        // If taskrc is provided, check if it exists, if not create an empty file
        if ( this.taskrc ) {
            if ( !existsSync(this.taskrc) ) {
                await mkdir(require('path').dirname(this.taskrc), { recursive: true });
                await writeFile(this.taskrc, '');
            }
        }

        // If taskdata is provided, check if it exists, if not create an empty directory
        if ( this.taskdata ) {
            if ( !existsSync(this.taskdata) ) {
                await mkdir(this.taskdata, { recursive: true });
            }
        }
    }

    async _execute_json(args) {
        return this._execute_raw([
            'rc.verbose=nothing',
            'rc.json.array=on',
            'rc.confirmation=off',
            'rc.json.depends.array=on',
            ...args
        ])
    }

    async _execute(args) {
        return this._execute_raw([
            'rc.color=off',
            'rc._forcecolor=off',
            ...args
        ]);
    }

    async _execute_raw(args) {
        const env = { ...process.env };
        if (this.taskrc) {
            env['TASKRC'] = this.taskrc;
        }
        if (this.taskdata) {
            env['TASKDATA'] = this.taskdata;
        }
        return new Promise((resolve, reject) => {
            const process = spawn(
                this.bin, 
                args,
                { env }
            );
            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on("error",reject);

            process.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new ExecutionError(code, stdout, stderr));
                }
            });

        });
    }

    async config() {
        return this._execute([
            'rc.verbose=0',
            'rc.confirmation=off',
            'show'
        ]).then(stdout => {
            return stdout.trim();
        }).catch(err => {
            if (err instanceof ExecutionError && err.code === 1) {
                return err.stdout.trim() || err.stderr.trim();
            }
            throw err;
        });
    }


    async get_version() {
        return this._execute_raw(['--version']).then(stdout => {
            return stdout.trim();
        });
    }

    async version() {
        return this._execute(['version']).then(stdout => {
            return stdout.trim();
        });
    }

    async sync() {
        return this._execute(['sync']).then(stdout => {
            return stdout.trim();
        });
    }

    async undo() {
        return this._execute([
            'rc.confirmation=off',
            'undo'
        ]).then(stdout => {
            return stdout.trim();
        });
    }

    async export(filter) {
        return this._execute_json([...(filter ? [filter] : []), 'export']).then(stdout => {
            return JSON.parse(stdout).map(task => parse_task(task)).sort((a, b) => b.urgency - a.urgency);
        }).catch(err => {
            if (err instanceof ExecutionError && err.code === 1) {
                return [];
            }
            throw err;
        });
    }

    async list(filter, subcommand) {
        return this._execute([
            'rc.verbose=0',
            ...(filter ? [filter] : []),
            ...(subcommand?[subcommand]:[])
        ]).then(stdout => {
            return stdout.trim();
        }).catch(err => {
            if (err instanceof ExecutionError && err.code === 1) {
                return err.stderr.trim() || err.stdout.trim();
            }
            throw err;
        });
    }

    async info(id) {
        const parsed_id = parse_id(id);

        return this._execute([
            'rc.verbose=0',
            parsed_id,
            'information'
        ]).then(stdout => {
            return stdout.trim();
        }).catch(err => {
            if (err instanceof ExecutionError && err.code === 1) {
                return err.stderr.trim() || err.stdout.trim();
            }
            throw err;
        });
    }

    async start(id) {
        const parsed_id = parse_id(id);
        return this._execute([
            'rc.verbose=affected',
            parsed_id,
            'start'
        ]).then(stdout => {
            return stdout.trim();
        }).catch(err => {
            if (err instanceof ExecutionError && err.code === 1) {
                return err.stdout.trim() || err.stderr.trim();
            }
            throw err;
        });
    }

    async stop(id) {
        const parsed_id = parse_id(id);
        return this._execute([
            'rc.verbose=affected',
            parsed_id,
            'stop'
        ]).then(stdout => {
            return stdout.trim();
        }).catch(err => {
            if (err instanceof ExecutionError && err.code === 1) {
                return err.stdout.trim() || err.stderr.trim();
            }
            throw err;
        });
    }

    async done(id) {
        const parsed_id = parse_id(id);
        return this._execute([
            'rc.verbose=affected',
            parsed_id,
            'done'
        ]).then(stdout => {
            return stdout.trim();
        }).catch(err => {
            if (err instanceof ExecutionError && err.code === 1) {
                return err.stdout.trim() || err.stderr.trim();
            }
            throw err;
        });
    }

    async delete(id) {
        const parsed_id = parse_id(id);
        return this._execute([
            'rc.verbose=affected',
            'rc.confirmation=off',
            parsed_id,
            'delete'
        ]).then(stdout => {
            return stdout.trim();
        }).catch(err => {
            if (err instanceof ExecutionError && err.code === 1) {
                return err.stdout.trim() || err.stderr.trim();
            }
            throw err;
        });
    }

    async annotate(id, str) {
        const parsed_id = parse_id(id);
        return this._execute([
            'rc.verbose=affected',
            parsed_id,
            'annotate',
            str
        ]).then(stdout => {
            return stdout.trim();
        }).catch(err => {
            if (err instanceof ExecutionError && err.code === 1) {
                return err.stdout.trim() || err.stderr.trim();
            }
            throw err;
        });
    }

    async calc(expr) {
        return this._execute([
            'rc.verbose=0',
            'calc',
            expr
        ]).then(stdout => {
            return stdout.trim();
        });
    }

    parse_mods(str) {
        let _str = str;
        const mods = [];

        // project:<NAME>
        _str = _str.replace(/(\s?)project:([^\s]+)(\s?)/g, (match, s1, p, s2) => {
            mods.push(`project:${p}`);
            return s1||s2 ? ' ' : '';
        });

        // status:pending|deleted|completed|waiting|recurring
        _str = _str.replace(/(\s?)status:(pending|deleted|completed|waiting|recurring)(\s?)/g, (match, s1, p, s2) => {
            mods.push(`status:${p}`);
            return s1||s2 ? ' ' : '';
        });

        // priority:H|M|L|<nothing>
        _str = _str.replace(/(\s?)priority:([HML]?)(\s?)/g, (match, s1, p, s2) => {
            mods.push(`priority:${p}`);
            return s1||s2 ? ' ' : '';
        });

        // due:<DATE>
        _str = _str.replace(/(\s?)due:([^\s]*)(\s?)/g, (match, s1, p, s2) => {
            mods.push(`due:${p}`);
            return s1||s2 ? ' ' : '';
        });

        // scheduled:<DATE>
        _str = _str.replace(/(\s?)scheduled:([^\s]*)(\s?)/g, (match, s1, p, s2) => {
            mods.push(`scheduled:${p}`);
            return s1||s2 ? ' ' : '';
        });

        // until:<DATE>
        _str = _str.replace(/(\s?)until:([^\s]*)(\s?)/g, (match, s1, p, s2) => {
            mods.push(`until:${p}`);
            return s1||s2 ? ' ' : '';
        });

        // wait:<DATE>
        _str = _str.replace(/(\s?)wait:([^\s]*)(\s?)/g, (match, s1, p, s2) => {
            mods.push(`wait:${p}`);
            return s1||s2 ? ' ' : '';
        });

        // depends:<id array>
        _str = _str.replace(/(\s?)depends:([^\s]*)(\s?)/g, (match, s1, p, s2) => {
            mods.push(`depends:${p}`);
            return s1||s2 ? ' ' : '';
        });

        // tags:<tags>
        _str = _str.replace(/(\s?)tags:([^\s]*)(\s?)/g, (match, s1, p, s2) => {
            mods.push(`tags:${p}`);
            return s1||s2 ? ' ' : '';
        });

        // +tag
        _str = _str.replace(/(\s?)\+([^\s]+)(\s?)/g, (match, s1, p, s2) => {
            mods.push(`+${p}`);
            return s1||s2 ? ' ' : '';
        });

        // -tag
        _str = _str.replace(/(\s?)-([^\s]+)(\s?)/g, (match, s1, p, s2) => {
            mods.push(`-${p}`);
            return s1||s2 ? ' ' : '';
        });

        return [_str, mods];
    }

    async add(str, mods=[]) {
        const _mods = [...mods];
        const [ description, parsed_mods ] = this.parse_mods(str);
        _mods.push(...parsed_mods);
        return this._execute([
            'rc.verbose=0',
            'add',
            description,
            ..._mods
        ]).then(stdout => {
            return stdout.trim();
        });
    }

    async modify(id, str, mods=[]) {
        const _mods = [...mods];
        const [ description, parsed_mods ] = this.parse_mods(str);
        _mods.push(...parsed_mods);
        const parsed_id = parse_id(id);
        return this._execute([
            'rc.verbose=affected',
            parsed_id,
            'modify',
            ...(description.trim() ? [description] : []),
            ..._mods
        ]).then(stdout => {
            return stdout.trim();
        }).catch(err => {
            if (err instanceof ExecutionError && err.code === 1) {
                return err.stdout.trim() || err.stderr.trim();
            }
            throw err;
        });
    }
}

module.exports = {
    ExecutionError,
    Taskwarrior,
};
