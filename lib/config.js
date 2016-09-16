const fs = require('fs');

function loadFile(file) {
    return new Promise((resolve, reject) => {
        fs.readFile(`${__dirname}/../${file}`, 'utf-8', (err, data) => {
            if(err) {
                console.log('HELLO');
                return reject(err);
            }

            resolve(data);
        })
    });
}

function parseJson(data) {
    return new Promise(resolve => resolve(JSON.parse(data)));
}

module.exports = () => loadFile('config.json').then(parseJson);
