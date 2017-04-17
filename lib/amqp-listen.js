const amqp = require('amqp');
const eventEmitter = require("./events");

module.exports = function AmqpListener(config, eventName) {
    let connected;

    function connectionReady(resolve, reject, connection) {
        if (connected) {
            return;
        }

        connected = true;
        console.log('Connected to Rabbit MQ');

        connection.queue(config.queue, {
            autoDelete: false
        }, queueReady.bind(undefined, resolve));
    }

    function queueReady(resolve, queue) {
        console.log(`Connected to Exchange: ${config.exchange}, Queue: ${config.queue}`);
        queue.bind(config.exchange, config.routing);

        queue.subscribe({
            ack: true
        }, messageReceived.bind(undefined, queue));

        resolve();
    }

    function messageReceived(queue, msg) {
        eventEmitter.emit(`amqp-event-received.${eventName}`, JSON.parse(msg.data));
        queue.shift();
    }

    return {
        start: () => new Promise((resolve, reject) => {
            const connection = amqp.createConnection({
                host: config.host
            });

            connection.on('ready', connectionReady.bind(undefined, resolve, reject, connection));
        })
    };
};
