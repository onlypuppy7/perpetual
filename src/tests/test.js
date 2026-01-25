import Perpetual from 'puppyperpetual';

const perpetual = new Perpetual('test_process', {
    process_cmd: 'node ./src/tests/test_process.js',
    // process_cmd: 'date',
    webhook_url: 'https://discord.com/api/webhooks/1460782220192256031/Fkibsumk3hWg4M6F2eCmDe_ylXaJlY_z3W9XeCMWbiw4r8zcYfQJg64YeIhaHT-7tpbT',
    dailyrestart_enable: true,
    dailyrestart_time: ['15:26', '15:27', '15:28', '15:29', '15:30', '15:31', '20:00'],
    useWorkerThreads: false,
})
await perpetual.run();