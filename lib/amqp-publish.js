const amqp = require('amqp');
const eventEmitter = require("./events");

function publishEvent(exchange, routingKey, message) {
    exchange.publish(routingKey, JSON.stringify(message));
}

module.exports = function(config) {
    let connected;
    let publishEventCallback;

    function connectionReady(resolve, reject, connection) {
        if(connected) {
            return;
        }

        connected = true;
        console.log(`Connected to Rabbit MQ, connecting to exchange: ${config.exchange}`);

        connection.exchange(config.exchange, { type: 'fanout', durable: true, autoDelete: false }, exchangeReady.bind(undefined, resolve));
    }

    function exchangeReady(resolve, exchange) {
        console.log('Connected to Exchange');

        publishEventCallback = publishEvent.bind(undefined, exchange, config.routing);
        eventEmitter.on('event-processing-complete', publishEventCallback);

        resolve();
    }

    return {
        start: () => new Promise((resolve, reject) => {
            console.log(`Creating AMQP publisher connection to: ${config.host}`);

            const connection = amqp.createConnection({ host: config.host });

            connection.on('error', err => {
                console.log(`'Could not connect to: ${config.host}, error: ${err}`);

                return reject(new Error('AMQP publisher could not connect to queue.'));
            });

            connection.on('ready', connectionReady.bind(undefined, resolve, reject, connection));
        }),
        stop: () => new Promise(resolve => {
            eventEmitter.removeListener('event-processing-complete', publishEventCallback);

            resolve();
        })
    };
};
