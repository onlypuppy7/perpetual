import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { getTimestamp } from 'puppymisc';

export class ProcessManager {
    constructor(options, logger, rootDir) {
        this.options = options;
        this.logger = logger;
        this.rootDir = rootDir;

        this.runningProcess = null;
        this.restartScheduled = false;
        this.autoRestart();
    }

    async startProcess(purposefulStop = false) {
        if (this.runningProcess) {
            this.logger.logSend(`Stopping previous process...`);
            this.runningProcess.purposefulStop = purposefulStop;

            if (this.runningProcess instanceof Worker) {
                try {
                    await this.runningProcess.terminate();
                } catch (err) {
                    this.logger.logSend(`Failed to stop previous process via .terminate: ${err.message} ${this.runningProcess}`);
                }
            } else {
                try {
                    this.runningProcess.kill('SIGINT');
                    this.logger.logSend(`Stopped previous process via .kill: ${this.runningProcess.pid}`);
                } catch (err) {
                    this.logger.logSend(`Failed to stop previous process via .kill: ${err.message} ${this.runningProcess}`);
                }

                try {
                    process.kill(-this.runningProcess.pid, 'SIGINT');
                    this.logger.logSend(`Stopped previous process via process.kill: ${this.runningProcess.pid}`);
                } catch (err) {
                    this.logger.logSend(`Failed to stop previous process via process.kill: ${err.message} ${this.runningProcess}`);
                }
            }
        } else {
            this.logger.logSend(`Starting process: ${this.options.process_cmd}`);

            const useWorkerThreads = true;
            const isNodeScript = this.options.process_cmd.startsWith('node ');
            let scriptPath = this.options.process_cmd;

            if (isNodeScript && useWorkerThreads) {
                // Use Worker Threads for Node.js scripts
                scriptPath = scriptPath.slice(5).trim();
                scriptPath = path.isAbsolute(scriptPath) ? scriptPath : path.join(this.rootDir, scriptPath);

                if (!fs.existsSync(scriptPath)) {
                    this.logger.logSend(`Script file does not exist: ${scriptPath}`);
                    return;
                }

                this.logger.logSend(`Using Worker Threads for script: ${scriptPath}`);
                this.runningProcess = new Worker(scriptPath, { workerData: {}, stdout: true, stderr: true });

                this.runningProcess.stdout.on('data', (data) => {
                    const lines = data.toString().split('\n').filter(Boolean);
                    lines.forEach(line => {
                        const logLine = `${getTimestamp()} ${line}`;
                        process.stdout.write(`${logLine}\n`);
                        this.logger.appendLog(logLine);
                    });
                });

                this.runningProcess.stderr.on('data', (data) => {
                    const lines = data.toString().split('\n').filter(Boolean);
                    lines.forEach(line => {
                        const logLine = `${getTimestamp()} ERROR: ${line}`;
                        process.stderr.write(`${logLine}\n`);
                        this.logger.appendLog(logLine);
                    });
                });

                this.runningProcess.on('error', (err) => {
                    const logLine = `${getTimestamp()} ERROR: ${err.message}`;
                    process.stderr.write(`${logLine}\n`);
                    this.logger.appendLog(logLine);
                });

                this.runningProcess.on('exit', (code, signal) => {
                    code = code === 57 ? 1337 : code;
                    if (signal === 'SIGINT') {
                        this.logger.logSend(`Process terminated manually.`);
                        return;
                    }

                    const pingUser = this.options.webhook_ping_user ? ` <@${this.options.webhook_ping_user}>` : "";
                    const pingRole = this.options.webhook_ping_role ? ` <@&${this.options.webhook_ping_role}>` : "";

                    this.logger.logSend(`Process exited with code ${code}, signal ${signal}. ${(code === 1337 || this.runningProcess.purposefulStop) ? "No ping, intended restart" : `Restarting...${pingUser}${pingRole}`}`);

                    setTimeout(() => {
                        this.runningProcess = null;
                        this.startProcess();
                    }, (code === 1337 || this.runningProcess.purposefulStop) ? 1000 : 5000);
                });

            } else {
                this.runningProcess = spawn('bash', ['-c', scriptPath], {
                    stdio: ['inherit', 'pipe', 'pipe'],
                    env: { ...process.env, FORCE_COLOR: 'true' },
                    detached: process.platform !== 'win32',
                });

                const handleOutput = (data, isError = false) => {
                    const lines = data.toString().split('\n').filter(Boolean);
                    lines.forEach(line => {
                        const logLine = `${getTimestamp()}${isError ? " ERROR:" : ""} ${line}`;
                        if (isError) process.stderr.write(`${logLine}\n`);
                        else process.stdout.write(`${logLine}\n`);
                        this.logger.appendLog(logLine);
                    });
                };

                this.runningProcess.stdout.on('data', d => handleOutput(d));
                this.runningProcess.stderr.on('data', d => handleOutput(d, true));

                const onExit = (code, signal) => {
                    code = code === 57 ? 1337 : code;
                    const pingUser = this.options.webhook_ping_user ? ` <@${this.options.webhook_ping_user}>` : "";
                    const pingRole = this.options.webhook_ping_role ? ` <@&${this.options.webhook_ping_role}>` : "";
                    this.logger.logSend(`Process exited with code ${code}. ${code === 1337 ? "No ping, intended restart" : `Restarting...${pingUser}${pingRole}`}`);
                    setTimeout(() => {
                        this.runningProcess = null;
                        this.startProcess();
                    }, (code === 1337 || signal === 'SIGINT') ? 1000 : 5000);
                };

                this.runningProcess.on('exit', (code, signal) => {
                    this.logger.logSend(`Process exited with code ${code}, signal ${signal}.`);
                    onExit(code, signal);
                });
            }
        }
    }

    autoRestart() {
        if (!this.options.dailyrestart_enable) return;
        if (this.restartScheduled) {
            this.logger.logSend("Restart already scheduled.");
            return;
        }

        const restartTimes = Array.isArray(this.options.dailyrestart_time) ? this.options.dailyrestart_time : [this.options.dailyrestart_time];
        let earliestTime = null;
        for (const timeStr of restartTimes) {
            const [hour, minute] = timeStr.split(':').map(Number);
            const now = new Date();
            const restartTime = new Date();
            restartTime.setHours(hour, minute, 0, 0);
            if (restartTime < now) restartTime.setDate(restartTime.getDate() + 1);
            if (!earliestTime || restartTime < earliestTime) {
                earliestTime = restartTime;
            }
        }

        let timeUntilRestart = earliestTime - new Date();
        if (timeUntilRestart <= 0) timeUntilRestart += 24*60*60*1000;

        this.logger.logSend(`Scheduled restart in ${Math.floor(timeUntilRestart / 1000 / 60)} minutes.`);
        this.restartScheduled = true;

        setTimeout(async () => {
            if (this.options.dailyrestart_quickpull) {
                this.logger.logSend("Quick-pulling before restart.");
                this.executeCommand('git', ['pull'], 'ignore');
            }
            this.logger.logSend("Auto-restarting process.");
            await this.startProcess();
            this.restartScheduled = false;
            this.autoRestart();
        }, timeUntilRestart);
    }

    executeCommand(command, args, stdio = "inherit") {
        let dir = this.options.dir || "";

        console.log(dir, this.options.dir);

        const cmdProcess = spawn(command, args, {
            stdio,
            cwd: this.options.dir && this.options.dir !== "" && dir,
        });
    
        cmdProcess.on('exit', (code) => {
            if (stdio !== 'ignore') console.log(`${command} exited with code: ${code}`);
        });
    
        cmdProcess.on('error', (err) => {
            console.error(`Failed to start ${command}:`, err);
        });
    }
}
