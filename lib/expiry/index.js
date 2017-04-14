const RedisKeyspaceEventListener = require('../redis-keyspace-event-listener');
const AmqpPublisher = require('../amqp-publish');
const MessageHandler = require('./message-handler');

module.exports = function(config) {
    return {
        start: () => {
            console.log('Starting composer expiry module.');

            const redisKeyspaceEventListener = new RedisKeyspaceEventListener(config.redis);
            const amqpPublisher = new AmqpPublisher(config.amqpPublish);
            const messageHandler = new MessageHandler();

            return Promise.all([
                redisKeyspaceEventListener.start(),
                amqpPublisher.start(),
                messageHandler.start()
            ]);
        }
    };
};
