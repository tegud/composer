const RedisStore = require('../redis-store');

module.exports = function(config) {
    let redisStore;

    function scanNext(cursor) {
        redisStore.scan(cursor,
            'COUNT', '10000', (err, res) => {
                if (err) {
                    console.log(`SCAN ERROR: ${err.message}`);
                    scheduleScan();
                }

                cursor = res[0];

                if (cursor === '0') {
                    return scheduleScan();
                }

                scanNext(cursor);
            })
    }

    function scheduleScan() {
        const scanInterval = config.scanInterval || 60000;
        console.log(`Scheduling scan for ${scanInterval}ms`);
        setTimeout(() => {
            console.log(`Scanning keys to force expiry`);
            scanNext(0);
        }, scanInterval);
    }

    return {
        start: () => {
            console.log('Starting composer scanner module.');

            redisStore = new RedisStore(config.redis);

            return Promise.all([redisStore.start()])
                .then(() => {
                    scheduleScan();
                });
        }
    };
};
