'use strict';

const terraformClass = require('./terraform-class');
const proxyGetDefault = require('./proxy-get-default');

module.exports = function terraformSection(sectionName) {
    const sectionPrefix = sectionName ? (sectionName + '.') : '';
    const proxyHandler = {
        get: proxyGetDefault((target, property) => terraformClass(sectionPrefix + property)),
        set() {
            throw new TypeError('Cannot set properties on TerraformSection');
        }
    };
    const base = Object.create(null);
    return new Proxy(base, proxyHandler);
};