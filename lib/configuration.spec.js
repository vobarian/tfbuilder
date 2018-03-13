'use strict';

const configuration = require('./configuration');

describe('configuration', function() {
    let config;

    beforeEach(function() {
        config = configuration();
    });

    it('has resource section', function() {
        config.resource.aws_s3_bucket.example = {
            bucket: 'mybucket'
        };
        expect(config.resource.aws_s3_bucket.example.bucket).toBe('mybucket');
        expect(config.resource.aws_s3_bucket.example.arn).toBe('${aws_s3_bucket.example.arn}');
    });

    it('has data section', function() {
        config.data.aws_acm_certificate.example = {
            domain: 'example.com'
        };
        expect(config.data.aws_acm_certificate.example.domain).toBe('example.com');
        expect(config.data.aws_acm_certificate.example.arn).toBe('${data.aws_acm_certificate.example.arn}');
    });

    it('supports modules', function() {
        config.module.custom = {
            source: 'something'
        };
        expect(config.module.custom.source).toBe('something');
        expect(config.module.custom.an_output).toBe('${module.custom.an_output}');
    });

    it('can hold variables', function() {
        config.variable.abc = {
            default: 123
        };
        expect(config.variable.abc.default).toBe(123);
    });

    it('can hold local variables', function() {
        config.locals.abc = 123;
        expect(config.locals.abc).toBe(123);
    });

    it('can hold outputs', function() {
        config.output.abc = {
            value: 123
        };
        expect(config.output.abc.value).toBe(123);
    });

    it('can hold providers', function() {
        config.provider.push({aws: {region: 'us-west-2'}});
        expect(config.provider).toEqual([
            {
                aws: {
                    region: 'us-west-2'
                }
            }
        ]);
    });

    it('adds provider via convenience method', function() {
        config.provider.push({aws: {region: 'us-west-2'}});
        config.provider.add('aws', { 
            alias: 'other',
            region: 'us-east-1'
        });
        expect(config.provider).toEqual([
            {
                aws: {
                    region: 'us-west-2'
                }
            },
            {
                aws: {
                    alias: 'other',
                    region: 'us-east-1'
                }
            }
        ]);
    });

    it('serializes to JSON', function() {
        config.variable.access_identity = {
            description: 'Who can get objects'
        };
        const bucket = config.resource.aws_s3_bucket.example = {
            bucket: 'my-bucket',
            tags: {
                environment: 'dev'
            }
        }
        config.data.aws_iam_policy_document.public_get_object = {
            statement: [{
                sid: "GrantGetObject",
                actions: ["s3:GetObject"],
                effect: "Allow",
                resources: [bucket.arn + "/*"],
                principals: [{
                    type: "AWS",
                    identifiers: "${vars.access_identity}"
                }]
            }]
        };
        config.resource.aws_s3_bucket_policy.example = {
            bucket: bucket.id,
            policy: config.data.aws_iam_policy_document.public_get_object.json
        };
        config.module.some_module = {
            source: "place"
        };
        bucket.something = config.module.some_module.result;
        config.locals.abc = 123;
        config.output.domain = {
            value: bucket.bucket_domain_name,
            description: "The domain name"
        };
        config.provider.add('aws', {region: 'us-east-1', profile: 'testexampleconfig5'});

        const json = config.json;
        
        expect(JSON.parse(json)).toEqual({
            variable: {
                access_identity: {
                    description: 'Who can get objects'
                }
            },
            resource: {
                aws_s3_bucket: {
                    example: {
                        bucket: 'my-bucket',
                        tags: {
                            environment: 'dev'
                        },
                        something: '${module.some_module.result}'
                    }
                },
                aws_s3_bucket_policy: {
                    example: {
                        bucket: '${aws_s3_bucket.example.id}',
                        policy: '${data.aws_iam_policy_document.public_get_object.json}'
                    }
                }
            },
            data: {
                aws_iam_policy_document: {
                    public_get_object: {
                        statement: [{
                            sid: "GrantGetObject",
                            actions: ["s3:GetObject"],
                            effect: "Allow",
                            resources: ['${aws_s3_bucket.example.arn}/*'],
                            principals: [{
                                type: "AWS",
                                identifiers: "${vars.access_identity}"
                            }]
                        }]
                    }
                }
            },
            module: {
                some_module: {
                    source: 'place'
                }
            },
            locals: {
                abc: 123
            },
            output: {
                domain: {
                    value: '${aws_s3_bucket.example.bucket_domain_name}',
                    description: "The domain name"
                }
            },
            provider: [{
                aws: {
                    region: 'us-east-1',
                    profile: 'testexampleconfig5'
                }
            }]
        });
    });

    describe('.merge', function() {
        let source, destination;

        beforeEach(function() {
            source = configuration();
            destination = configuration();
        });

        it('merges resources of same class', function() {
            destination.resource.bucket.a = { x: 1 };
            source.resource.bucket.b = { x: 2 };
            source.resource.bucket.c = { y: 1 };

            destination.merge(source);

            expect(destination.resource.bucket.a.x).toBe(1);
            expect(destination.resource.bucket.b.x).toBe(2);
            expect(destination.resource.bucket.c.y).toBe(1);
        });

        it('merges resources of different classes', function() {
            destination.resource.bucket.a = { x: 1 };
            source.resource.ip.b = { x: 2 };

            destination.merge(source);

            expect(destination.resource.bucket.a.x).toBe(1);
            expect(destination.resource.ip.b.x).toBe(2);
        });

        it('does not replace the resource section object on the destination', function() {
            const originalResourceSection = destination.resource;
            destination.resource.bucket.a = { x: 1 };
            source.resource.ip.b = { x: 2 };

            destination.merge(source);

            expect(destination.resource).toBe(originalResourceSection);
        });

        it('does not replace resource class objects on the destination', function() {
            const originalClass = destination.resource.bucket;
            destination.resource.bucket.a = { x: 1 };
            source.resource.bucket.b = { x: 2 };

            destination.merge(source);

            expect(destination.resource.bucket).toBe(originalClass);
        });

        it('aliases the resource TerraformObject in the destination', function() {
            source.resource.bucket.a = { };

            destination.merge(source);

            source.resource.bucket.a.x = 1;
            expect(destination.resource.bucket.a.x).toBe(1);
        });

        it('merges data sources', function() {
            destination.data.disk.a = { x: 1 };
            source.data.disk.b = { y: 2 };
            source.data.cert.a = { z: 3 };

            destination.merge(source);

            expect(destination.data.disk.a.x).toBe(1);
            expect(destination.data.disk.b.y).toBe(2);
            expect(destination.data.cert.a.z).toBe(3);
        });

        it('merges modules', function() {
            destination.module.a = { x: 1 };
            source.module.b = { y: 2 };
            source.module.c = { z: 3 };

            destination.merge(source);

            expect(destination.module.a.x).toBe(1);
            expect(destination.module.b.y).toBe(2);
            expect(destination.module.c.z).toBe(3);
        });

        it('merges variables', function() {
            destination.variable.a = { default: 1 };
            source.variable.b = { default: 2 };
            source.variable.c = { default: 3 };

            destination.merge(source);

            expect(destination.variable.a.default).toBe(1);
            expect(destination.variable.b.default).toBe(2);
            expect(destination.variable.c.default).toBe(3);
        });

        it('merges locals', function() {
            destination.locals.a = 1;
            source.locals.b = 2;
            source.locals.c = 3;

            destination.merge(source);

            expect(destination.locals.a).toBe(1);
            expect(destination.locals.b).toBe(2);
            expect(destination.locals.c).toBe(3);
        });

        it('merges output variables', function() {
            destination.output.a = { value: 1 };
            source.output.b = { value: 2 };
            source.output.c = { value: 3 };

            destination.merge(source);

            expect(destination.output.a.value).toBe(1);
            expect(destination.output.b.value).toBe(2);
            expect(destination.output.c.value).toBe(3);
        });

        it('merges providers', function() {
            destination.provider.add('abc', { stuff: 1 });
            source.provider.add('abc', { alias: 'xyz' });
            source.provider.add('yyy', { q: 1 });

            destination.merge(source);

            expect(destination.provider[0]).toEqual({ abc: { stuff: 1 } });
            expect(destination.provider[1]).toEqual({ abc: { alias: 'xyz' } });
            expect(destination.provider[2]).toEqual({ yyy: { q: 1 } });
        });

        it('does not replace the providers object in the destination', function() {
            destination.provider.add('abc', { x: 1 });
            source.provider.add('def', { y: 2 });
            const originalProvider = destination.provider;

            destination.merge(source);

            expect(destination.provider).toBe(originalProvider);
        });
    });
});