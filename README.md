# TFJS Alpha

TFJS is a minimal Node.js module to simplify generation of
Terraform configurations as JSON. It makes it convenient to use JavaScript
rather than HCL.

This is an alpha version/proof of concept. The code is well tested
but the API may change radically based on feedback. I need some
people to start playing with it to get design feedback.

This documentation is minimal and not well edited so far because the
design is open to change.

## Usage

`npm install tfjs` (from resolver)

```javascript
const {Configuration} = require('tfjs');
const config = Configuration();
// build your config
config.writeTo('myconfig.tf.json');
```

Don't use `new` with `Configuration`; it's a factory function.

## Configuration

Since we're ultimately building JSON, it really
helps to understand the equivalence of HCL to JSON first:
https://www.terraform.io/docs/configuration/syntax.html.
 
`Configuration` exposes properties representing the top-level HCL blocks: `resource`, `data`, and `module`. These three are special because you can add properties
to them just by referencing them and these properties
become mapped to new objects.

Here's a configuration that copies input.txt to output.txt while appending "ok":

HCL:
```hcl
data "local_file" "stuff" {
    filename = "input.txt"
}
resource "local_file" "abc" {
    filename = "output.txt"
    content = "${data.local_file.stuff.content} ok"
}
```
TFJS:
```javascript
const {resource, data} = config; // convenience
data.local_file.stuff = {
    filename: 'input.txt'
}
resource.local_file.abc = {
    filename: 'output.txt',
    content: data.local_file.stuff.content + ' ok'
}
```

Notice
that you can assign the `stuff` property on `data.local_file`
even though we didn't set `local_file` to a new object first.
With a normal object this wouldn't work but it's one of
the shortcuts TFJS provides.

In the resource, notice that the `content` property references
the `content` property of `data.local_file.stuff`, which we
never defined. When you *read* a non-existent property of a
resource, data source, or module object, TFJS automatically
turns it into an interpolation string for you, as in the
HCL equivalent above.

When you just need a constant, sometimes you can simplify your code
by using local JavaScript variables instead of interpolation. This
is the case when you just need to have the same value in multiple places
but there is no dependency between the configuration blocks where
it's used. But beware that you must use interpolation if there is
a dependency because Terraform uses interpolations to build its
dependency graph which determines the order in which it creates
resources. Fortunately TFJS hides the ugly interpolation syntax
from you: just pretend the properties you want exist and it will
generate them.

When you read a property of a resource, data source, or module
in TFJS, if it was previously set, you just get back the value
you set, as you would with a normal JavaScript object. If the
property does not exist, TFJS assumes it's an output/attribute
and generates the interpolation string for you. If you have a
module where the same name is used as both an input and an
output, you can use the special `$output` method to generate
the interpolation string:

```javascript
// Suppose this module uses "name" as an input and output
const m = config.module.example = {
    source: './example',
    name: 'something' // input to module
}
config.resource.local_file.abc = {
    // name property was set, so it's just "something":
    filename: m.name,
    // use $output to get "${module.example.name}"
    content: m.$output('name')
}
```

`Configuration` also provides properties `variable`, `locals`,
`output`, and `provider`, corresponding to the top-level HCL
blocks. These aren't magical; they're just JavaScript objects.
They're included for the sake of completeness but if you use
TFJS for everything I don't think they're needed, since
functions can replace modules, parameters replace variables,
the function return value replaces outputs, and JavaScript
local variables...well, they're local variables.

Translating HCL documentation to JSON can be tricky because it's
not always clear what the data type should be for nested blocks.
Generally, any repeatable block is an array.
If you use a map for a nested configuration
block and get syntax errors, try wrapping it in an array. A
good example is the `cache_behavior` blocks on an
`aws_cloudfront_distribution` resource, or the `lifecycle_rule` blocks in `aws_s3_bucket`. They're repeatable nested
blocks so they must be arrays in JSON, and TFJS by extension.
It's not always clear from the docs what is repeatable and what
isn't; often, repeatable things have a plural argument name
but not always.

In HCL `provider` blocks are unusual because unlike
other repeated configuration blocks they don't have unique
names before the curly braces; e.g.:
```hcl
provider "aws" {
    region = "us-east-1"
}
provider "aws" {
    alias  = "us-west-2"
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
                "alias": "us-west-2",
                "region": "us-west-2"
            }
        }
    ]
}
```

To ease the pain, TFJS provides an `add` method on the `provider` array:
```javascript
config.provider.add('aws', {
    region: 'us-east-1'
})
const backupRegion = 'us-west-2'
config.provider.add('aws', {
    region: backupRegion,
    alias:  backupRegion
})
```
Also note that Terraform prohibits using interpolation in the `alias`
argument but TFJS doesn't care if you use a local variable (or a function call, or any string expression for that matter).

`Configuration` provides a `merge` method to combine two Configurations.

An object that is assigned to a Configuration as a resource, data source,
or module cannot later be assigned to the same or another Configuration.
If you want to attach an object in more than one place to a Configuration
or to more than one Configuration you need to manually do a deep copy first.

You can get your configuration's JSON at any time by reading
Configuration's `json` property. As a convenience you can
pass a file name to `writeTo` to write it to a file. File names
must end in `.tf.json` for Terraform to recognize them.

## Interoperability

After you finally output your configuration to a `.tf.json` file,
Terraform reads it along with all other `.tf` and `.tf.json` files
in the directory. So you can freely mix TFJS and plain Terraform
files. You can interpolate between them too: you can just type an
interpolation string in your TFJS that references resources in
an ordinary `.tf` file and vice versa. Terraform resolves all
that when it runs and to TFJS they're all just strings.

If you want to create a module that supports both TFJS and 
plain Terraform users, you could package a function as an
npm module but also output the JSON in your build process
and commit that so it can also be used as a Terraform module.
Obviously you'd need to add Terraform input `variable`s and
`output`s.

## Effective Usage

In JavaScript, all things are possible but few things are wise.
I haven't used TFJS enough yet to know what's best, but these are
some ideas I had to start from. Maybe they're even bad ideas.
Feedback is welcome.

* Keep it simple. We don't want it to be worse than HCL. Use
  simple constructs like first-order functions, `if` statements, and `for` loops,
  and only where needed.
* In each `.js` source file create at most one `Configuration` and export
  it; e.g.:
  ```javascript
  const config = Configuration();
  module.exports = config;
  ```
* Have a main `.js` file that `require`s the others; output them all to
  separate `.tf.json` files (possibly in parallel using `Promise.all`).
* It's handy to destructure a `Configuration` instance once in each file
  (unfortunately, you can't include `module` because that's already
  special in Node.js).
  ```javascript
  const config = Configuration();
  const {resource, data, variable} = config; // whichever ones you use
* Don't write Terraform modules; write functions and package them as npm modules.
* Don't pass a `Configuration` into a function; let the function return something
  to merge into the config.
    * If your function builds one resource, data source, etc., just return it as a
    plain JavaScript object. (Not sure about this--see next item; maybe it should
    always be done that way instead?)
    * If your function builds multiple resources, create a
    `Configuration` inside the function, add everything to it, then return it.
    The client can use the `merge` method to merge it into the main config.
    Since everything must have a unique name in Terraform, such a function
    probably needs to take a base name as an input so if the client uses it
    more than once it doesn't generate duplicate names. This also allows the
    client to make sure the names generated in the function don't collide
    with its own.

## Cool Things

Eventually this section will become a demo of how to overcome common HCL limitations
in a before/after style. For now I just wanted to document a few things I felt make
using JavaScript/TFJS nice.

### Local Variables
Interpolation strings can get really long and hard to read.
Local variables in HCL are too much of a pain. In JS you can easily
alias an object to a local variable:
```javascript
const oai = config.resource.aws_cloudfront_origin_access_identity.origin_access_identity = {
    comment: 'what a long resource name'
}
config.resource.aws_cloudfront_distribution.cf = {
    origin: [{
        s3_origin_config: {
            // Use oai instead of:
            // resource.aws_cloudfront_origin_access_identity.origin_access_identity.cloudfront_access_identity_path
            origin_access_identity: oai.cloudfront_access_identity_path
        }
    }]
}
```

### If Statements
Using `count` for conditionals is hacky and doesn't work for nested config blocks. For example,
in HCL, it's currently *impossible* to make an S3 bucket module with a conditional (controlled
by input variables) logging configuration. In JavaScript it's trivial:
```javascript
function customBucket({stuff, things, accessLogsBucket = null}) {
    const bucket = { /*bunch of fancy config*/ };
    if (accessLogsBucket) {
        bucket.logging = {
            target_bucket: accessLogsBucket
        }
    }
    return bucket;
}
```

And this trainwreck:
```hcl
locals {
  geo_whitelist_base = ["US","CA","RO"]
  geo_whitelist = "${slice(local.geo_whitelist_base, 0, length(local.geo_whitelist_base) - (var.level == "beta" ? 0 : 1))}"
}
```
becomes:
```javascript
const countryWhitelist = ["US", "CA"]
if (level === "beta") countryWhitelist.push("RO")
```

### Functions
I won't type this one out but simply using functions as subroutines can seriously
DRY up the code. One good use case is a CloudFront distribution with multiple
cache behaviors that differ only in the path mapping and origin. In the PCA
CloudFront configuration we had **120 lines** of HCL for cache behaviors;
the TFJS equivalent is **37 lines** (not counting comments or blank lines
on either side).

Functions can also be much more convenient than modules:
```hcl
module "cloudfront_tags" {
  source = "git::ssh://git@coderepo.carfax.net:7999/terraform/tags.git"
  tags = {
    Name        = "CFP CloudFront Distribution"
    Description = "CloudFront distribution for CARFAX For Police and eCrash frontend"
    Status      = "InDevelopment"
    Version     = "1.0.0"
    Customer    = "External"
  }
}
resource "aws_cloudfront_distribution" "cloudfront" {
    tags = "${module.cloudfront_tags.tags}"
    // ...
}
```
TFJS:
```javascript
const tags = require('tags'); // once per module
config.resource.aws_cloudfront_distribution.cloudfront = {
    tags: tags({
        Name        : "CFP CloudFront Distribution",
        Description : "CloudFront distribution for CARFAX For Police and eCrash frontend",
        Status      : "InDevelopment",
        Version     : "1.0.0",
        Customer    : "External",
    })
}
```

## Need Help

This is an alpha version. I'm wondering if this tool is well suited to real work.
I need some feedback and I'm open to reconsidering the whole design. The principle is just to use some language other than HCL to generate JSON, and make doing so convenient.

Here's also some specific ideas/questions I had:

- Would be interested in coming up with a better name for the project
- Is it better to pass interpolation strings into functions or whole resource objects?
- When merging, should there be an option (or requirement) to specify a base name that
  would be prepended to all the resources, data sources, etc.? This would ease the burden
  of prefixing everything when you're writing a function that generates multiple
  resources and returns them in a Configuration. (Prefix is needed so names chosen by the
  function-module author do not collide with names used in the client or other modules,
  and in case more than one instance of the module is used.) Other ideas for
  namespacing modules (by which I mean functions that build Configurations)?
- What is the best way to integrate running node and terraform? Shell script? Wrapper
  script? Possible advantage of wrapper: variables passed on the command line could
  be exposed to both Terraform and the JavaScript (maybe...how?)
- What's a good way to get variables (such as environment level) into the JavaScript?
  Is this something the library can help with or just use standard techniques?
- Should there be a warning/error about null/undefined properties in the config?
  They won't be serialized to JSON anyway but usually indicate a mistake because the
  programmer meant to set it to something
- Likewise above for empty objects; probably came into existence because of a typo
- Is the provider.add method sufficiently useful to justify its existence or is it noise?
- Is turning unknown properties into interpolation strings automatically even a good idea?
- Is the $output function a good idea? Is there a better way to represent it?
- Should the "magic" for reading non-existent properties go more than one level deep?
  Example: If a module has a map type output we can write `module.example.output` to
  get "${module.example.output}", which would be the whole map, but we can't currently
  write `module.example.output.a` to get the value at key "a" from the map
  (which would be "${module.example.output.a}"). I *think* this would inherently
  support arrays too because `module.example.output[0]` would become
  "${module.example.output.0}" which I think Terraform accepts (?)
- Should it be possible to set a whole
  resource class block (such as aws_s3_bucket) to a JS object? Currently it's not
  allowed because it would take some extra work to implement, didn't seem very useful,
  and seems more likely to be something done on accident than on purpose due to
  misunderstanding or typo. My plan was if you wanted to add a bunch of resources from
  an external source (function) you'd just get them as part of a Configuration which
  you could `.merge`. Maybe there are use cases for directly setting these sections
  I haven't thought of. It would allow adding several instances of the same type
  of resource or data source at once, but so does `.merge` (except the latter
  requires a whole `Configuration` object)
- Do we need interpolation magic for variables and locals? How would it work/look?
  Does reading a variable always give you the interpolation or do you get back the
  value you set and use a different method to get the interpolation string?