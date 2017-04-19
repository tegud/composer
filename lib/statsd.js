const dgram = require('dgram');

let config;

function send(message) {
    if(!config.statsd) {
        return;
    }

    const udpClient = dgram.createSocket("udp4");

    return udpClient.send(new Buffer(message), 0, message.length, config.statsd.port, config.statsd.host);
};

module.exports = {
    configure: newConfig => {
        config = newConfig
    },
    sendTimer: (metric, value) => send(`stats.${config.statsd.metricHost}.composer.${metric}:${value}|ms`)
};
