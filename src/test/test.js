import Perpetual from '../index.js';

const perpetual = new Perpetual('test_process', {
    // process_cmd: 'node ./src/test/test_process.js',
    process_cmd: 'date',
    webhook_url: 'https://discord.com/api/webhooks/1460782220192256031/Fkibsumk3hWg4M6F2eCmDe_ylXaJlY_z3W9XeCMWbiw4r8zcYfQJg64YeIhaHT-7tpbT',
})
await perpetual.run();