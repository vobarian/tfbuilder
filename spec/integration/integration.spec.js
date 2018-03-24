const {Configuration} = require('../../lib/index');
const {execFileSync} = require('child_process');
const {writeFileSync} = require('fs');
const {createDirectories, deleteFileIfExists, readText} = require('./file-util');

describe('Terraform', function() {
    const tempDir = 'tmp/integration';
    let config;

    beforeAll(function() {
        createDirectories(tempDir + '/submodule');
    });

    beforeEach(function() {
        config = Configuration();

        [   'terraform.tfstate',
            'test.tf.json',
            'output.txt',
            'submodule/main.tf.json',
            'input.txt'
        ].forEach(f => deleteFileIfExists(tempDir + '/' + f));
    });

    function executeTerraform() {
        writeFileSync(tempDir + '/test.tf.json', config.json);
        execFileSync('terraform', ['init', '-no-color'], {cwd: tempDir});
        return execFileSync('terraform', ['apply', '-auto-approve', '-no-color'], {cwd: tempDir, encoding: 'utf8'});
    }

    it('creates resource with interpolation from data source', function() {
        writeFileSync(tempDir + '/input.txt', 'a-ha');
        config.data.local_file.stuff = {
            filename: 'input.txt'
        };
        config.resource.local_file.abc = {
            filename: 'output.txt',
            content: config.data.local_file.stuff.content + ' ok'
        };
        
        executeTerraform();
        
        expect(readText(tempDir + '/output.txt')).toBe('a-ha ok');
    });

    it('uses module with input, output, and local variables', function() {
        const moduleConfig = Configuration();
        moduleConfig.variable.some_input = {
            type: 'string',
            description: 'Data to extraify'
        };
        moduleConfig.locals.intermediate = "${var.some_input}-extra"
        moduleConfig.output.some_output = {
            value: "${local.intermediate}"
        };
        writeFileSync(tempDir + '/submodule/main.tf.json', moduleConfig.json);

        config.module.my_module = {
            source: 'submodule',
            some_input: 'abc'
        };
        config.resource.local_file.x = {
            filename: 'output.txt',
            content: config.module.my_module.some_output
        };

        executeTerraform();

        expect(readText(tempDir + '/output.txt')).toBe('abc-extra');
    });

    it('interpolates from resource attributes', function() {
        config.resource.random_integer.rand = {
            min: 10000,
            max: 99999
        };
        config.output.random_number = {
            value: config.resource.random_integer.rand.result
        };

        const terraformOutput = executeTerraform();

        expect(terraformOutput).toMatch(/^random_number = [0-9]{5}$/m);
    });

    it('configures providers', function() {
        config.provider.add('random', {
            alias: 'dice'
        });
        config.resource.random_integer.rand = {
            provider: 'random.dice',
            min: 1,
            max: 6
        };
        config.output.random_number = {
            value: config.resource.random_integer.rand.result
        };

        const terraformOutput = executeTerraform();

        expect(terraformOutput).toMatch(/^random_number = [1-6]$/m);
    });
});