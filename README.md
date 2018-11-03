# TfBuilder

## What It Is

TfBuilder is a very small JavaScript library that simplifies generating
[Terraform](https://www.terraform.io/) JSON instead of HCL. It overcomes
the limitations of HCL by using a well-known, general-purpose scripting
language while maintaining concise syntax and simplicity. The generated
JSON is fully interoperable with hand-written `.tf` HCL files.
TfBuilder is thoroughly tested.

## Why

HCL can be very frustrating. Here's how TfBuilder helps [Overcome HCL Limitations](#overcome-hcl-limitations).
Why JavaScript? It is very widely known, allows a syntax similar to HCL, and is dynamically typed (which
is necessary to support the full range of Terraform providers at all times).

## Usage

`npm install @vobarian/tfbuilder`

```javascript
const {Configuration} = require('@vobarian/tfbuilder');
const config = Configuration();
// build config as described below
config.writeTo('myconfig.tf.json');
```

After generating your `.tf.json` files, you can invoke normal `terraform` 
commands. (Use a shell script or makefile to do both at once.)

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

The `resource`, `data`, and `module` properties are special: they use
proxies to dynamically add child properties with a compact syntax.
Here's a configuration that copies the file input.txt to output.txt 
while appending "ok" using Terraform's 
[local_file data source](https://www.terraform.io/docs/providers/local/d/file.html)
and [local_file resource](https://www.terraform.io/docs/providers/local/r/file.html):

HCL:
```hcl
data "local_file" "stuff" {
    filename = "input.txt"
}
resource "local_file" "abc" {
    filename = "output.txt"
    content  = "${data.local_file.stuff.content} ok"
}
```
TfBuilder:
```javascript
const {resource, data} = config; // convenience
data.local_file.my_input = {
    filename: 'input.txt'
}
resource.local_file.my_output = {
    filename: 'output.txt',
    content: data.local_file.my_input.content + ' ok'
}
```

Notice that you can assign the `my_input` property on the object
`data.local_file` even though we didn't set `local_file`
to a new object first.

In the resource we use the expression `data.local_file.my_input.content`
even though we never defined a `content` property on `my_input`.
When you *read* a non-existent property of a
resource, data source, or module object, TfBuilder automatically
builds an interpolation string for you, equivalent to the
HCL above. This syntax is easier to read than HCL's
quote-dollar-curly brace interpolation.

Since you're working with JavaScript objects, you can also use
variables to simplify your code. For example:

```javascript
const inputFile = data.local_file.my_input = {
    filename: 'input.txt'
}
```

Then you can just use `inputFile.content`, which TfBuilder
automatically turns into the equivalent interpolation string
`"${data.local_file.my_input.content}"`.

Interpolation strings are generated for you only when you read
a non-existent property. If you assign a value to a property
and then read it, you just get back the value as you would with
a normal JavaScript object. Usually this strategy works fine
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
config.resource.local_file.abc = {
    filename: m.special, // == "something"
    content: m.$output('special') // == "${module.example.special}"
}
```

The objects you create correspond directly to the JSON that will
be generated.
Translating HCL documentation to JSON can be tricky because it's
not always clear what the data type should be for nested blocks.
Generally, any repeatable block is an array.
If you use a map for a nested configuration
block and get syntax errors when you run Terraform,
try wrapping it in an array. A
good example is the `cache_behavior` blocks on an
`aws_cloudfront_distribution` resource, or the `lifecycle_rule`
blocks in `aws_s3_bucket`. They're repeatable nested
blocks so they must be arrays.
It's not always clear from the docs what is repeatable and what
isn't; often, repeatable things have a plural argument name
but not always. If you can't figure out the object tree
corresponding to some HCL snippet, you could try running
an HCL-to-JSON converter.

### Variables, Locals, and Outputs

`Configuration` also provides properties `variable`, `locals`, and
`output`, corresponding to those HCL
blocks. These don't provide any magic properties or
interpolation; they're just JavaScript objects.

TfBuilder provides `variable`, `locals`, and `output` to facilitate
interoperability with hand-written Terraform. However if you build
everything with TfBuilder they should be unnecessary, since
functions can replace modules, parameters replace variables,
the function return value replaces outputs, and JavaScript
of course already has local variables.

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

`Configuration` has a `merge` method to combine two Configurations.

An advantage of using JavaScript is that functions can help modularize
code and reduce duplication. Functions are more flexible and
concise than Terraform modules. Also, functions can be used to
build nested blocks, whereas Terraform modules can only create
whole resources, data sources, etc.

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

If your function produces multiple objects, you could pass a
Configuration as a parameter and mutate it in the function, but
APIs are usually cleaner if they do not mutate the parameters.
Rather you can return a Configuration and then merge it:

```javascript
function loadBalancedCluster(options) { /* create & return a Configuration */ }

config.merge(loadBalancedCluster(/* params */))
```

The latter approach reduces the amount of code required where the
function is called and relieves the caller of the responsibility for
knowing the resource or data source type (e.g., `aws_s3_bucket`),
so you may prefer it even for functions that only create one resource.

Every resource, data source, etc. in Terraform needs a unique name
(address). Terraform modules create unique names by prefixing any resources
with `module.{module_name}`. But Terraform is unaware of any
JavaScript functions, so it is up to you to create unique names. If
you want to use a function more than once, the resources it creates
need a prefix to make them unique. You could pass a prefix as a parameter.

## Interoperability

After you finally output your configuration to a `.tf.json` file,
Terraform reads it along with all other `.tf` and `.tf.json` files
in the directory. So you can freely mix TfBuilder scripts and plain
Terraform files. You can interpolate between them too: just type an
interpolation string in your JavaScript that references resources in
an ordinary `.tf` file or vice versa. Terraform resolves all
the names when it runs, and to TfBuilder they're all just strings.

If you want to create a module that supports both TfBuilder and 
plain Terraform users, you could package a function as an
npm module but also output the JSON in your build process
and commit that so it can also be used as a Terraform module.
Obviously you'd need to add Terraform input `variable`s and
`output`s.

## Recommendations

* Keep it simple. Use
  simple constructs like first-order functions, `if` statements, and `for` loops,
  and only where needed.
* In each `.js` source file create at most one `Configuration` and export
  it; e.g.:
  ```javascript
  const config = Configuration();
  module.exports = config;
  ```
  Then make a main `.js` file that `require`s the others; output them all to
  separate `.tf.json` files (possibly in parallel using `Promise.all`).
* Use a shell script or makefile to run your TfBuilder based scripts and
  Terraform together.
* It's handy to destructure a `Configuration` instance once in each file
  (unfortunately, you can't include `module` because that's already
  special in Node.js).
  ```javascript
  const config = Configuration();
  const {resource, data, variable} = config; // whichever ones you use
  resource.local_file.abc = { // instead of config.resource.local_file.abc = ...
  ```

## Overcome HCL Limitations

This section demonstrates cool things you can do more easily with JavaScript.

### Local Variables
Local variables are painfully awkward in HCL: 
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
in HCL, it's currently *impossible* to make an S3 bucket module with a conditional (controlled
by input variables) logging configuration. In JavaScript it's trivial:
```javascript
function customBucket({otherParams, accessLogsBucket = null}) {
    const bucket = { /*bunch of fancy config*/ };
    if (accessLogsBucket) {
        bucket.logging = {
            target_bucket: accessLogsBucket
        }
    }
    return bucket;
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
Using functions as subroutines can seriously
DRY up the code. One good use case is a CloudFront distribution with multiple
cache behaviors that differ only in the path mapping and origin. For example, one
project required **120 lines** of HCL to define 5 cache behaviors;
the TfBuilder equivalent is **37 lines** (not counting comments or blank lines
on either side).

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
const validateTags = require('validate-tags'); // ONCE per file
resource.aws_cloudfront_distribution.cloudfront = {
    tags: validateTags({
        Name    : "Our CloudFront Distribution",
        Version : "1.0.0",
    })
    // ...
}
```

