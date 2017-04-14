const loadConfig = require('./config').load;
const processors = require('./processors');
const validModes = ['expiry', 'store', 'builder'];

module.exports = function(mode) {
    if(!validModes.includes(mode)){
        return console.error(`${mode} is not a valid option, please enter one of ${validModes}`);
    }

    return {
        start: () => loadConfig()
            .then(config => Promise.all([
                processors.start(),
                new require(`./${mode}`)(config).start()
            ])),
        registerProcessor: (...args) => processors.register(...args),
        stop: () => processors.clear()
    }
};
