# TfBuilder

TfBuilder is a small JavaScript library to generate
[Terraform](https://www.terraform.io/) code. It [overcomes
the limitations of HCL](#overcome-hcl-limitations) by using a well-known, general-purpose scripting
language while maintaining concise syntax and simplicity. 
TfBuilder is thoroughly tested.

A Terraform module comprises a directory containing `.tf` files written
in HCL (HashiCorp Configuration Language). But HCL is just an alternative
syntax for JSON. Terraform also reads any `.tf.json` files and the two
formats can be freely mixed.
(https://www.terraform.io/docs/configuration/load.html)
TfBuilder helps generate Terraform JSON.

## Usage

```sh
npm install @vobarian/tfbuilder
```

```javascript
const {Configuration} = require('@vobarian/tfbuilder')
const {resource, data} = config = Configuration()
// build config as described below
config.writeTo('myconfig.tf.json')
```

When it's time to invoke Terraform, first run your scripts to generate
`.tf.json` files, then invoke normal `terraform` 
commands. (Use a shell script or makefile to do both.)

## Configuration

Since we're ultimately building JSON, it really
helps to understand the equivalence of HCL to JSON first:
https://www.terraform.io/docs/configuration/syntax.html.

TfBuilder provides a single factory function, `Configuration`, which returns
an object representing the top-level Terraform JSON object. 
`Configuration` exposes the following properties representing HCL blocks:

 * `resource`
 * `data`
 * `module`
 * `variable`
 * `locals`
 * `output`
 * `provider`

### Resources, Data Sources, and Modules

TfBuilder provides two shortcuts under the `resource`,
`data`, and `module` properties:

  1. Automatically adding objects when a new resource type,
     data source type, or module is referenced
  2. Generating interpolation strings when an undefined property is read

Compare the following HCL and TfBuilder versions of a configuration
that copies the file `input.txt` to `output.txt` 
while appending the word `ok`:

HCL:
```hcl
data "local_file" "my_input" {
    filename = "input.txt"
}
resource "local_file" "my_output" {
    filename = "output.txt"
    content  = "${data.local_file.my_input.content} ok"
}
```
TfBuilder:
```javascript
data.local_file.my_input = {
    filename: 'input.txt'
}
resource.local_file.my_output = {
    filename: 'output.txt',
    content: data.local_file.my_input.content + ' ok'
}
```

Notice:

  1. You can assign the `my_input` property on the object
     `data.local_file` without initializing `local_file`
     to a new object first. (If `data` were a plain
     JS object, you'd get
     "Cannot set property 'my_input' of undefined".)
  2. In the resource, the expression `data.local_file.my_input.content`
     evaluates to the required Terraform interpolation
     string, `${data.local_file.my_input.content}`. When you *read*
     a non-existent property of a
     resource, data source, or module object, TfBuilder automatically
     builds an interpolation string for you.

You can further simplify with JavaScript variables:

```javascript
const inputFile = data.local_file.my_input = {
    filename: 'input.txt'
}
assert(inputFile.content === "${data.local_file.my_input.content}")
```

Interpolation strings are generated for you only when you read
a non-existent property. If you assign a value to a property
and then read it, you just get back the value as you would with
a normal object. This strategy usually works
because the names of resource arguments and attributes rarely
overlap. However, if you have a module, data source, or
resource where the same name is used as both an input and an
output, you can use the automatically provided `$output` method
to generate the interpolation string:

```javascript
// Suppose this module uses "special" as the name of
// both input and output variables
const m = config.module.example = {
    source: './example',
    special: 'something' // input variable named "special"
}
assert(m.special === "something")
assert(m.$output("special") === "${module.example.special}")
```

The objects you create correspond directly to the JSON that will
be generated.
Translating HCL documentation to JSON can be tricky because it's
not always clear what the data type should be for nested blocks.
Generally, any repeatable block must be in an array.
If you use a map for a nested configuration
block and get syntax errors when you run Terraform,
try wrapping it in an array. Examples are `cache_behavior` blocks
in `aws_cloudfront_distribution` or `lifecycle_rule`
blocks in `aws_s3_bucket`.

> Implementation note:
> When you attach an object to a Configuration as a
> resource, data source, or module,
> TfBuilder replaces its prototype. Do not try to use inheritance
> for your configuration objects. Also, you cannot assign the same
> object more than once as a resource, data source, or module,
> like this: `resource.example.a = resource.example.b`.
> Instead, use a factory function or deep clone. This design
> avoids unintentional side effects of aliasing.

### Variables, Locals, and Outputs

`Configuration` has `variable`, `locals`, and
`output` properties to facilitate
interoperability with hand-written Terraform.
These don't provide any magic properties or
interpolation; they're just JavaScript objects.
If you build everything with TfBuilder they should
be unnecessary.

### Providers

In HCL, `provider` blocks are unusual because, unlike
other repeated configuration blocks, they don't have unique
names before the curly braces; e.g.:
```hcl
provider "aws" {
    region = "us-east-1"
}
provider "aws" {
    alias  = "backup"
    region = "us-west-2"
}
```

Each provider block must have a unique `alias` field, except for one
of each type, which becomes the "default". This is
significant because it translates to some really quirky JSON: the
provider property is actually an array where each element is an
object with a single key (the provider name) and a value containing
the rest of the config block. The above HCL in JSON is:
```json
{
    "provider": [
        {
            "aws": {
                "region": "us-east-1"
            }
        },
        {
            "aws": {
                "alias": "backup",
                "region": "us-west-2"
            }
        }
    ]
}
```

To ease the pain, `Configuration` has a `provider` array with a special
`add` method:
```javascript
config.provider.add('aws', {
    region: 'us-east-1'
})
config.provider.add('aws', {
    alias:  'backup',
    region: 'us-west-2'
})
```

Terraform prohibits using interpolation in the `alias`
argument but you can use a JavaScript variable or function since it's
evaluated before the JSON is written out.

### Building Larger Configurations

An advantage of using JavaScript is that functions can help modularize
code and reduce duplication. Functions are more flexible and
concise than Terraform modules. Also, functions can be used to
build nested blocks, whereas Terraform modules can only create
whole resources and data sources.

A function's parameters take the place of module input variables.
Output variables generally aren't needed since any properties can
be read directly from the returned object.

If a function only creates a single
resource, data source, or module, you can just return it and assign it
to an appropriate place in the configuration tree:

```javascript
function secureS3Bucket(params) { /* return object with aws_s3_bucket args */ }

config.resource.aws_s3_bucket.my_bucket = secureS3Bucket(/* params */)
```

`Configuration#merge` combines two Configurations by adding all the configuration
objects (resources, data sources, etc.) from the Configuration
parameter. A function that creates multiple resources can return a new
Configuration to be merged into the main one:

```javascript
function loadBalancedCluster(options) {
    const {resource, data} = config = Configuration()
    // add resources
    return config
}

mainConfig.merge(loadBalancedCluster(/* params */))
```

The latter approach reduces the amount of code at the call site
and relieves the caller of the responsibility for
knowing the resource or data source type,
so you may prefer it even for functions that only create one resource.

Every resource in Terraform needs a unique
address. A normal Terraform module can be used multiple times as long
as each instance has a unique name because Terraform creates unique
addresses for resources in the module by prefixing them
with `module.NAME`.

But Terraform is unaware of any
JavaScript functions, so if you create resources in a function and
want to use that function repeatedly, it's up to you to create
unique names. You could pass a prefix as a parameter to the
function. The function would use the prefix in all resource
names it generates. Another option is to include a unique property of
the resource itself in the Terraform name. For example,
if a function creates AWS S3 buckets, the bucket names are already
unique, so the bucket name
could be used as part of the resource name to make it unique.

## Overcome HCL Limitations

This section demonstrates cool things you can do more easily with JavaScript.

### Local Variables
Local variables are awkward in HCL: 
```hcl
locals {
    app_name = "5250 Cloud Proxy"
}
resource "example" "abc" {
    some_arg = "${local.app_name}"
}
```

In JS, just use a constant anywhere you need to have a consistent value but
don't want to have to find-and-replace later:
```javascript
const appName = '5250 Cloud Proxy'
resource.example.abc = {
    some_arg: appName
}
```

Of course, you still have to use Terraform local variables for dynamic values
which aren't known before Terraform runs. Also beware that you can't just use
string constants if one resource depends on another;
Terraform infers the dependency graph from interpolations, which affects the order
in which resources are created. If one resource depends on another, interpolate
the attributes of the first into the arguments of the second using Terraform
interpolation syntax (via TfBuilder's magic properties shortcut). 

Interpolation strings can get really long and hard to read. In JS you can easily
alias an object to a local variable and then get properties, including interpolation
expressions, off the local variable:
```javascript
const oai = resource.aws_cloudfront_origin_access_identity.identity = {
    comment = 'what a long resource name'
}
// Now these 3 lines are equivalent, but one is much shorter:
// resource.aws_cloudfront_origin_access_identity.identity.cloudfront_access_identity_path
// "${aws_cloudfront_origin_access_identity.identity.cloudfront_access_identity_path}"
// oai.cloudfront_access_identity_path
```

### If Statements
Using `count` for conditionals is hacky and doesn't work for some nested config blocks. For example,
in HCL, it's currently impossible to make an S3 bucket module with a logging configuration
conditionally enabled by input variables. In JavaScript it's trivial:
```javascript
function customBucket({otherParams, accessLogsBucket = null}) {
    const bucket = { /*bunch of fancy config*/ }
    if (accessLogsBucket) {
        bucket.logging = {
            target_bucket: accessLogsBucket
        }
    }
    return bucket
}
```

And this train wreck (which includes "AU" in the whitelist only if the current level is beta):
```hcl
locals {
  geo_whitelist_base = ["US","CA","AU"]
  geo_whitelist = "${slice(local.geo_whitelist_base, 0, length(local.geo_whitelist_base) - (var.level == "beta" ? 0 : 1))}"
}
```
becomes:
```javascript
const countryWhitelist = ["US", "CA"]
if (level === "beta") countryWhitelist.push("AU")
```

### Functions
Functions reduce duplication.
One good use case is a CloudFront distribution with multiple
cache behaviors that differ only in the path mapping and origin. For example, one
project required **120 lines** of HCL to define 5 cache behaviors;
the TfBuilder equivalent is **37 lines**.

Functions can also be much more convenient than Terraform modules:

HCL:

```hcl
module "cloudfront_tags" {
    source = "./tags_validator"
    tags = {
        Name    = "Our CloudFront Distribution"
        Version = "1.0.0"
    }
}
resource "aws_cloudfront_distribution" "cloudfront" {
    tags = "${module.cloudfront_tags.tags}"
    // ...
}
```
TfBuilder:
```javascript
const validateTags = require('validate-tags') // ONCE per file
resource.aws_cloudfront_distribution.cloudfront = {
    tags: validateTags({
        Name    : "Our CloudFront Distribution",
        Version : "1.0.0",
    })
    // ...
}
```

### Arrays, Maps, and Loops
Terraform uses the `count` meta-parameter to create multiple resources.
But modules and most nested blocks don't support `count`.
In JavaScript you can use loops, `forEach`, `map`, etc. with functions
to generate repeating blocks of any type at any nesting level.

HCL:
```hcl
resource "aws_waf_ipset" "ipset" {
  name = "mainOffice"

  ip_set_descriptors {
    type  = "IPV4"
    value = "192.0.7.0/24"
  }

  ip_set_descriptors {
    type  = "IPV4"
    value = "10.16.0.0/16"
  }

  ip_set_descriptors {
    type  = "IPV4"
    value = "10.21.0.0/16"
  }
}
```
TfBuilder:
```javascript
const ips = ["192.0.7.0/24", "10.16.0.0/16", "10.21.0.0/16"]
resource.aws_waf_ipset.ipset = {
    name: "mainOffice",
    ip_set_descriptors: ips.map(value => ({ value, type: "IPV4" }))
}
```

Another common problem in Terraform is that
`count.index` becomes part of the resource address
in the Terraform state. So, if you're generating
resources from a list and you remove an item from
the middle, all the resources after it get
modified or even destroyed and re-created. Using
TfBuilder you can completely control the resource
address and decouple it from the index.

This HCL example creates three files with random contents:

```hcl
locals {
    files = ["a", "b", "c"]
}

resource "random_string" "content" {
    count  = "${length(local.files)}"
    length = 10
}

resource "local_file" "file" {
    count    = "${length(local.files)}"
    filename = "${local.files[count.index]}.txt"
    content  = "${random_string.content.*.result[count.index]}"
}
```

If you delete `"b"`, both
`b.txt` and `c.txt` get destroyed and then `c.txt` is re-created.
TfBuilder solution:

```javascript
const files = ["a", "b", "c"]
files.forEach(file => {
    const rand = resource.random_string['content_' + file] = {
        length: 10
    }
    resource.local_file['file_' + file] = {
        filename: file + '.txt',
        content: rand.result
    }
})
```

In the TfBuilder example, the file name (which is already
unique) is used as part of the resource address, so removing
`"b"` just deletes `b.txt`.

However, JS arrays and loops are not a complete replacement for Terraform's
`count`. Whereas `count` can be used with a list produced by a data
source, JS can only work with data that is known before
Terraform runs.