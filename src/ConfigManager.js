import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export class ConfigManager {
    constructor(rootDir, serverName) {
        this.rootDir = rootDir;
        this.serverName = serverName;

        this.defaultConfigPath = path.join(rootDir, 'src', 'defaultconfig.yaml');
        this.configPath = path.join(rootDir, 'store', 'config.yaml');

        this.ensureConfigExists();
        this.config = yaml.load(fs.readFileSync(this.configPath, 'utf8'));
    }

    ensureConfigExists() {
        if (!fs.existsSync(this.configPath)) {
            fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
            fs.copyFileSync(this.defaultConfigPath, this.configPath);
        }
    }

    getServerOptions(options) {
        let passed = options || {};
        Object.apply(passed, this.config.servers?.[this.serverName] || {});

        if (!passed.dir) {
            if (passed.process_cmd.includes("cd ")) {
                console.log("Using custom process command:", passed.process_cmd);
                //detect via regex if cd is used
                const cdMatch = passed.process_cmd.match(/cd\s+([^\s]+)\s*&&\s*(.*)/);
                if (cdMatch) {
                    console.log("Detected 'cd' command in process_cmd:", cdMatch[1]);
                    passed.dir = cdMatch[1];
                };
            };
        }

        return {
            //process
            process_cmd:            passed.process_cmd              || "idk lol",
            dir:                    passed.dir                      || "",
            //daily restart
            dailyrestart_enable:    passed.dailyrestart_enable      || false,
            dailyrestart_time:      passed.dailyrestart_time        || "4:00",
            dailyrestart_quickpull: passed.dailyrestart_quickpull,
            //file logging
            logfile_enable:         passed.logfile_enable,
            logfile_location:       passed.logfile_location         || path.join(this.rootDir, "store", "logs", this.serverName), //no editing kek
            //webhook logging
            webhook_url:            passed.webhook_url              || "", //false or empty is disabled
            webhook_username:       passed.webhook_username         || "Webhook", //eg "LegacyShell: Client Server"
            webhook_avatar:         passed.webhook_avatar           || "https://cdn.onlypuppy7.online/legacyshell/client.png", //eg "https://cdn.onlypuppy7.online/legacyshell/client.png"
            webhook_ping_user:      passed.webhook_ping_user        || false, //this might flood your shit
            webhook_ping_role:      passed.webhook_ping_role        || false, //this might flood EVERYONE'S shit
            //pulling
            is_puller:              this.config.pullers?.includes(this.serverName) || false,
        };
    }
}
