(async (params) => {
    while (true) {
        console.log("Hello, world!");
        await new Promise(resolve => setTimeout(resolve, 1000));
    };
})();