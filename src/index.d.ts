/// <reference types="node" />

import { Worker } from "node:worker_threads";
import { SpawnOptions } from "node:child_process";

export interface ServerOptions {
    process_cmd: string;
    dir: string;
    dailyrestart_enable: boolean;
    dailyrestart_time: string | string[];
    dailyrestart_quickpull?: boolean;
    logfile_enable?: boolean;
    logfile_location: string;
    webhook_url: string;
    webhook_username: string;
    webhook_avatar: string;
    webhook_ping_user?: string | false;
    webhook_ping_role?: string | false;
    is_puller: boolean;
}

/**
 * Options passed to Perpetual constructor
 * Can include any ServerOptions keys (partial) plus rootDir and noYAML
 */
export interface PerpetualOptions extends Partial<ServerOptions> {
    rootDir?: string;
    noYAML?: boolean;
}

/**
 * Top-level perpetual runner
 */
export declare class Perpetual {
    configManager: ConfigManager;
    options: ServerOptions;
    logger: Logger;
    processManager: ProcessManager;

    constructor(serverName: string, options?: PerpetualOptions);

    /** Runs the interactive command loop */
    run(): Promise<void>;
}

/**
 * Config manager for server options
 */
export declare class ConfigManager {
    rootDir: string;
    serverName: string;
    defaultConfigPath: string;
    configPath: string;
    config: any;

    constructor(rootDir: string, serverName: string, noYAML?: boolean);

    /** Ensures config YAML exists */
    ensureConfigExists(): void;

    /** Returns merged server options */
    getServerOptions(options?: Partial<ServerOptions>): ServerOptions;
}

/**
 * Logger that writes to file and optional webhook
 */
export declare class Logger {
    options: ServerOptions;
    logQueue: string[];
    queuedChunks: string[];
    maxMessageLength: number;
    messagesSent: number;
    logFilePath: string;
    webhook?: any;

    constructor(options: ServerOptions);

    /** Appends a log message, optionally sending via webhook */
    appendLog(msg: string, noSend?: boolean): void;

    /** Logs a message with sending */
    logSend(msg: string): void;

    /** Logs a message without sending */
    logNoSend(msg: string): void;
}

/**
 * Process manager for starting, stopping, and restarting processes
 */
export declare class ProcessManager {
    options: ServerOptions;
    logger: Logger;
    rootDir: string;
    runningProcess: any;
    restartScheduled: boolean;

    constructor(options: ServerOptions, logger: Logger, rootDir: string);

    /** Starts the process, optionally stopping previous one */
    startProcess(purposefulStop?: boolean): Promise<void>;

    /** Automatically schedules restarts if enabled */
    autoRestart(): void;

    /** Executes a command in the process's directory */
    executeCommand(command: string, args: string[], stdio?: SpawnOptions["stdio"]): void;
}

declare const _default: typeof Perpetual;
export default _default;
