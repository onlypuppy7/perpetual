import fs from 'node:fs';
import fetch from 'node-fetch';
import { getTimestamp, stripAnsi, divideString, ensureDirExists } from 'puppymisc';
import log from 'puppylog';

export class Logger {
    constructor(options) {
        this.options = options;
        this.logQueue = [];
        this.queuedChunks = [];
        this.maxMessageLength = 1900;
        this.messagesSent = 0;

        ensureDirExists(options.logfile_location);
        this.logFilePath = `${options.logfile_location}/${getTimestamp(true)}.log`;
        ensureDirExists(this.logFilePath);
    }

    appendLog(msg, noSend = false) {
        msg = stripAnsi(msg);
        if (!noSend) this.logQueue.push(msg);
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

    async sendToWebhook() {
        while (this.logQueue.length) {
            let msg = this.logQueue.shift();
            if (msg.length > this.maxMessageLength) {
                this.logQueue.unshift(...divideString(msg, this.maxMessageLength));
            } else {
                const lastChunk = this.queuedChunks[0] || "";
                const newChunk = lastChunk + `\n${msg}`;
                if (newChunk.length > this.maxMessageLength) {
                    this.queuedChunks.unshift(`\n${msg}`);
                } else {
                    this.queuedChunks[0] = newChunk;
                }
            }
        }

        if (this.queuedChunks.length && this.options.webhook_url) {
            try {
                const response = await fetch(this.options.webhook_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: this.options.webhook_username,
                        avatar_url: this.options.webhook_avatar,
                        content: this.queuedChunks[this.queuedChunks.length - 1].slice(0, 2000),
                    })
                });
                if (!response.ok) throw new Error(response.statusText);
                this.logNoSend(`Logs sent to webhook (${this.messagesSent})`);
                this.queuedChunks.pop();
                this.messagesSent++;
            } catch (err) {
                this.logNoSend(`Error sending webhook: ${err.message}`);
            }
        }
    }

    startWebhookInterval(interval = 15000) {
        this.webhookInterval = setInterval(() => this.sendToWebhook(), interval);
    }
}
