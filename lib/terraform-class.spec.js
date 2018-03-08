'use strict';

const terraformClass = require('./terraform-class');

describe('terraformClass', function() {
    describe('property getter', function() {
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

        it('treats Object.prototype properties like any other', function() {
            const cls = terraformClass('cls');
            expect(cls.toString.x).toBe('${cls.toString.x}');
        });
    });

    describe('property setter', function() {
        it('converts assigned value to TerraformObject', function() {
            const tc = terraformClass('a');
            tc.b = {
                things: 1,
                stuff: 'x'
            };
            expect(tc.b.$name).toBe('a.b');
            expect(tc.b.things).toBe(1);
            expect(tc.b.stuff).toBe('x');
        });

        it('creates property that references same object as assigned', function() {
            const tc = terraformClass('cls');
            const o = {};
            tc.a = o;
            expect(tc.a).toBe(o);
        });

        it('creates a new TerraformObject if a property is set again', function() {
            const tc = terraformClass('a');
            tc.b = { x: 1 };
            expect(tc.b.x).toBe(1);
            tc.b = { y: 'delicious' };
            expect(tc.b.x).toBe('${a.b.x}');
            expect(tc.b.y).toBe('delicious');
        });
    });

    describe('JSON representation', function() {
        it('includes only user defined properties', function() {
            const cls = terraformClass('cls');
            expect(JSON.stringify(cls)).toBe('{}');
        });

        it('includes nested TerraformObjects', function() {
            const cls = terraformClass('cls');
            cls.box1 = { ip: '1.2.3.4' };
            cls.box2 = { ip: '5.6.7.8' };
            
            const json = JSON.stringify(cls);

            expect(JSON.parse(json)).toEqual({
                box1: { ip: '1.2.3.4' },
                box2: { ip: '5.6.7.8' }
            });
        });
    });
});