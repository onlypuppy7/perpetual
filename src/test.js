import log from '#coloured-logging';

(async () => {
    let count = 0;
    while (true) {
        log.success("Hello, world!", count++);
        if (count == 10) throw new Error("Test error to check error handling");
        await new Promise(resolve => setTimeout(resolve, 1000));
    };
})();