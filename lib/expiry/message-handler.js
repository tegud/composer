const moment = require('moment');
const events = require('../events');

function processExpiredKey(expiredKey) {
    const underscoreLocation = expiredKey.indexOf('_');
    const prefix = expiredKey.substring(0, underscoreLocation);
    const id = expiredKey.substring(expiredKey.indexOf('_') + 1);

    events.emit('expired-event-processed', {
        expiredEventTimeStamp: moment().utc().format(),
        aggregatorType: prefix,
        expiredKey: id,
        store: {
            name: 'redis',
            eventListKey: `${prefix}_list_${id}`
        }
    });
}

module.exports = function() {
    return {
        start: () => new Promise(resolve => {
            events.on('expired-event-received', processExpiredKey);
            resolve();
        }),
        stop: () => {}
    };
};
