const AmqpListener = require('../amqp-listen');
const AmqpPublisher = require('../amqp-publish');
const RedisStore = require('../redis-store');
const GetSessionFromRedis = require('./get-session-from-redis');
const eventEmitter = require('../events');
const processors = require('../processors');
const statsd = require('../statsd');
const moment = require('moment');

function parseSessionEntryJson(sessionEntries) {
    return Promise.resolve(sessionEntries.map(entry => JSON.parse(entry)));
}

function getMaxAge(entries) {
    const dateOrderedEntries = [...entries]
        .filter(entry => entry['@timestamp'])
        .map(entry => moment(entry['@timestamp']).valueOf())
        .sort((a, b) => a > b)
        .reverse();

    if(!dateOrderedEntries.length) {
        return 0;
    }

    return moment().valueOf() - dateOrderedEntries;
}

module.exports = function(config) {
    return {
        start: () => {
            console.log('Starting composer builder module.');

            const amqpListener = new AmqpListener(config.expiryQueue, 'builder');
            const amqpPublisher = new AmqpPublisher(config.completedQueue);
            const redisStore = new RedisStore(config.redis);
            const getSessionFromRedis = new GetSessionFromRedis(redisStore);

            eventEmitter.on('amqp-event-received.builder', data => {
                const id = data.store && data.store.eventListKey ? data.store.eventListKey : undefined;
                const type = data.aggregatorType;

                if(!id || !type) {
                    console.log('Incorrectly formatted object, missing id or type.');
                    console.log(data);
                    return;
                }

                getSessionFromRedis.getSessionForId(id)
                    .then(sessionEntries => parseSessionEntryJson(sessionEntries))
                    .then(sessionEntries => {
                        statsd.sendTimer(`builder.processor=${type}.timeToWrite`, getMaxAge(sessionEntries));
                        return processors.processEvents(type, { key: data.expiredKey, events: sessionEntries });
                    })
                    .then(aggregatedEvent => eventEmitter.emit('event-processing-complete', aggregatedEvent))
                    .catch(err => {
                        console.error(err.message);
                    });
            });

            return Promise.all([
                amqpListener.start(),
                redisStore.start(),
                amqpPublisher.start(),
                getSessionFromRedis.start()
            ]);
        }
    };
};
