const redis = require('redis');
const eventEmitter = require("./events");

const subscriptions = ["__keyevent@0*__:expired", "__keyevent@0*__:evicted"];

function manageSubscriptions(client, command, subscription) {
    client[command](subscription);
}

function MessageHandler() {
    function handle(channel, message, key) {
        eventEmitter.emit('expired-event-received', key);
    }

    return {
        handle: handle
    };
}

module.exports = function(config) {
    console.log(`Connecting to redis on ${config.host}:${config.port}`);

    const messageHandler = new MessageHandler();
    const subscriberClient = redis.createClient(config.port, config.host);

    return {
        start: () => {
            subscriptions.forEach(manageSubscriptions.bind(undefined, subscriberClient, 'psubscribe'));

            subscriberClient.on("pmessage", messageHandler.handle);
        },
        stop: () => new Promise(resolve => {
            subscriptions.forEach(manageSubscriptions.bind(undefined, subscriberClient, 'punsubscribe'));

            subscriberClient.quit();

            resolve();
        })
    };
};
