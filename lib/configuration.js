'use strict';

const terraformSection = require('./terraform-section');
const terraformClass = require('./terraform-class');
const fs = require('fs');
const {promisify} = require('util');

const writeFile = promisify(fs.writeFile);

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
            get() { return JSON.stringify(this, jsonFilter, "\t"); }
        });
    }

    merge(from) {
        mergeSection(this.resource, from.resource);
        mergeSection(this.data, from.data);
        Object.assign(this.module, from.module);
        Object.assign(this.variable, from.variable);
        Object.assign(this.locals, from.locals);
        Object.assign(this.output, from.output);
        this.provider.push(...from.provider);
    }

    writeTo(fileName) {
        return writeFile(fileName, this.json);
    }
}

function mergeSection(to, from) {
    for (const className in from) {
        Object.assign(to[className], from[className]);
    }
}

function addProvider(providerName, providerConfiguration) {
    const providerBlock = {};
    providerBlock[providerName] = providerConfiguration;
    this.push(providerBlock);
}

function isEmptyObject(x) {
    return typeof x === 'object' && Object.keys(x).length === 0;
}

function jsonFilter(key, value) {
    if (value !== null && !isEmptyObject(value)) {
        return value;
    }
}

module.exports = () => new Configuration();