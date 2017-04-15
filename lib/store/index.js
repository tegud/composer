const AmqpListener = require('../amqp-listen');
const RedisStore = require('../redis-store');
const eventEmitter = require('../events');
const processors = require('../processors');

module.exports = function(config) {
    return {
        start: () => {
            console.log('Starting composer expiry module.');

            const amqpListener = new AmqpListener(config.amqpListen);
            const redisStore = new RedisStore(config.redis);

            eventEmitter.on('amqp-event-received', data => processors.storeEvents(data)
                .then(processorStores => Promise.all(processorStores.map(data => redisStore.store(data)))));

            return Promise.all([
                amqpListener.start(),
                redisStore.start()
            ]);
        }
    };
};
