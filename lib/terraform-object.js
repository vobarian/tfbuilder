'use strict';

const proxyHandler = {

};

module.exports = function() {
    return new Proxy({}, proxyHandler);
};