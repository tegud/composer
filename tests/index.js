const should = require('should');

const moment = require('moment');

const proxyquire = require('proxyquire');
const fakeRedis = require('./lib/fake-redis');
const fakeAmqp = require('./lib/fake-amqp');

let fakeCurrentTime;
let config;

function setConfig(newConfig) {
    return new Promise(resolve => resolve(config = JSON.stringify(newConfig)));
}

describe('composer', () => {
    beforeEach(() => {
        fakeCurrentTime = undefined;
        config = undefined;
    });

    describe('expiry handler', () => {
        const ComposerServer = proxyquire('../lib/server', {
            './config': proxyquire('../lib/config', {
                'fs': {
                    readFile: (file, enc, callback) => {
                        callback(undefined, config);
                    }
                }
            }),
            './expiry': proxyquire('../lib/expiry', {
                '../redis-keyspace-event-listener': proxyquire('../lib/redis-keyspace-event-listener', {
                    'redis': fakeRedis
                }),
                './message-handler': proxyquire('../lib/expiry/message-handler', {
                    'moment': function(...args) {
                        if(!args.length && fakeCurrentTime) {
                            return moment(fakeCurrentTime);
                        }

                        return moment();
                    }
                })
            }),
        });

        it('listens to redis keyspace events and emits rabbit mq event when received', () => {
            fakeCurrentTime = '2016-09-14T22:30:00Z';
            setConfig({
                redis: {},
                amqp: {
                    host: '127.0.0.1',
                    exchange: 'composer-expired'
                }
            });

            const composerServer = new ComposerServer('expiry');
            const amqpRecievedPromise = new Promise(resolve => {
                fakeAmqp.mock({ host: '127.0.0.1', port: 5672 }).exchange('composer-expired', (routingKey, message) => {
                    resolve(JSON.parse(message.data));
                });
            });

            composerServer.start().then(() => fakeRedis.sendKeyExpiry('key_1234'));

            return amqpRecievedPromise.should.eventually.be.eql({
                expiredEventTimeStamp: '2016-09-14T22:30:00Z',
                aggregatorType: 'key',
                expiredKey: "1234",
                store: {
                    name: 'redis',
                    eventListKey: 'key_list_1234'
                }
            });
        });
    });

    describe('store handler', () => {
        const ComposerServer = proxyquire('../lib/server', {
            './store': proxyquire('../lib/store', {
                '../redis-store': proxyquire('../lib/redis-store', {
                    'redis': fakeRedis
                })
            })
        });

        it('listens to rabbit mq events and stores in redis', () => {
            setConfig({
                redis: {},
                amqp: {
                    host: '127.0.0.1',
                    exchange: 'composer-in'
                }
            });

            const composerServer = new ComposerServer('store');

            const inputExchange = fakeAmqp.mock({ host: '127.0.0.1', port: 5672 }).exchange('composer-in');

            composerServer.start().then(() => inputExchange.publish('', JSON.stringify({ id: '12345' })));

            return new Promise(resolve => {
                fakeRedis.on('list-push', (key, data) => {
                    resolve(data);
                });
            }).should.eventually.eql('{"id":"12345"}');
        });
    });
});
