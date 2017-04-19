const dgram = require('dgram');

let config;

function send(message) {
    const udpClient = dgram.createSocket("udp4");

    return udpClient.send(new Buffer(message), 0, message.length, config.statsd.port, config.statsd.host);
}

module.exports = {
    configure: newConfig => {
        config = newConfig
    },
    sendTimer: (metric, value) => {
        if(!config.statsd) {
            return;
        }

        send(`stats.${config.statsd.metricHost}.composer.${metric}:${value}|ms`);
    }
};
