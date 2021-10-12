## About

This is a small utility that produce necessary parameters to AEM's query builder servlet.

## Requirements

This library can be used both in browsers and server-side applications.

> Include polyfill for [Object.assign](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign) and
  [Object.fromEntries](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries) in legacy environments.

> This utility is written in CommonJS module. For ES Module or UMD environment, or either [class](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes),
  [generator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function*),
  [destructuring assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment),
  [rest parameter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters),
  [spread operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_syntax) or
  [optional chaining operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining) is not supported,
  please transcompile using tools like [webpack](https://webpack.js.org).

## TypeScript support

When using in TypeScript projects with `tsc`, set the following flags to `true` in `tsconfig.json`:

```json
{
    "compilerOptions": {
        "esModuleInterop": true,
        "allowSyntheticDefaultImports": true
    }
}
```

which can then be imported as follow:

```javascript
import QueryBuilder from 'aem-querybuilder';
```

## Examples

```javascript
const QueryBuilder = require('aem-querybuilder');
const query = new QueryBuilder({
    type: 'cq:Page',  // find all pages
    path: '/content', // under /content
    where: {          // where title contains Sample
        'jcr:content/jcr:title': { like: 'Sample' }
    }
    select: '*',      // select all properties
    nodeDepth: 1,     // including direct children's
    limit: 10         // limiting to 10 results
});

// using GET
fetch('http://localhost:4502/bin/querybuilder.json?' + query);

// using POST
fetch('http://localhost:4502/bin/querybuilder.json', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: query.toString()
});

// getting the list of parameters for further processing
const params = query.toJSON();
```

## Reference

> Documentation here is meant to demostrate how to generate the query parameters. For reference on AEM's query builder API itself,
  please refer to [official documentation](https://experienceleague.adobe.com/docs/experience-manager-65/developing/platform/query-builder/querybuilder-predicate-reference.html).

### Predicate interface

One or more predicates are specified through the `Predicate` interface. It is essentially an object with known property keys.

Multiple predicates on a single `Predicate` object are always joined by `and`:

```javascript
{
    path: P1,
    nodename: P2,
    where: {
        property1: P3,
        property2: P4
    }
}
```
are translated as
```
(path: P1) and (nodename: P2) and (property1: P3) and (property2: P4)
```

> `P3` and `P4` in this example are called property predicate and has a different set of predicates, see [Property predicates](#Property-predicates).

#### Logical operation

The `and`, `or` and `not` properties which facilitate explicit logical operation:

```javascript
{ and: [ P1, P2, P3 ] }
{ or: [ P1, P2, P3 ] }
{ not: [ P1, P2, P3 ] }
```
are translated as
```
(P1 and P2 and P3)
(P1 or P2 or P3)
((not P1) and (not P2) and (not P3))
```

#### Expansion on multiple values

Some predicates accept array of values, they are generally translated to `or`, for example:

```javascript
{ path: [ P1, P2, P3 ] }
```
are translated as
```
(path: P1) or (path: P2) or (path: P3)
```

Some but not all are listed here, for detail consult the JSDoc description for each predicate.

| Predicate       | Logical operation on multiple values |
|-----------------|--------------------------------------|
| `path`          | `or`                                 |
| `type`          | `or`                                 |
| `nodename`      | `or`                                 |
| `language`      | `or`                                 |
| `fulltext`      | `and`                                |
| `excludePaths`  | `and`                                |
| `hasPermission` | `and`                                |


### Predicates

#### `contentfragment`

```javascript
{
    contentFragment: true
}
```

#### `excludepaths`

```javascript
{
    excludePaths: '/foo'
}
```

Multiple paths are grouped by an `and` operation:

```javascript
{
    excludePaths: ['/foo', '/bar']
}
```
```ini
1_excludepaths=/foo
2_excludepaths=/bar
```

#### `fulltext`

```javascript
{
    fulltext: 'foo'
}
```

To specify property or sub-node to search in:

```javascript
{
    fulltext: {
        keyword: 'foo',
        relPath: 'jcr:content/@cq:tags'
    }
}
```
```ini
fulltext=foo
fulltext.relPath=jcr:content/@cq:tags
```

#### `hasPermission`

```javascript
{
    hasPermission: ['jcr:write', 'jcr:modifyAccessControl']
}
```
```ini
hasPermission=jcr:write,jcr:modifyAccessControl
```

#### `language`

```javascript
{
    language: 'de'
}
```

#### `mainasset`

```javascript
{
    mainAsset: true
}
```

#### `nodename`

```javascript
{
    nodename: 'test*'
}
```

Multiple nodenames are grouped by an `or` operation:

```javascript
{
    nodename: ['foo*', 'bar*']
}
```
```ini
p.or=true
1_nodename=foo*
2_nodename=bar*
```

#### `notexpired`

Not supported.

#### `path`

```javascript
{
    path: '/foo'
}
```

Multiple paths are grouped by an `or` operation:

```javascript
{
    path: ['/foo', '/bar']
}
```
```ini
p.or=true
1_path=/foo
2_path=/bar
```

To match item with exact path:

```javascript
{
    path: QueryBuilder.scope.exact('/content/foo')
}
```
```ini
path=/content/foo
path.exact=true
```

To match only direct children of the path:


```javascript
{
    path: QueryBuilder.scope.children('/content/foo')
}
```
```ini
path=/content/foo
path.flat=true
```

Excluding paths is possible by translating into `not` groups:

```javascript
{
    path: [
        '/content',
        QueryBuilder.scope.exclude('/content/foo'),
        QueryBuilder.scope.exclude('/content/bar'),
    ]
}
```
```ini
path=/content
1_group.p.not=true
1_group.path=/content/foo
1_group.path.self=true
2_group.p.not=true
2_group.path=/content/bar
2_group.path.self=true
```

#### `savedquery`

Not supported.

#### `similar`

Not supported.

#### `type`

```javascript
{
    type: 'cq:Page'
}
```

Multiple types are grouped by an `or` operation:

```javascript
{
    type: ['cq:Page', 'dam:Asset']
}
```
```ini
p.or=true
1_type=cq:Page
2_type=dam:Asset
```

### Property predicates

#### `boolproperty`

```javascript
{
    where: {
        'jcr:isCheckedOut': { eq: true }
    }
}
```
```ini
boolproperty=jcr:isCheckedOut
boolproperty.value=true
```

Boolean equality predicate can be shorthanded as:

```javascript
{
    where: {
        'jcr:isCheckedOut': true
    }
}
```

#### `dateComparison`

```javascript
{
    where: {
        foo: { eq: QueryBuilder.ref('bar', 'date') }
    }
}
```
```ini
dateComparison.property1=foo
dateComparison.property2=bar
dateComparison.operation=equals
```

Less than (`<`) and less than or equal (`<=`) operation are converted to greater than (`greater`) and greater than or equal (`>=`) by swapping the properties:


```javascript
{
    where: {
        foo: { lt: QueryBuilder.ref('bar', 'date') }
    }
}
```
```ini
dateComparison.property1=bar
dateComparison.property2=foo
dateComparison.operation=greater
```

#### `daterange`

```javascript
{
    where: {
        foo: {
            le: new Date(2021, 10, 1)
        }
    }
}
```
```ini
daterange.property=foo
daterange.upperBound=2021-11-01T00:00:00.000Z
daterange.upperOperation=<=
```

#### `memberOf`

Not supported.

#### `property`

```javascript
{
    where: {
        'jcr:title': { eq: 'bar' }
    }
}
```
```ini
property=jcr:title
property.value=bar
property.operation=equals
```

Multiple values are supported:

```javascript
{
    where: {
        'jcr:title': { eq: ['foo', 'bar'] }
    }
}
```
```ini
property=jcr:title
property.1_value=foo
property.2_value=bar
property.operation=equals
```

Equals operation can be shortand as:

```javascript
{
    where: {
        'jcr:title': ['foo', 'bar']
    }
}
```

#### `rangeproperty`

```javascript
{
    where: {
        foo: {
            le: 1
        }
    }
}
```
```ini
rangeproperty.property=foo
rangeproperty.upperBound=1
rangeproperty.upperOperation=<=
```

#### `relativedaterange`

```javascript
{
    where: {
        'jcr:created': {
            within: ['-1y', '1y']
        }
    }
}
```
```ini
relativedaterange.property=jcr:created
relativedaterange.lowerBound=-1y
relativedaterange.upperBound=1y
```

#### `tag`

Not supported.

#### `tagid`

```javascript
{
    where: {
        'cq:tags': {
            containsAny: ['marketing:interest/product', 'marketing:interest/other']
        }
    }
}
```
```ini
tagid.1_value=marketing:interest/product
tagid.2_value=marketing:interest/other
tagid.property=cq:tags
```

To require all tags are present, specifies `containsAll` instead:

```javascript
{
    where: {
        'cq:tags': {
            containsAll: ['marketing:interest/product', 'marketing:interest/other']
        }
    }
}
```
```ini
tagid.1_value=marketing:interest/product
tagid.2_value=marketing:interest/other
tagid.property=cq:tags
tagid.all=true
```

#### `tagsearch`

```javascript
{
    where: {
        'cq:tags': {
            keyword: 'foo',
            language: 'de', /* optional */
            fulltext: true  /* optional */
        }
    }
}
```
```ini
tagsearch=foo
tagsearch.property=cq:tags
tagsearch.lang=de
tagsearch.all=true
```

### Predicate group

Groups are generated when `or`, `and` and `not` is specified:

```javascript
{
    or: [
        { path: '/foo', nodename: 'foo*' },
        { path: '/bar', nodename: 'bar*' }
    ]
}
```
```ini
p.or=true
1_group.path=/foo
1_group.nodename=foo*
2_group.path=/bar
2_group.nodename=bar*
```

### Result controlling parameters

```javascript
{
    nodeDepth: 1,
    offset: 10,
    limit: 10,
    facets: true,
    guessTotal: true,
    excerpt: true,
    select: '*'
}
```
```ini
p.nodedepth=1
p.offset=10
p.limit=10
p.facets=true
p.guessTotal=true
p.excerpt=true
p.hits=full
```

> **Note**: `p.limit=-1` is always generated if `limit` is not specified.

To limit only wanted properties in returned result:

```javascript
{
    select: ['jcr:title', 'jcr:created']
}
```
```ini
p.hits=selective
p.properties=jcr:title jcr:created
```

### Sorting results

```javascript
{
    orderBy: ['path', 'nodename', 'jcr:title']
}
```
```ini
1_orderby=path
2_orderby=nodename
3_orderby=@jcr:title
```
> **Note**: Property other than `name` and `nodename` are automatically prefixed with `@` character.

Explicitly prefix with `@` character for reserved property names:

```javascript
{
    orderBy: ['@path', '@nodename']
}
```
```ini
1_orderby=@path
2_orderby=@nodename
```

For descending and case-insensitive case:

```javascript
{
    orderBy: [
        {
            property: 'jcr:title',
            descending: true,
            ignoreCase: true
        }
    ]
}
```
```ini
orderby=@jcr:title
orderby.sort=desc
orderby.case=ignore
```

## Extending query builder

### Custom predicate

Support for custom predicates can be achieved by adding new `PredicateHandler` to `QueryBuilder.predicates`.

```javascript
QueryBuilder.predicates.custom = (builder, value, key, p, q) => {
    // key = name of the predicate, "custom" in this case
    // p   = root or nested predicate being processed (p === q for root case)
    // q   = the QueryBuilder object being processed
    builder.append('custom', `Value is ${value}`);
};
new QueryBuilder({
    custom: 1
}).toJSON();
```
will return:
```json
{
    "custom": "Value is 1",
    "p.limit": "-1"
}
```

Custom predicates can be type-checked by using type argument when creating `QueryBuilder` object:

```typescript
import QueryBuilder from "aem-querybuilder";

interface CustomPredicate extends QueryBuilder.Predicate {
    custom: number
}

// type-checking support for implementing custom predicate handler
(QueryBuilder as QueryBuilder.Static<CustomPredicate>).predicates.custom = (builder, value, key, p, q) => {
    /* ... */
};

// type-checking support for using custom predicate in building query
new QueryBuilder<CustomPredicate>({
    custom: 1
});
```

### Custom property predicate

Custom property predicate can be added by registering a sub-class of `PropertyPredicate`:

```javascript
QueryBuilder.PropertyPredicate.register(
    class extends QueryBuilder.PropertyPredicate {
        // parameter name that predicate evaluators in AEM recognizes
        static rootName = 'custom';

        constructor(property, props) {
            // predicate values will be propagated and be accessible from this object
            // through the super constructor
            super(property, props);
        }

        // checks whether this class should be instantiated
        // to process a given predicate
        static shouldProcess(props) {
            return props.customValue !== undefined;
        }

        *generateEntries() {
            yield ['property', this.property];
            yield ['value', `Value is ${this.customValue}`];
        }
    }
);
new QueryBuilder({
    where: {
        property: {
            customValue: 1
        }
    }
}).toJSON();
```
will return:
```json
{
    "custom.property": "property",
    "custom.value": "Value is 1",
    "p.limit": "-1"
}
```

Custom property predicates can be type-checked by type argument of the `Predicate` interface and
and the `PropertyPredicate` base class:

```typescript
import QueryBuilder from "aem-querybuilder";

interface CustomPropertyPredicateProps {
    customValue: number;
}
type CustomPredicate = QueryBuilder.Predicate<CustomPropertyPredicateProps>;

// type-checking support for implementing custom property predicate
QueryBuilder.PropertyPredicate.register(
    class extends QueryBuilder.PropertyPredicate<CustomPropertyPredicateProps> {
        /* ... */
    }
);

// type-checking support for using custom property predicate in building query
new QueryBuilder<CustomPredicate>({
    where: {
        property: {
            customValue: 1
        }
    }
});
```

### Leveraging existing property predicates

A shorthand property predicates can be implemented with the `PropertyPredicate.fromProps` utility that
generates a normalized list of `PropertyPredicate` objects from the given predicate.

```javascript
class CustomPropertyPredicate extends QueryBuilder.PropertyPredicate {
    static rootName = 'custom';

    normalize() {
        return QueryBuilder.PropertyPredicate.fromProps(this.property, {
            /* ... */
        });
    }
}
```

### Expanding to complex conditions

To reach further out, the default behavior of `PropertyPredicate.emit` can be overriden to
emit more complex conditions that fall outside the matching property node itself:

```javascript
class CustomPropertyPredicate extends QueryBuilder.PropertyPredicate {
    static rootName = 'custom';

    emit(builder) {
        builder.append({
            nodename: 'foo*',
            where: {
                [this.property]: { /* ... */ }
            }
        });
    }
}
```
