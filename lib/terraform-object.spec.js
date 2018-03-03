'use strict';

const terraformObject = require('./terraform-object');

describe('TerraformObject', function() {
    it('allows properties to be set and retrieved', function() {
        const tfo = terraformObject('xyz');
        tfo.anything = 123;
        expect(tfo.anything).toBe(123);
    });

    it('builds interpolation string when getting unknown property', function() {
        const tfo = terraformObject('some_resource.example');
        expect(tfo.attr).toBe('${some_resource.example.attr}');
    });
});