'use strict';

const terraformObject = require('./terraform-object');
const proxyGetDefault = require('./proxy-get-default');

const proxyHandler = {
    get: proxyGetDefault((target, property) => terraformObject(target._namespace + '.' + property)),
    set(target, property, value, receiver) {
        delete receiver[property];
        Object.assign(receiver[property], value);
        return true;
    }
};

module.exports = function terraformClass(namespace) {
    const base = Object.create(null);
    Object.defineProperty(base, '_namespace', {value: namespace});
    return new Proxy(base, proxyHandler);
};