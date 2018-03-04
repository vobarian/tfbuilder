'use strict';

const terraformClass = require('./terraform-class');
const proxyGetDefault = require('./proxy-get-default');

const proxyHandler = {
    get: proxyGetDefault((target, property) => terraformClass(target._sectionPrefix + property)),
    set() {
        throw new TypeError('Cannot set properties on TerraformSection');
    }
};

module.exports = function terraformSection(sectionName) {
    const base = Object.create(null);
    const sectionPrefix = sectionName ? (sectionName + '.') : '';
    Object.defineProperty(base, '_sectionPrefix', {value: sectionPrefix});
    return new Proxy(base, proxyHandler);
};