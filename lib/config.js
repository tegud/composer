const fs = require('fs');

let config;

function loadFile(file) {
    return new Promise((resolve, reject) => {
        fs.readFile(`${__dirname}/../${file}`, 'utf-8', (err, data) => {
            if(err) {
                return reject(err);
            }

            resolve(data);
        })
    });
}

function parseJson(data) {
    return Promise.resolve(JSON.parse(data));
}

module.exports = {
    load: () => loadFile('config.json')
        .then(parseJson)
        .then(parsedConfig => Promise.resolve(config = parsedConfig)),
    get: () => config
};
