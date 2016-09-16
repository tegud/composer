const AmqpListener = require('../amqp-listen');
const RedisStore = require('../redis-store');

module.exports = function(config) {
    return {
        start: () => {
            console.log('Starting composer expiry module.');

            const amqpListener = new AmqpListener(config.amqp);
            const redisStore = new RedisStore(config.redis);

            return Promise.all([
                amqpListener.start(),
                redisStore.start()
            ]);
        }
    };
};
