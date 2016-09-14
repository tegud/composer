const Redis = require('./redis');
const Amqp = require('./amqp');
const MessageHandler = require('./message-handler');

function loadConfig() {
    return new Promise(resolve => resolve({
        redis: {},
        amqp: {
            host: '127.0.0.1',
            exchange: 'composer-expired'
        }
    }));
}

module.exports = function() {
    return {
        start: () => loadConfig()
            .then(config => {
                const redis = new Redis(config.redis);
                const amqp = new Amqp(config.amqp);
                const messageHandler = new MessageHandler();

                return Promise.all([
                    redis.start(),
                    amqp.start(),
                    messageHandler.start()
                ]);
            })
    }
};
