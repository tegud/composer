const loadConfig = require('../config').get;

let availableProcessors;
let processors;

module.exports = {
    clear: () => {
        availableProcessors = [];
        processors = {};

        return Promise.resolve();
    },
    register: (type, processor) => {
        availableProcessors[type] = processor;

        return Promise.resolve();
    },
    start: () => {
        const config = loadConfig();

        processors = (config.processors || []).reduce((processors, processorConfig) => {
            const processor = availableProcessors[processorConfig.type];

            if(!processor) {
                throw new Error(`Could not find processor: ${processorConfig.type}`);
            }

            processors[processorConfig.name] = new processor;

            return processors;
        }, {})

        return Promise.resolve();
    },
    processEvents: (type, events) => processors[type].aggregate(events)
};
