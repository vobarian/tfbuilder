'use strict';

const terraformObject = require('./terraform-object');

describe('terraformObject', function() {
    it('allows properties to be set and retrieved', function() {
        const tfo = terraformObject('xyz');
        tfo.anything = 123;
        expect(tfo.anything).toBe(123);
    });

    it('builds interpolation string when getting unknown property', function() {
        const tfo = terraformObject('some_resource.example');
        expect(tfo.attr).toBe('${some_resource.example.attr}');
    });

    it('provides interpolation when accessed from user defined getter', function() {
        const tfo = terraformObject('abc');
        Object.defineProperty(tfo, 'hi', {
            get() {
                return this.hello;
            }
        });
        expect(tfo.hi).toBe('${abc.hello}');
    });

    it('exposes its name as $name', function() {
        const tfo = terraformObject('myname');
        expect(tfo.$name).toBe('myname');
    });

    it('does not allow $name change', function() {
        const tfo = terraformObject('myname');
        expect(_=> {tfo.$name = 'other'}).toThrowError(TypeError);
    });

    it('does not allow $name deleted', function() {
        const tfo = terraformObject('myname');
        expect(_=> {delete tfo.$name}).toThrowError(TypeError);
    });

    it('does not include $name when converted to JSON', function() {
        const tfo = terraformObject('myname');
        tfo.abc = 123;
        const throughJson = JSON.parse(JSON.stringify(tfo));
        expect(throughJson).toEqual({abc: 123});
    }); 

    describe('$output', function() {
        it('returns interpolation string', function() {
            const tfo = terraformObject('abc');
            const interpolationString = tfo.$output('ok');
            expect(interpolationString).toBe('${abc.ok}');
        });
    });
});