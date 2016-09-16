const loadConfig = require('./config');
const validModes = ['expiry', 'store'];

module.exports = function(mode) {
    if(!validModes.includes(mode)){
        return console.error(`${mode} is not a valid option, please enter one ${validModes}`);
    }

    return {
        start: () => loadConfig().then(config => {
            console.log(`Loading compose in ${mode} mode.`);
            console.log(config);
            const composerModule = new require(`./${mode}`)(config);
            return composerModule.start();
        })
    }
};
