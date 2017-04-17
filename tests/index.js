const should = require('should');

const _ = require('lodash');
const moment = require('moment');

const proxyquire = require('proxyquire');
const fakeRedis = require('./lib/fake-redis');
const fakeAmqp = require('./lib/fake-amqp');

let fakeCurrentTime;
let config;

function setConfig(newConfig) {
    return new Promise(resolve => resolve(config = JSON.stringify(newConfig)));
}

function TestProcessor(processorConfig) {
    const config = _.defaults({}, processorConfig, {
        timeout: 60000
    });

    return {
        config: () => config,
        matches: () => true,
        createKey: event => event.id,
        aggregate: events => {
            return Promise.resolve({
                type: 'aggregatedObject',
                text: events.events.map(event => event.text).join(',')
            });
        }
    };
}

describe('composer', () => {
    let composerServer;

    beforeEach(() => {
        fakeCurrentTime = undefined;
        config = undefined;
    });

    afterEach(() => composerServer.stop());

    describe('expiry handler', () => {
        const ComposerServer = proxyquire('../lib', {
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
                expiryQueue: {
                    host: '127.0.0.1',
                    exchange: 'composer-expired'
                }
            });

            composerServer = new ComposerServer('expiry');
            const amqpRecievedPromise = new Promise(resolve => {
                fakeAmqp.mock({ host: '127.0.0.1', port: 5672 }).exchange('composer-expired', (routingKey, message) => {
                    resolve(JSON.parse(message.data));
                });
            });

            composerServer.start()
                .then(() => fakeRedis.sendKeyExpiry('test_1234'));

            return amqpRecievedPromise.should.eventually.be.eql({
                expiredEventTimeStamp: '2016-09-14T22:30:00Z',
                aggregatorType: 'test',
                expiredKey: "1234",
                store: {
                    name: 'redis',
                    eventListKey: 'test_list_1234'
                }
            });
        });
    });

    describe('store handler', () => {
        const ComposerServer = proxyquire('../lib', {
            './store': proxyquire('../lib/store', {
                '../redis-store': proxyquire('../lib/redis-store', {
                    'redis': fakeRedis
                })
            })
        });

        describe('listens to rabbit mq events and stores in redis', () => {
            describe('list entry', () => {
                it('sets key', () => {
                    setConfig({
                        redis: {},
                        inputQueue: {
                            host: '127.0.0.1',
                            exchange: 'composer-in'
                        },
                        processors: [
                            { name: 'test', type: "test" }
                        ]
                    });

                    composerServer = new ComposerServer('store');

                    const inputExchange = fakeAmqp.mock({ host: '127.0.0.1', port: 5672 }).exchange('composer-in');

                    composerServer.registerProcessor('test', TestProcessor)
                    .then(() => composerServer.start())
                    .then(() => {
                        inputExchange.publish('', JSON.stringify({ id: '12345' }));
                    });

                    return new Promise(resolve => {
                        fakeRedis.on('list-push', key => resolve(key));
                    }).should.eventually.eql('test_list_12345');
                });

                it('it stores data', () => {
                    setConfig({
                        redis: {},
                        inputQueue: {
                            host: '127.0.0.1',
                            exchange: 'composer-in'
                        },
                        processors: [
                            { name: 'test', type: "test" }
                        ]
                    });

                    composerServer = new ComposerServer('store');

                    const inputExchange = fakeAmqp.mock({ host: '127.0.0.1', port: 5672 }).exchange('composer-in');

                    composerServer.registerProcessor('test', TestProcessor)
                        .then(() => composerServer.start())
                        .then(() => {
                            inputExchange.publish('', JSON.stringify({ id: '12345' }));
                        });

                    return new Promise(resolve => {
                        fakeRedis.on('list-push', (key, data) => resolve(data));
                    }).should.eventually.eql('{"id":"12345"}');
                });

                it('sets key expiry timeout to failsafe: 6hrs', () => {
                    setConfig({
                        redis: {},
                        inputQueue: {
                            host: '127.0.0.1',
                            exchange: 'composer-in'
                        },
                        processors: [
                            { name: 'test', type: "test" }
                        ]
                    });

                    composerServer = new ComposerServer('store');

                    const inputExchange = fakeAmqp.mock({ host: '127.0.0.1', port: 5672 }).exchange('composer-in');

                    composerServer.registerProcessor('test', TestProcessor)
                    .then(() => composerServer.start())
                    .then(() => {
                        inputExchange.publish('', JSON.stringify({ id: '12345' }));
                    });

                    return new Promise(resolve => {
                        fakeRedis.on('expiry-set', (key, timeout) => {
                            if(key === 'test_list_12345') {
                                return resolve(timeout);
                            }
                        });
                    }).should.eventually.eql(21600000);
                });
            });

            describe('expiry entry', () => {
                it('sets key', () => {
                    setConfig({
                        redis: {},
                        inputQueue: {
                            host: '127.0.0.1',
                            exchange: 'composer-in'
                        },
                        processors: [
                            { name: 'test', type: "test" }
                        ]
                    });

                    composerServer = new ComposerServer('store');

                    const inputExchange = fakeAmqp.mock({ host: '127.0.0.1', port: 5672 }).exchange('composer-in');

                    composerServer.registerProcessor('test', TestProcessor)
                    .then(() => composerServer.start())
                    .then(() => {
                        inputExchange.publish('', JSON.stringify({ id: '12345' }));
                    });

                    return new Promise(resolve => {
                        fakeRedis.on('key-set', key => resolve(key));
                    }).should.eventually.eql('test_12345');
                });

                describe('expiry', () => {
                    it('sets key expiry timeout to processor default', () => {
                        setConfig({
                            redis: {},
                            inputQueue: {
                                host: '127.0.0.1',
                                exchange: 'composer-in'
                            },
                            processors: [
                                { name: 'test', type: "test" }
                            ]
                        });

                        composerServer = new ComposerServer('store');

                        const inputExchange = fakeAmqp.mock({ host: '127.0.0.1', port: 5672 }).exchange('composer-in');

                        composerServer.registerProcessor('test', TestProcessor)
                        .then(() => composerServer.start())
                        .then(() => {
                            inputExchange.publish('', JSON.stringify({ id: '12345' }));
                        });

                        return new Promise(resolve => {
                            fakeRedis.on('expiry-set', (key, timeout) => {
                                if(key === 'test_12345') {
                                    return resolve(timeout);
                                }
                            });
                        }).should.eventually.eql(60000);
                    });

                    it('sets key expiry timeout to configured value', () => {
                        setConfig({
                            redis: {},
                            inputQueue: {
                                host: '127.0.0.1',
                                exchange: 'composer-in'
                            },
                            processors: [
                                { name: 'test', type: "test", timeout: 120000 }
                            ]
                        });

                        composerServer = new ComposerServer('store');

                        const inputExchange = fakeAmqp.mock({ host: '127.0.0.1', port: 5672 }).exchange('composer-in');

                        composerServer.registerProcessor('test', TestProcessor)
                        .then(() => composerServer.start())
                        .then(() => {
                            inputExchange.publish('', JSON.stringify({ id: '12345' }));
                        });

                        return new Promise(resolve => {
                            fakeRedis.on('expiry-set', (key, timeout) => {
                                if(key === 'test_12345') {
                                    return resolve(timeout);
                                }
                            });
                        }).should.eventually.eql(120000);
                    });
                })
            });
        });
    });

    describe('builder handler', () => {
        const ComposerServer = proxyquire('../lib', {
            './builder': proxyquire('../lib/builder', {
                '../redis-store': proxyquire('../lib/redis-store', {
                    'redis': fakeRedis
                })
            })
        });

        it('listens to rabbit mq events, retrieves from redis and publishes aggregate object onto rabbit mq', () => {
            setConfig({
                redis: {},
                expiryQueue: {
                    host: '127.0.0.1',
                    exchange: 'composer-expired'
                },
                completedQueue: {
                    host: '127.0.0.1',
                    exchange: 'composer-done'
                },
                processors: [
                    { name: 'test', type: "test" }
                ]
            });

            composerServer = new ComposerServer('builder');

            const inputExchange = fakeAmqp.mock({ host: '127.0.0.1', port: 5672 }).exchange('composer-expired');

            const amqpRecievedPromise = new Promise(resolve => {
                fakeAmqp.mock({ host: '127.0.0.1', port: 5672 }).exchange('composer-done', (routingKey, message) => {
                    resolve(JSON.parse(message.data));
                });
            });

            fakeRedis.setKeyData('key_list_12345', [JSON.stringify({ id: '12345', text: "a" }), JSON.stringify({ id: '12345', text: "b" })])

            composerServer.registerProcessor('test', TestProcessor)
                .then(() => composerServer.start())
                .then(() => inputExchange.publish('', JSON.stringify({
                    expiredEventTimeStamp: '2016-09-14T22:30:00Z',
                    aggregatorType: 'test',
                    expiredKey: "12345",
                    store: {
                        name: 'redis',
                        eventListKey: 'key_list_12345'
                    }
                })));

            return amqpRecievedPromise.should.eventually.be.eql({
                type: 'aggregatedObject',
                text: "a,b"
            });
        });
    });
});
