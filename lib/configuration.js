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
            get() { return JSON.stringify(this); }
        });
    }

    writeTo(fileName) {
        return writeFile(fileName, this.json);
    }
}

function addProvider(providerName, providerConfiguration) {
    const providerBlock = {};
    providerBlock[providerName] = providerConfiguration;
    this.push(providerBlock);
}

module.exports = () => new Configuration();