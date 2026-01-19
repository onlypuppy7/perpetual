import path from 'node:path';
import { ConfigManager } from './ConfigManager.js';
import { Logger } from './Logger.js';
import { ProcessManager } from './ProcessManager.js';
import readline from 'node:readline';

export class Perpetual {
    constructor(serverName, options = {}) {
        this.rootDir = options.rootDir || path.resolve('./');
        this.configManager = new ConfigManager(this.rootDir, options.perpConfigLocation, serverName, options.noYAML);
        this.options = this.configManager.getServerOptions(options);
        this.logger = new Logger(this.options);
        this.processManager = new ProcessManager(this.options, this.logger, this.rootDir);
    }

    async run() {
        await this.processManager.startProcess();

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: '> '
        });

        rl.prompt();
        rl.on('line', async (line) => {
            let cmd = line.trim();
            if (cmd === "r" || cmd === "restart") {
                await this.processManager.startProcess(true);
            } else if (cmd === "p" || cmd === "pull") {
                this.processManager.executeCommand('git', ['pull']);
            } else if (cmd === "pr") { // pull and restart
                this.processManager.executeCommand('git', ['pull']);
                setTimeout(() => {
                    this.processManager.startProcess(true);
                }, 5e3);
            };
            rl.prompt();
        }).on('close', () => {
            console.log('Exiting interactive mode!');
            process.exit(0);
        });
    }
}

export default Perpetual;