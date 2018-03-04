'use strict';

const terraformSection = require('./terraform-section');
const terraformClass = require('./terraform-class');

class Configuration {
    constructor() {
        this.resource = terraformSection();
        this.data = terraformSection('data');
        this.module = terraformClass('module');
        this.variable = {};
        this.locals = {};
        this.output = {};
        this.provider = [];
        Object.defineProperty(this.provider, 'add', {value: addProvider});
        Object.defineProperty(this, 'json', {
            get() { return JSON.stringify(this); }
        });
    }
}

function addProvider(providerName, providerConfiguration) {
    const providerBlock = {};
    providerBlock[providerName] = providerConfiguration;
    this.push(providerBlock);
}

function configuration() {
    return new Configuration();
}

module.exports = configuration;