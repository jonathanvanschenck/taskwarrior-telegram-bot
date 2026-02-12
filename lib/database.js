const { join, dirname } = require('path');
const { existsSync, mkdirSync } = require('fs');
const sqlite = require('better-sqlite3');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS version (
    version INT UNIQUE NOT NULL
);
INSERT INTO version (version) VALUES ('1') ON CONFLICT(version) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_chats (
    user_id INT NOT NULL,
    chat_id INT NOT NULL,
    PRIMARY KEY (user_id, chat_id)
);
CREATE INDEX IF NOT EXISTS idx_user_chats_user_id ON user_chats (user_id);
CREATE INDEX IF NOT EXISTS idx_user_chats_chat_id ON user_chats (chat_id);
`;

const version = 1;

class DB {
    constructor(config, log) {
        this.config = config;
        this.log = log;

        if ( this.config.data == null ) {
            this.log.info(`Data directory was disabled, disabling database`);
            this.db = null;
            return;
        }

        if ( this.config.data === ':memory:' ) {
            this.log.info(`Using in-memory database (data will not persist across restarts)`);
        } else {
            const dir = dirname(this.config.data);
            this.log.info(`Using data directory: ${dir}`);
            if ( !existsSync(dir) ) {
                this.log.info(`Data directory ${dir} does not exist, creating it`);
                mkdirSync(dir, { recursive: true });
            }
        }
        this.db = new sqlite(
            this.config.data,
            { fileMustExist: false }
        );
    }

    async init() {
        if ( !this.db ) return;

        this.db.pragma('journal_mode = WAL');


        // Set up the database schema
        this.db.exec(SCHEMA);

        // Get the current version from the database
        const row = this.db.prepare('SELECT version FROM version ORDER BY version DESC LIMIT 1').get();

        if (!row) {
            throw new Error('Failed to retrieve database version');
        }
        const currentVersion = row.version;

        // TODO : Handle database migrations here if needed in the future
        if (currentVersion !== version) {
            throw new Error(`Database version mismatch: expected ${version}, got ${currentVersion}`);
        }

        this.log.info('Database initialized successfully (version ' + currentVersion + ')');
    }


    add_chat(user_id, chat_id) {
        if ( !this.db ) return;

        const stmt = this.db.prepare('INSERT OR IGNORE INTO user_chats (user_id, chat_id) VALUES (?, ?)');
        stmt.run(user_id, chat_id);
    }

    remove_chat(user_id, chat_id) {
        if ( !this.db ) return;

        const stmt = this.db.prepare('DELETE FROM user_chats WHERE user_id = ? AND chat_id = ?');
        stmt.run(user_id, chat_id);
    }

    get_chats() {
        if ( !this.db ) return [];

        const stmt = this.db.prepare('SELECT user_id, chat_id FROM user_chats');
        return stmt.all();
    }

    get_chats_for_user(user_id) {
        if ( !this.db ) return [];

        const stmt = this.db.prepare('SELECT user_id, chat_id FROM user_chats WHERE user_id = ?');
        return stmt.all(user_id);
    }
}

module.exports = { DB }
