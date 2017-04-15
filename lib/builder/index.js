const AmqpListener = require('../amqp-listen');
const AmqpPublisher = require('../amqp-publish');
const RedisStore = require('../redis-store');
const GetSessionFromRedis = require('./get-session-from-redis');
const eventEmitter = require('../events');
const processors = require('../processors');

function parseSessionEntryJson(sessionEntries) {
    return Promise.resolve(sessionEntries.map(entry => JSON.parse(entry)));
}

module.exports = function(config) {
    return {
        start: () => {
            console.log('Starting composer builder module.');

            const amqpListener = new AmqpListener(config.amqpListen);
            const amqpPublisher = new AmqpPublisher(config.amqpPublish);
            const redisStore = new RedisStore(config.redis);
            const getSessionFromRedis = new GetSessionFromRedis(redisStore);

            eventEmitter.on('amqp-event-received', data => {
                const id = data.expiredKey;
                const type = data.aggregatorType;

                getSessionFromRedis.getSessionForId(id)
                    .then(sessionEntries => parseSessionEntryJson(sessionEntries))
                    .then(sessionEntries => processors.processEvents(type, sessionEntries))
                    .then(aggregatedEvent => eventEmitter.emit('event-processing-complete', aggregatedEvent));
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
