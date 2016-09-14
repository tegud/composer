const should = require('should');

const moment = require('moment');

const proxyquire = require('proxyquire');
const fakeRedis = require('./lib/fake-redis');
const fakeAmqp = require('./lib/fake-amqp');

let fakeCurrentTime;

const ComposerServer = proxyquire('../lib/server', {
    './redis': proxyquire('../lib/redis', {
        'redis': fakeRedis
    }),
    './message-handler': proxyquire('../lib/message-handler', {
        'moment': function(...args) {
            if(!args.length && fakeCurrentTime) {
                return moment(fakeCurrentTime);
            }

            return moment();
        }
    })
});

describe('expiry mode', () => {
    beforeEach(() => {
        fakeCurrentTime = undefined;
    });

    it('listens to redis keyspace events and emits rabbit mq event when received', () => {
        fakeCurrentTime = '2016-09-14T22:30:00Z';
        
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
