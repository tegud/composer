const AmqpListener = require('../amqp-listen');
const AmqpPublisher = require('../amqp-publish');
const RedisStore = require('../redis-store');
const GetSessionFromRedis = require('./get-session-from-redis');
const eventEmitter = require('../events');
const processors = require('../processors');

module.exports = function(config) {
    return {
        start: () => {
            console.log('Starting composer builder module.');

            const amqpListener = new AmqpListener(config.amqpListen);
            const amqpPublisher = new AmqpPublisher(config.amqpPublish);
            const redisStore = new RedisStore(config.redis);
            const getSessionFromRedis = new GetSessionFromRedis(redisStore);

            eventEmitter.on('amqp-event-received', data => {
                const id = data.id;
                const type = data.type;

                getSessionFromRedis.getSessionForId(id)
                    .then(sessionEntries => {
                        const parsedEntries = sessionEntries.map(entry => JSON.parse(entry));

                        return processors.processEvents(type, parsedEntries);
                    })
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
