'use strict';

const proxyHandler = {
    get(target, property, receiver) {
        if (property in target) {
            return Reflect.get(target, property, receiver);
        } else {
            return target.$output(property);
        }
    }
};

class TerraformObject {
    constructor(name) {
        Object.defineProperty(this, '$name', { value: name });
    }

    $output(property) {
        return '${' + this.$name + '.' + property + '}';
    }
}

module.exports = function(name) {
    return new Proxy(new TerraformObject(name), proxyHandler);
};