let pmessageHandler;
let subscribedEvents = {};
let internalSubscribedEvents = {};
let data = {};

function timeoutExpiry(key) {
	if(subscribedEvents['__keyevent@0*__:expired']) {
		pmessageHandler('__keyevent@0*__:expired', '__keyevent@0__:expired', key);
	}
}

function raiseInternalEvent(event, key, value) {
	if(!internalSubscribedEvents[event]) {
		return;
	}

	internalSubscribedEvents[event].forEach(handler => {
		handler(key, value);
	});
}

module.exports = {
	createClient: function() {
		let store = {};
		let expiries = {};

		console.log('Redis connection intercepted.');

		return {
			psubscribe: event => {
				subscribedEvents[event] = true;
			},
			punsubscribe: event => {
				subscribedEvents[event] = false;
			},
			on: (event, handler) => {
				if(event === 'pmessage') {
					pmessageHandler = handler;
				}

				if(event === 'ready') {
					handler();
				}
			},
			quit: () => {
				pmessageHandler = undefined;
			},
			set: (key, value) => {
				store[key] = value;
				raiseInternalEvent('key-set', key, value);
			},
			expire: (key, timeout) => {
				if(expiries[key]) {
					clearTimeout(expiries[key]);
				}

				expiries[key] = setTimeout(timeoutExpiry.bind(undefined, key), timeout)
				raiseInternalEvent('expiry-set', key, timeout);
			},
			pexpire: (key, timeout) => {
				timeout = timeout / 1000;
				if(expiries[key]) {
					clearTimeout(expiries[key]);
				}

				expiries[key] = setTimeout(timeoutExpiry.bind(undefined, key), timeout)
				raiseInternalEvent('expiry-set', key, timeout);
			},
			lrange: (key, start, end, callback) => {
				if(!start && end === -1) {
					return callback(null, data[key]);
				}

				callback();
			},
			lpush: (key, value) => {
				if(!store[key]) {
					try {
						store[key] = [value];
						raiseInternalEvent('list-push', key, value);
						return;
					}
					catch (e) {
						console.log(e);
						return;
					}
				}

				if(!store[key].push) {
					console.logError('Cannot append to list on non list keys');
					throw 'Cannot append to list on non list keys';
				}

				store[key].push(value);
				raiseInternalEvent('list-push', key, value);
			},
			del: key => {

			}
		};
	},
	sendKeyExpiry: key => new Promise(resolve => {
		timeoutExpiry(key);
		resolve();
	}),
	on: (event, handler) => {
		if(internalSubscribedEvents[event]) {
			internalSubscribedEvents[event].push(handler);
			return;
		}

		internalSubscribedEvents[event] = [handler];
	},
	setKeyData: (key, keyData) => {
		data[key] = keyData;
	},
	clearData: () => {
		data = {};
		subscribedEvents = {};
		internalSubscribedEvents = {};
	}
};
