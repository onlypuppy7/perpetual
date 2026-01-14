import fs from 'node:fs';
import fetch from 'node-fetch';
import { getTimestamp, stripAnsi, divideString, ensureDirExists } from 'puppymisc';
import log from 'puppylog';
import PuppyWebhook from 'puppywebhook';

export class Logger {
    constructor(options) {
        this.options = options;
        this.logQueue = [];
        this.queuedChunks = [];
        this.maxMessageLength = 1900;
        this.messagesSent = 0;

        if (options.webhook_url) this.webhook = new PuppyWebhook({
            webhookUrl: options.webhook_url,
            username: options.webhook_username,
            avatar_url: options.webhook_avatar,
        });

        ensureDirExists(options.logfile_location);
        this.logFilePath = `${options.logfile_location}/${getTimestamp(true)}.log`;
        ensureDirExists(this.logFilePath);
    }

    appendLog(msg, noSend = false) {
        msg = stripAnsi(msg);
        if (this.webhook && !noSend) this.webhook.send(msg)
        fs.appendFile(this.logFilePath, `${msg}\n`, () => {});
    }

    logSend(msg) {
        const line = `#${getTimestamp()} ${msg}`;
        log.muted(line);
        this.appendLog(line);
    }

    logNoSend(msg) {
        const line = `#${getTimestamp()} ${msg}`;
        log.muted(line);
        this.appendLog(line, true);
    }
}
