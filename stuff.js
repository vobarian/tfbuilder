/*
- Configuration
  - has pre-defined properties resource, data, module, etc. of type TerraformSection
  - pre-defined properties cannot be overwritten
  - has a merge(otherConfig) method
- resource: TerraformSection
  - set: deny
  - get: create TerraformClass if doesn't exist
- aws_s3_bucket: TerraformClass
  - set: convert to TerraformObject; don't allow props to be overwritten
  - get: create a new TerraformObject if prop doesn't exist
- my_bucket: TerraformObject (resource, data source, module)
  - set: normal behavior
  - get: return prop if exists, otherwise compute interpolation string
    - TerraformObject has to know its own name
*/

resource.aws_s3_bucket.howard = {
    bucket: 'test-bkt-name',
    tags: {
        hldi = 'viwf',
        stage = 'prod',
        ver = '1.0'
    },
    server_side_encryption: {
        some_stuff_i_guess: {
            usethis: 'aes256'
        }
    },
    logging: {
        target_bucket: resource.aws_s3_bucket.logs.id,
        target_prefix: 'prefix/'
    }
}

resource.aws_s3_bucket.logs = {
    bucket: 'logsbucket'
}

const thing = new Resource('aws_s3_bucket', 'mybucket', {
    server_side_encryption: {
        thingsandstuff: {
            whatever: 2
        }
    }
})
