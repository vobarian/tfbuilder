'use strict';

const proxyHandler = {
    get(target, property, receiver) {
        return receiver.$output(property);
    }
};

const plainObject = Object.create(null);
const proxy = new Proxy(plainObject, proxyHandler);

const terraformObjectPrototype = Object.create(proxy);
terraformObjectPrototype.$output = function(property) {
    return '${' + this.$name + '.' + property + '}';
};

module.exports = function(terraformName, objectToEnhance) {
    Object.defineProperty(objectToEnhance, '$name', {value: terraformName});
    Object.setPrototypeOf(objectToEnhance, terraformObjectPrototype);
    return objectToEnhance;
};