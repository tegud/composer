const redis = require('redis');

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
        start: () => new Promise(resolve => resolve()),
        store: data => storeToRedis(client, data),
        getList: key => new Promise((resolve, reject) => {
            client.lrange(key, 0, -1, (err, logs) => {
                if(err) {
                    return reject(err);
                }

                resolve(logs);
            });
        })
    };
};
