const should = require('should');
const proxyquire = require('proxyquire');

let config;

function setConfig(newConfig) {
    return new Promise(resolve => resolve(config = JSON.stringify(newConfig)));
}

describe('multiple modes', () => {
    let composerServer;

    beforeEach(() => {
        startsCalled = [];
        config = undefined;
    });

    afterEach(() => composerServer.stop());

    function startCalled(mode) {
        startsCalled.push(mode);
    }

    const ComposerServer = proxyquire('../lib', {
        './config': proxyquire('../lib/config', {
            'fs': {
                readFile: (file, enc, callback) => {
                    callback(undefined, config);
                }
            }
        }),
        './processors': { start: () => Promise.resolve() },
        './store': function() { return { start: () => startCalled('store') } },
        './expiry': function() { return { start: () => startCalled('expiry') } },
        './builder': function() { return { start: () => startCalled('builder') } }
    });

    it('starts all specified modes', () => setConfig({ processors: [] })
        .then(() => (composerServer = new ComposerServer('store', 'expiry', 'builder')).start())
        .then(() => Promise.resolve(startsCalled))
        .should.eventually.be.eql(['store', 'expiry', 'builder']));
});
