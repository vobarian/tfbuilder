'use strict';

const terraformClass = require('./terraform-class');

describe('terraformClass', function() {
    it('produces new TerraformObject when getting unknown property', function() {
        const tc = terraformClass('cls');
        const tObj = tc.anything;
        tObj.abc = 123;
        expect(tObj.abc).toBe(123);
    });

    it('forms name of TerraformObject by concatenating own namespace with property', function() {
        const tc = terraformClass('cls');
        const tObj = tc.anything;
        expect(tObj.$name).toBe('cls.anything');
        expect(tObj.abc).toBe('${cls.anything.abc}');
    });

    it('returns same object for same property name each time', function() {
        const tc = terraformClass('qwe');
        const tObj = tc.x;
        expect(tc.x).toBe(tObj);
    });

    it('converts object to TerraformObject when set as property', function() {
        const tc = terraformClass('a');
        tc.b = {
            things: 1,
            stuff: 'x'
        };
        expect(tc.b.$name).toBe('a.b');
        expect(tc.b.things).toBe(1);
        expect(tc.b.stuff).toBe('x');
    });

    it('creates a new TerraformObject if a property is set again', function() {
        const tc = terraformClass('a');
        tc.b = { x: 1 };
        expect(tc.b.x).toBe(1);
        tc.b = { y: 'delicious' };
        expect(tc.b.x).toBe('${a.b.x}');
        expect(tc.b.y).toBe('delicious');
    });

    it('creates an independent TerraformObject if assigned from another TerraformObject', function() {
        const a = terraformClass('a');
        a.b = { x: 1 };
        a.c = a.b;
        expect(a.b.x).toBe(1);
        expect(a.c.x).toBe(1);
        expect(a.b.y).toBe('${a.b.y}');
        expect(a.c.y).toBe('${a.c.y}');
        a.c.z = 2;
        expect(a.c.z).toBe(2);
        expect(a.b.z).toBe('${a.b.z}');
    });

    it('includes only user defined properties when converted to JSON', function() {
        const cls = terraformClass('cls');
        expect(JSON.stringify(cls)).toBe('{}');
    });

    it('treats Object prototype properties like any other', function() {
        const cls = terraformClass('cls');
        expect(cls.toString.x).toBe('${cls.toString.x}');
    });
});