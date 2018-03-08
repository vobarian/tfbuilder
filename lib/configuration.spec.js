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
});