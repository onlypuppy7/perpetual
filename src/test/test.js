import Perpetual from '../index.js';

const perpetual = new Perpetual('test_process', {
    // process_cmd: 'node ./src/test/test_process.js',
    process_cmd: 'date',
})
await perpetual.run();