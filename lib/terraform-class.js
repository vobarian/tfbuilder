'use strict';

const terraformObject = require('./terraform-object');
const proxyGetDefault = require('./proxy-get-default');

module.exports = function terraformClass(namespace) {
    const namespacePrefix = namespace + '.';
    const proxyHandler = {
        get: proxyGetDefault((target, property) => terraformObject(namespacePrefix + property, {})),
        set(target, property, value, receiver) {
            target[property] = terraformObject(namespacePrefix + property, value);
            return true;
        }
    };
    const base = Object.create(null);
    return new Proxy(base, proxyHandler);
};