const dgram = require('dgram');

let config;

function send(message) {
    console.log(config);
    if(!config.statsd) {
        console.log('No statsd config')
        return;
    }

    const udpClient = dgram.createSocket("udp4");

    return udpClient.send(new Buffer(message), 0, message.length, config.statsd.port, config.statsd.host);
};

module.exports = {
    configure: newConfig => {
        console.log(newConfig);
        config = newConfig
    },
    sendTimer: (metric, value) => send(`${metric}:${value}|ms`)
};
