//"perpetual.js" by onlypuppy7: standalone version

//basic
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
//perpetual: perpetual
import { spawn } from 'child_process';
import readline from 'readline';
//perpetual: logging
import log from '#coloured-logging';
import { getTimestamp } from '#misc';
//perpetual: workers
import { Worker } from 'node:worker_threads';
//

let rootDir = import.meta.dirname;

if (!rootDir) {
    const __filename = fileURLToPath(import.meta.url);
    rootDir = dirname(__filename);
    console.log("(Using fallback mechanism for rootDir)");
};

console.log(process.argv, rootDir);

if (typeof fetch !== 'function') {
    console.log("This script requires the native fetch API to be available. Upgrade to the latest Node LTS.");
    process.exit(0);
};

let defaultconfiglocation = path.join(rootDir, "src", "defaultconfig.yaml");
let configlocation = path.join(rootDir, "store", "config.yaml");

if (!fs.existsSync(configlocation)) {
    fs.mkdirSync(path.dirname(configlocation), { recursive: true });
    fs.copyFileSync(defaultconfiglocation, configlocation);
};

let config = yaml.load(fs.readFileSync(configlocation, 'utf8'));

let server_type = process.argv[2].replace("--","");

let passed = config[server_type];

if (!passed) {
    //join all argv past the first two into a string
    let process_cmd = process.argv.slice(2).join(" ");
    let dir = process.cwd();

    //parse dir if cd is used
    if (process_cmd.includes("cd ")) {
        console.log("Using custom process command:", process_cmd);
        //detect via regex if cd is used
        const cdMatch = process_cmd.match(/cd\s+([^\s]+)\s*&&\s*(.*)/);
        if (cdMatch) {
            console.log("Detected 'cd' command in process_cmd:", cdMatch[1]);
            dir = cdMatch[1];
        };
    };

    passed = {
        process_cmd,
        dir,
    };
};

//this is bad code
const options = {
    //process
    process_cmd:            passed.process_cmd              || "idk lol",
    dir:                    passed.dir                      || "",
    //daily restart
    dailyrestart_enable:    passed.dailyrestart_enable      || false,
    dailyrestart_time:      passed.dailyrestart_time        || "4:00",
    dailyrestart_quickpull: passed.dailyrestart_quickpull,
    //file logging
    logfile_enable:         passed.logfile_enable,
    logfile_location:       path.join(rootDir, "store", "logs", server_type), //no editing kek
    //webhook logging
    webhook_url:            passed.webhook_url              || "", //false or empty is disabled
    webhook_username:       passed.webhook_username         || "Webhook", //eg "LegacyShell: Client Server"
    webhook_avatar:         passed.webhook_avatar           || "https://cdn.onlypuppy7.online/legacyshell/client.png", //eg "https://cdn.onlypuppy7.online/legacyshell/client.png"
    webhook_ping_user:      passed.webhook_ping_user        || false, //this might flood your shit
    webhook_ping_role:      passed.webhook_ping_role        || false, //this might flood EVERYONE'S shit
    //pulling
    is_puller:              config.pullers.includes(server_type) || false,
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
});

function executeCommand(command, args, stdio = "inherit") {
    let dir = options.dir || "";

    console.log(dir, options.dir);

    const cmdProcess = spawn(command, args, {
        stdio,
        cwd: options.dir && options.dir !== "" && dir,
    });

    cmdProcess.on('exit', (code) => {
        if (stdio !== 'ignore') console.log(`${command} exited with code: ${code}`);
    });

    cmdProcess.on('error', (err) => {
        console.error(`Failed to start ${command}:`, err);
    });
};

rl.prompt();
rl.on('line', async (line) => {
    let cmd = line.trim();
    if (cmd === "r" || cmd === "restart") {
        await startProcess(true);
    } else if (cmd === "p" || cmd === "pull") {
        executeCommand('git', ['pull']);
    } else if (cmd === "pr") { // pull and restart
        executeCommand('git', ['pull']);
        setTimeout(() => {
            startProcess(true);
        }, 5e3);
    };
    rl.prompt();
}).on('close', () => {
    console.log('Exiting interactive mode');
    process.exit(0);
});

// console.log(process.argv, passed);

const stripAnsi = (str) => {
    return str.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');
};

let logQueue = [];
let queuedChunks = [];
let maxMessageLength = 1900;
let messagesSent = 0;

const logSend = (msg) => {
    msg = `#${getTimestamp()} ${msg}`;
    log.muted(msg);
    appendLog(msg);
};

const logNoSend = (msg) => {
    msg = `#${getTimestamp()} ${msg}`;
    log.muted(msg);
    appendLog(msg, true);
};

fs.mkdirSync(options.logfile_location, { recursive: true });
const logFilePath = path.join(options.logfile_location, `${server_type}_${getTimestamp(true)}.log`);
fs.mkdirSync(path.dirname(logFilePath), { recursive: true });  // Ensure the directory exists

const appendLog = (msg, noSend) => {
    msg = stripAnsi(msg);
    (!noSend) && logQueue.push(msg);
    fs.appendFile(logFilePath, `${msg}\n`, (err) => {
        if (err) {
            console.error(`Failed to write to log file: ${err.message}`);
        };
    });
};

logSend("Logfiles will be sent to: "+logFilePath);

function divideString(str, chunkSize) {
    let result = [];
    for (let i = 0; i < str.length; i += chunkSize) {
        result.push(str.slice(i, i + chunkSize));
    };
    return result;
};

let webhookInterval;
let runningProcess = null;
let restartScheduled = false;

const sendLogsToWebhook = () => {
    while (logQueue.length > 0) {
        let msg = logQueue.shift();
        if (msg.length > maxMessageLength) {
            let msgs = divideString(msg, maxMessageLength);
            logQueue = [
                ...msgs,
                ...logQueue
            ];
            // console.log("exceeded", logQueue, queuedChunks);
        } else {
            let lastChunk = queuedChunks[0] || "";
            let newMessage = `\n${msg}`;
            let newChunk = lastChunk + newMessage;
            if (newChunk.length > maxMessageLength) {
                queuedChunks.unshift(newMessage);
                // console.log("new chunk");
            } else {
                queuedChunks[0] = newChunk;
                // console.log("old chunk");
            };
        };
    };

    // console.log(queuedChunks.length, logQueue, queuedChunks)
    if (queuedChunks.length > 0) {
        // logNoSend(`Sending log chunk to webhook...`);
        fetch(options.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username: options.webhook_username,
                avatar_url: options.webhook_avatar,
                content: `${queuedChunks[queuedChunks.length - 1].slice(0, 2000)} (${messagesSent%1000})`, //just in case #_#
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to send logs: ${response.statusText}`);
            };
            logNoSend(`Logs successfully sent to webhook. ${messagesSent}`);
            queuedChunks.pop(); messagesSent++;
        })
        .catch(err => {
            logNoSend(`Error sending logs to webhook: ${JSON.stringify(err.message)}`);
        });
    };
    const randomDelay = (15 - Math.min(queuedChunks.length, 7) + Math.floor(Math.random() * 8) - 4) * 1000; // +/- 4 seconds randomisation
    clearInterval(webhookInterval);
    webhookInterval = setInterval(sendLogsToWebhook, randomDelay);
};

const startProcess = async (purposefulStop) => {
    if (runningProcess) {
        logSend(`Stopping previous process...`);
        runningProcess.purposefulStop = purposefulStop || false;
        if (runningProcess instanceof Worker) {
            try {
                await runningProcess.terminate();
            } catch (error) {
                logSend(`Failed to stop previous process via .terminate: ${error.message} ${runningProcess}`);
            };
        } else {
            try {
                runningProcess.kill('SIGINT');
                logSend(`Stopped previous process via .kill: ${runningProcess.pid}`);
            } catch (error) {
                logSend(`Failed to stop previous process via .kill: ${error.message} ${runningProcess}`);
            };
            try {
                process.kill(-runningProcess.pid, 'SIGINT');
                logSend(`Stopped previous process via process.kill: ${runningProcess.pid}`);
            } catch (error) {
                logSend(`Failed to stop previous process via process.kill: ${error.message} ${runningProcess}`);
            };
        };
    } else {
        logSend(`Starting process: ${options.process_cmd}`);

        let useWorkerThreads = true;
        let isNodeScript = options.process_cmd.startsWith('node ');
        let scriptPath = options.process_cmd;

        // if (isNodeScript) {
        //     scriptPath = scriptPath.slice(5).trim();
        // };

        if (isNodeScript && useWorkerThreads) {
            // use worker threads for Node.js scripts
            scriptPath = scriptPath.slice(5).trim();
            //get the absolute path of the script
            scriptPath = path.isAbsolute(scriptPath) ? scriptPath : path.join(rootDir, scriptPath);
            if (!fs.existsSync(scriptPath)) {
                logSend(`Script file does not exist: ${scriptPath}`);
                return;
            };
            logSend(`Using Worker Threads for script: ${scriptPath}`);
            runningProcess = new Worker(scriptPath, {
                workerData: {  },
                stdout: true,
                stderr: true,
            });
            runningProcess.stdout.on('data', (data) => {
                const lines = data.toString().split('\n').filter(Boolean);
                lines.forEach(line => {
                    const log = `${getTimestamp()} ${line}`;
                    process.stdout.write(`${log}\n`);
                    appendLog(log);
                });
            });
            runningProcess.stderr.on('data', (data) => {
                const lines = data.toString().split('\n').filter(Boolean);
                lines.forEach(line => {
                    const log = `${getTimestamp()} ERROR: ${line}`;
                    process.stderr.write(`${log}\n`);
                    appendLog(log);
                });
            });
            runningProcess.on('error', (err) => {
                const log = `${getTimestamp()} ERROR: ${err.message}`;
                process.stderr.write(`${log}\n`); // color and timestamp
                appendLog(log);
            });
            runningProcess.on('exit', (code, signal) => {
                code = code == 57 ? 1337 : code; // 1337%256 = 57
                if (signal === 'SIGINT') {
                    logSend(`Process terminated manually.`);
                    return;
                };
                let pingUser = options.webhook_ping_user ? ` <@${options.webhook_ping_user}>` : "";
                let pingRole = options.webhook_ping_role ? ` <@&${options.webhook_ping_role}>` : "";
                logSend(`Process exited with code ${code}, signal ${signal}. ${(code == 1337 || runningProcess.purposefulStop) ? "No ping, intended restart" : `Restarting...${pingUser}${pingRole}`}`);

                setTimeout(() => {
                    runningProcess = null;
                    startProcess();
                }, (code == 1337 || runningProcess.purposefulStop) ? 1e3 : 5e3);
            });
        } else {
            runningProcess = spawn('bash', ['-c', scriptPath], {
                stdio: ['inherit', 'pipe', 'pipe'],
                env: { ...process.env, FORCE_COLOR: 'true' },
                detached: process.platform !== 'win32',
            });

            runningProcess.stdout.on('data', (data) => {
                const lines = data.toString().split('\n').filter(Boolean);
                lines.forEach(line => {
                    const log = `${getTimestamp()} ${line}`;
                    process.stdout.write(`${log}\n`); // color and timestamp
                    appendLog(log);
                });
            });

            runningProcess.stderr.on('data', (data) => {
                const lines = data.toString().split('\n').filter(Boolean);
                lines.forEach(line => {
                    const log = `${getTimestamp()} ERROR: ${line}`;
                    process.stderr.write(`${log}\n`); // color and timestamp
                    appendLog(log);
                });
            });

            function onExit(code, signal) {
                code = code == 57 ? 1337 : code; // 1337%256 = 57

                // if (signal === 'SIGINT') {
                //     logSend(`Process terminated manually.`);
                //     return;
                // };

                let pingUser = options.webhook_ping_user ? ` <@${options.webhook_ping_user}>` : "";
                let pingRole = options.webhook_ping_role ? ` <@&${options.webhook_ping_role}>` : "";
                logSend(`Process exited with code ${code}. ${code == 1337 ? "No ping, intended restart" : `Restarting...${pingUser}${pingRole}`}`);
                setTimeout(() => {
                    runningProcess = null;
                    startProcess();
                }, (code == 1337 || signal === 'SIGINT') ? 1e3 : 5e3);
            };

            runningProcess.on('exit', (code, signal) => {
                logSend(`Process exited with code ${code}, signal ${signal}.`);
                onExit(code, signal);
            });
        };
    

        // runningProcess.on('error', (err) => {
        //     console.error(`Failed to start process:`, err);
        //     onExit(1, 'SIGINT');
        // });

        // runningProcess.on('close', (code) => {
        //     logSend(`Process closed with code ${code}.`);
        //     onExit(code, 'SIGINT');
        // });
    };
};

const autoRestart = () => {
    if (options.dailyrestart_enable) {
        if (restartScheduled) {
            logSend(`Restart already scheduled.`);
            return;
        };
    
        const now = new Date();
        const [restartHour, restartMinute] = options.dailyrestart_time.split(':').map(Number);
        const nextRestart = new Date();
        nextRestart.setHours(restartHour, restartMinute, 0, 0);

        if (nextRestart < now) {
            nextRestart.setDate(nextRestart.getDate() + 1);
        };
        
        let timeUntilRestart = nextRestart - now;
        if (timeUntilRestart <= 0) {
            timeUntilRestart += 24 * 60 * 60 * 1000;
        };
    
        logSend(`Scheduled restart in ${Math.floor(timeUntilRestart / 1000 / 60)} minutes.`);
        restartScheduled = true;
    
        setTimeout(async () => {
            if (options.dailyrestart_quickpull) {
                logSend(`Quick-pulling before restart.`);
                executeCommand('git', ['pull'], 'ignore');
            };
            logSend(`Auto-restarting process.`);
            await startProcess();
            restartScheduled = false;
            autoRestart();
        }, timeUntilRestart);
    };
};

//this is just a big piece of shit to test message splitting. uncomment to rape discord
// logSend(("e").repeat(4000));

logSend(`Started with options: ${JSON.stringify(options)}\n`);

if (options.webhook_url && options.webhook_url.length > 0) {
    logSend("Logs will be sent to webhook every ~15 seconds.");
    webhookInterval = setInterval(sendLogsToWebhook, 15000);
} else {
    logSend("Logs won't be sent to webhook, as no URL was provided.");
};

await startProcess();
autoRestart();

// function getVersionHash() {
//     try {
//         var newVersionHash= fs.readFileSync(rootDir, path.join(ss.rootDir, "versionHash.txt"), 'utf8').trim();
//         return newVersionHash;
//     } catch (error) { //cant risk it on the perpetual script
//         return null;
//     };
// };

// let versionHash = getVersionHash();

// (setInterval(() => {
//     let newVersionHash = getVersionHash()
//     if (versionHash !== newVersionHash) {
//         log.bgGreen(versionHash, newVersionHash, "Version hash has changed, update! Restarting...");
//         versionHash = newVersionHash; //why didnt i include this before? i thought that this perpetual wrapper restarted too. am stupid
//         startProcess();
//     };
// }, 15e3));

// function pullQuestionMark() {
//     if (options.is_puller) {
//         logNoSend("Pulling from git...", versionHash);
//         executeCommand('git', ['pull'], 'ignore');
//     };
// };

// pullQuestionMark();

// (setInterval(() => {
//     pullQuestionMark();
// }, 120e3)); //every 2 minutes seems reasonable