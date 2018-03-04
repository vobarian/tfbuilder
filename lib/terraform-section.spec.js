'use strict';

const terraformSection = require('./terraform-section');

describe('terraformSection', function() {
    it('produces new TerraformClass when getting unknown property', function() {
        const data = terraformSection('data');
        const acmDataSource = data.aws_acm_certificate;
        acmDataSource.example.domain = 'example.com';
        expect(acmDataSource.example.domain).toBe('example.com');
        expect(acmDataSource.example.arn).toBe('${data.aws_acm_certificate.example.arn}');
    });

    it('returns the same TerraformClass each time a property is read', function() {
        const section = terraformSection('section');
        const clas = section.clas;
        expect(section.clas).toBe(clas);
    });

    it('uses the property name as the TerraformClass name if section name is empty', function() {
        const resource = terraformSection('');
        expect(resource.aws_s3_bucket.example.id).toBe('${aws_s3_bucket.example.id}');
    });

    it('does not allow properties to be set', function() {
        const section = terraformSection('section');
        expect(_=> section.x = {}).toThrowError(TypeError, 'Cannot set properties on TerraformSection');
    });

    it('includes only user defined properties when converted to JSON', function() {
        const section = terraformSection('section');
        expect(JSON.stringify(section)).toBe('{}');
    });

    it('treats Object prototype properties like any other', function() {
        const section = terraformSection('section');
        expect(section.toString.a.b).toBe('${section.toString.a.b}');
    });
});