# puppyperpetual

node script to run things... perpetually. adapted from [legacyshell](https://github.com/onlypuppy7/LegacyShell)

[On npm @ https://www.npmjs.com/package/puppyperpetual](https://www.npmjs.com/package/puppyperpetual)

[And GitHub @ https://github.com/onlypuppy7/perpetual](https://github.com/onlypuppy7/perpetual)

## usage (as an npm package)

you can use it to run your node stuff perpetually:

```js
import Perpetual from '../index.js';

const perpetual = new Perpetual('test_process', {
    process_cmd: 'node ./src/test/test_process.js',
});
await perpetual.run();
```

or anything really:

```js
import Perpetual from '../index.js';

const perpetual = new Perpetual('test_process', {
    process_cmd: 'cd . && git pull && date',
});
await perpetual.run();
```

## usage (as a node app thing)

as per tradition for my projects, simple installation!

1. `npm i`

then run once to create config

- `npm run start`

then customise it in `store/config.yaml`, making a new entry for every thing

then run like this:

- `node .\perpetual.js --default`

alternatively, just pass in your command:

- `node .\perpetual.js "cd . && echo date"`

then you dont need to mess around with the horrible yaml. dont worry, i hate doing it too.

## it doesnt work?

i dont care. i use this for my own stuff. i know that it works on linux and thats all i need.