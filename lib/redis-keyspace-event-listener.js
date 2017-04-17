const redis = require('redis');
const eventEmitter = require("./events");

const subscriptions = ["__keyevent@0*__:expired", "__keyevent@0*__:evicted"];

function manageSubscriptions(client, command, subscription) {
    client[command](subscription);
}

function MessageHandler() {
    return {
        handle: (channel, message, key) => {
            eventEmitter.emit('expired-event-received', key);
        }
    };
}

module.exports = function(config) {
    console.log(`Connecting to redis on ${config.host}:${config.port}`);

    const messageHandler = new MessageHandler();
    const subscriberClient = redis.createClient(config.port, config.host);

    return {
        start: () => {
            subscriptions.forEach(event => subscriberClient.psubscribe(event));

            subscriberClient.on("pmessage", (...args) => {
                messageHandler.handle(...args);
            });

            console.log('Subscribed');
        },
        stop: () => new Promise(resolve => {
            subscriptions.forEach(manageSubscriptions.bind(undefined, subscriberClient, 'punsubscribe'));

            subscriberClient.quit();

            resolve();
        })
    };
};
