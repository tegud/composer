module.exports = function(redisStore) {
    return {
        start: () => new Promise(resolve => {
            resolve();
        }),
        stop: () => new Promise(resolve => resolve()),
        getSessionForId: key => redisStore.getList(key)
            .then(result => {
                redisStore.deleteKey(key);
                return Promise.resolve(result);
            })
    };
};
