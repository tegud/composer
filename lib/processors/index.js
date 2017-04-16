const loadConfig = require('../config').get;

let availableProcessors = [];
let processors = {};

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

            processors[processorConfig.name] = new processor(processorConfig);

            return processors;
        }, {})

        return Promise.resolve();
    },
    processEvents: (type, events) => {
        if(!processors[type]) {
            return Promise.reject(new Error(`Unknown processor: ${type}`));
        }

        return processors[type].aggregate(events);
    },
    storeEvents: event => Promise.resolve(Object.keys(processors).reduce((stores, processorKey) => {
        if(!processors[processorKey].matches(event)) {
            return stores;
        }

        const expiryKey = processors[processorKey].createKey(event);

        return [...stores, {
            key: expiryKey,
            expiredKey: `${processorKey}_${expiryKey}`,
            eventListKey: `${processorKey}_list_${expiryKey}`,
            expiryTimeout: processors[processorKey].config().timeout,
            event: event
        }];
    }, []))
};
