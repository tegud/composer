const redis = require('redis');

function storeToRedis(client, data) {
    if(!data.expiredKey || !data.key) {
        console.log(`Either key or data.key is undefined. ListKey: "${data.eventListKey}", Key: "${data.expiredKey}", data.key: "${JSON.stringify(data.key)}"`);
    }
    
    client.lpush(data.eventListKey, JSON.stringify(data.event));
    client.expire(data.eventListKey, 21600000);

    client.set(data.expiredKey, JSON.stringify(data.key));
    client.pexpire(data.expiredKey, data.expiryTimeout * 1000);
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
        }),
        deleteKey: key => client.del(key),
        scan: (...args) => client.scan(...args)
    };
};
