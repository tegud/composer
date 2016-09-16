const redis = require('redis');
const eventEmitter = require('./events');

function storeToRedis(client, data) {
    client.lpush(data.id, JSON.stringify(data));
}

module.exports = function(config) {
    const client = redis.createClient(config.port, config.host);

    return {
        stop: function() {
            return new Promise(resolve => {
                client.quit();

                resolve();
            });
        },
        start: function() {
            eventEmitter.on('amqp-event-received', data => {
                storeToRedis(client, data);
            });
        }
    };
};
