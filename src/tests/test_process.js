import chalk from 'chalk';
import log from 'puppylog';

console.log('FORCE_COLOR:', process.env.FORCE_COLOR);
console.log('isTTY', process.stdout.isTTY);
console.log('raw green:', '\x1b[1;32mGREEN\x1b[0m');
console.log("directory:", process.cwd());

(async () => {
    let count = 0;
    while (true) {
        log.success("Hello, world!", count++);
        if (count == 10) throw new Error("Test error to check error handling");
        await new Promise(resolve => setTimeout(resolve, 1000));
    };
})();