import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import Perpetual from './src/index.js';

let rootDir = import.meta.dirname;

if (!rootDir) {
    const __filename = fileURLToPath(import.meta.url);
    rootDir = dirname(__filename);
    console.log("(Using fallback mechanism for rootDir)");
};

console.log(process.argv, rootDir);

const serverName = process.argv[2].replace("--","");
const isDirect = !process.argv[2].startsWith("--");

const perpetual = new Perpetual(serverName, {
    process_cmd: isDirect ? process.argv.slice(2).join(" ") : null,
    rootDir,
});
await perpetual.run();