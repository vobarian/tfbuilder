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

    merge(from) {
        mergeSection(from.resource, this.resource);
        mergeSection(from.data, this.data);
        Object.assign(this.module, from.module);
        Object.assign(this.variable, from.variable);
        Object.assign(this.locals, from.locals);
        Object.assign(this.output, from.output);
        this.provider.push(...from.provider);
    }
}

function mergeSection(from, to) {
    for (const className in from) {
        Object.assign(to[className], from[className]);
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