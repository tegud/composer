const loadConfig = require('./config').load;
const processors = require('./processors');
const validModes = ['expiry', 'store', 'builder', 'scanner'];

module.exports = function(...modes) {
    if(typeof modes === 'string') {
        modes = [modes];
    }

    const invalidModes = modes.filter(mode => !validModes.includes(mode));

    if(invalidModes.length) {
        invalidModes.forEach(mode => console.error(`${mode} is not a valid option, please enter one of ${validModes.join(', ')}`));
        return { start: () => {} };
    }

    return {
        start: () => loadConfig()
            .then(config => Promise.all([
                require('./statsd').configure(config),
                processors.start(),
                ...modes.map(mode => new require(`./${mode}`)(config).start())
            ]))
            .catch(e => console.error(`Could not start composer: ${e.message}`)),
        registerProcessor: (...args) => processors.register(...args),
        stop: () => processors.clear()
    }
};
