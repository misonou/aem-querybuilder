const assert = require('assert');
const { URLSearchParams } = require('url');
const QueryBuilder = require('../src');

/**
 * @param {QueryProps} props
 * @param {Record<string, any>} expected
 */
function verifyOutput(props, expected) {
    if (!expected['p.limit']) {
        expected['p.limit'] = '-1';
    }
    const q = new QueryBuilder(props);
    assert.deepEqual(q.toJSON(), expected);
    assert.deepEqual(q.toString().split('&').sort(), new URLSearchParams(expected).toString().split('&').sort());
}

/**
 * @param {QueryProps} props
 */
function shouldThrow(props) {
    assert.throws(function () {
        new QueryBuilder(props).toJSON();
    });
}

describe('QueryBuilder.ref', function () {
    it('should return an object with property and type properties', function () {
        assert.deepEqual(QueryBuilder.ref('prop', 'date'), { property: 'prop', type: 'date' });
    });
    it('should return a non-plain object', () => {
        assert.notEqual(Object.getPrototypeOf(QueryBuilder.ref('', 'date')), Object.prototype);
    });
});

describe('QueryBuilder.scope', function () {
    it('should create correct path filter parameters', function () {
        assert.deepEqual(QueryBuilder.scope.exact('/path'), {
            path: '/path',
            scope: 'exact'
        });
        assert.deepEqual(QueryBuilder.scope.children('/path'), {
            path: '/path',
            scope: 'children'
        });
        assert.deepEqual(QueryBuilder.scope.recursive('/path'), {
            path: '/path',
            scope: 'recursive'
        });
        assert.deepEqual(QueryBuilder.scope.exclude('/path'), {
            path: '/path',
            scope: 'exclude'
        });
    });
});

describe('Predicate', function () {
    it('should always treat group as AND if there is more than one type of predicates', function () {
        verifyOutput({
            path: ['/foo', '/bar'],
            language: 'de'
        }, {
            'group.p.or': 'true',
            'group.1_path': '/foo',
            'group.2_path': '/bar',
            'language': 'de'
        });
        verifyOutput({
            path: ['/foo', '/bar'],
            nodename: ['foo*', 'bar*']
        }, {
            '1_group.p.or': 'true',
            '1_group.1_path': '/foo',
            '1_group.2_path': '/bar',
            '2_group.p.or': 'true',
            '2_group.1_nodename': 'foo*',
            '2_group.2_nodename': 'bar*',
        });
        verifyOutput({
            or: [
                { path: '/content/foo', nodename: 'foo*' },
                { nodename: 'test*' }
            ],
        }, {
            'p.or': 'true',
            'nodename': 'test*',
            'group.path': '/content/foo',
            'group.nodename': 'foo*',
        });
    });
});

describe('Predicate.and', function () {
    it('should emit group without p.or or p.not parameter', function () {
        verifyOutput({
            not: {
                and: [{ path: '/content/foo' }, { nodename: 'foo*' }]
            }
        }, {
            'p.not': 'true',
            'group.path': '/content/foo',
            'group.nodename': 'foo*',
        });
    });
});

describe('Predicate.or', function () {
    it('should emit group with p.or parameter', function () {
        verifyOutput({
            or: [
                { path: '/content/foo', nodename: 'foo*' },
                { path: '/content/bar', nodename: 'bar*' },
            ],
            nodename: 'test*'
        }, {
            'nodename': 'test*',
            'group.p.or': 'true',
            'group.1_group.path': '/content/foo',
            'group.1_group.nodename': 'foo*',
            'group.2_group.path': '/content/bar',
            'group.2_group.nodename': 'bar*'
        });
    });
    it('should emit p.or parameter at root level if there are no other predicates', function () {
        verifyOutput({
            or: [
                { path: '/content/foo', nodename: 'foo*' },
                { path: '/content/bar', nodename: 'bar*' },
            ]
        }, {
            'p.or': 'true',
            '1_group.path': '/content/foo',
            '1_group.nodename': 'foo*',
            '2_group.path': '/content/bar',
            '2_group.nodename': 'bar*'
        });
    });
    it('should be ignored when specified an empty array', function () {
        verifyOutput({
            or: []
        }, {});
    });
});

describe('Predicate.not', function () {
    it('should emit group with p.not parameter', function () {
        verifyOutput({
            not: {
                path: '/content'
            },
            nodename: 'test*'
        }, {
            'nodename': 'test*',
            'group.p.not': 'true',
            'group.path': '/content'
        });
    });
    it('should emit p.not parameter at root level if there are no other predicates', function () {
        verifyOutput({
            not: {
                path: '/content'
            }
        }, {
            'p.not': 'true',
            'path': '/content'
        });
    });
    it('should emit multiple groups with p.not parameter when specified an array', function () {
        verifyOutput({
            not: [
                { path: '/foo' },
                { path: '/bar' },
            ]
        }, {
            '1_group.p.not': 'true',
            '1_group.path': '/foo',
            '2_group.p.not': 'true',
            '2_group.path': '/bar'
        });
    });
    it('should not collapse nested NOT groups', function () {
        verifyOutput({
            not: {
                not: { path: '/foo' }
            }
        }, {
            'p.not': 'true',
            'group.p.not': 'true',
            'group.path': '/foo'
        });
    });
});

describe('Predicate.path', function () {
    it('should emit path parameter when specified', function () {
        verifyOutput({
            path: '/content'
        }, {
            'path': '/content'
        });
    });
    it('should emit path.self parameter when includeSelf is specified true', function () {
        verifyOutput({
            path: {
                path: '/content',
                includeSelf: true
            }
        }, {
            'path': '/content',
            'path.self': 'true'
        });
    });
    it('should emit path.exact parameter when scope is specified exact', function () {
        verifyOutput({
            path: {
                path: '/content',
                scope: 'exact'
            }
        }, {
            'path': '/content',
            'path.exact': 'true'
        });
    });
    it('should emit path.flat parameter when scope is specified children', function () {
        verifyOutput({
            path: {
                path: '/content',
                scope: 'children'
            }
        }, {
            'path': '/content',
            'path.flat': 'true'
        });
    });
    it('should not emit path.* parameter when scope is specified recursive', function () {
        verifyOutput({
            path: {
                path: '/content',
                scope: 'recursive'
            }
        }, {
            'path': '/content'
        });
    });
    it('should emit N_path parameters within OR group for multiple paths', function () {
        verifyOutput({
            path: ['/content', '/home']
        }, {
            'p.or': 'true',
            '1_path': '/content',
            '2_path': '/home'
        });
        verifyOutput({
            path: ['/content', '/home'],
            nodename: 'test*'
        }, {
            'group.p.or': 'true',
            'group.1_path': '/content',
            'group.2_path': '/home',
            'nodename': 'test*'
        });
    });
    it('should be ignored when specified an empty array', function () {
        verifyOutput({
            path: []
        }, {});
    });
    it('should handle multiple paths containing exclude-scoped correctly', function () {
        verifyOutput({
            path: [
                '/content',
                QueryBuilder.scope.exclude('/content/foo'),
                QueryBuilder.scope.exclude('/content/bar'),
            ]
        }, {
            'path': '/content',
            '1_group.p.not': 'true',
            '1_group.path': '/content/foo',
            '1_group.path.self': 'true',
            '2_group.p.not': 'true',
            '2_group.path': '/content/bar',
            '2_group.path.self': 'true'
        });
        verifyOutput({
            path: [
                '/content',
                '/another',
                QueryBuilder.scope.exclude('/content/foo'),
                QueryBuilder.scope.exclude('/content/bar'),
            ]
        }, {
            '1_group.p.not': 'true',
            '1_group.path': '/content/foo',
            '1_group.path.self': 'true',
            '2_group.p.not': 'true',
            '2_group.path': '/content/bar',
            '2_group.path.self': 'true',
            '3_group.1_path': '/content',
            '3_group.2_path': '/another',
            '3_group.p.or': 'true'
        });
    });
});

describe('Predicate.excludePaths', function () {
    it('should emit excludepaths parameter when specified', function () {
        verifyOutput({
            excludePaths: 'foo'
        }, {
            'excludepaths': 'foo'
        });
    });
    it('should emit N_excludepaths parameters when specified an array', function () {
        verifyOutput({
            excludePaths: ['foo', 'bar']
        }, {
            '1_excludepaths': 'foo',
            '2_excludepaths': 'bar'
        });
    });
    it('should emit N_excludepaths parameter within AND group for multiple paths', function () {
        verifyOutput({
            or: [
                { excludePaths: ['foo', 'bar'] },
                { nodename: 'test*' }
            ]
        }, {
            'p.or': 'true',
            'group.1_excludepaths': 'foo',
            'group.2_excludepaths': 'bar',
            'nodename': 'test*'
        });
    });
});

describe('Predicate.type', function () {
    it('should emit type parameter when specified', function () {
        verifyOutput({
            type: 'cq:Page'
        }, {
            'type': 'cq:Page'
        });
    });
    it('should emit OR group for multiple types', function () {
        verifyOutput({
            type: ['cq:Page', 'dam:Asset']
        }, {
            'p.or': 'true',
            '1_type': 'cq:Page',
            '2_type': 'dam:Asset'
        });
    });
});

describe('Predicate.nodename', function () {
    it('should emit nodename parameter when specified', function () {
        verifyOutput({
            nodename: '*.json'
        }, {
            'nodename': '*.json'
        });
    });
    it('should emit OR group for multiple nodenames', function () {
        verifyOutput({
            nodename: ['*.json', '*.txt']
        }, {
            'p.or': 'true',
            '1_nodename': '*.json',
            '2_nodename': '*.txt'
        });
    });
});

describe('Predicate.hasPermission', function () {
    it('should emit hasPermission parameter with comma-separated value when specified', function () {
        verifyOutput({
            hasPermission: ['jcr:write', 'jcr:modifyAccessControl']
        }, {
            'hasPermission': 'jcr:write,jcr:modifyAccessControl'
        });
    });
});

describe('Predicate.contentFragment', function () {
    it('should emit contentfragment parameter when specified', function () {
        verifyOutput({
            contentFragment: true
        }, {
            'contentfragment': 'true'
        });
        verifyOutput({
            contentFragment: false
        }, {
            'contentfragment': 'false'
        });
    });
});

describe('Predicate.mainAsset', function () {
    it('should emit mainasset parameter when specified', function () {
        verifyOutput({
            mainAsset: true
        }, {
            'mainasset': 'true'
        });
        verifyOutput({
            mainAsset: false
        }, {
            'mainasset': 'false'
        });
    });
});

describe('Predicate.language', function () {
    it('should emit language parameter when specified', function () {
        verifyOutput({
            language: 'de'
        }, {
            'language': 'de'
        });
    });
    it('should emit OR group for multiple types', function () {
        verifyOutput({
            language: ['en', 'de']
        }, {
            'p.or': 'true',
            '1_language': 'en',
            '2_language': 'de'
        });
    });
});

describe('Predicate.where', function () {
    it('should be equivalent to property predicate with operation "equals" when specified string values', function () {
        verifyOutput({
            where: {
                'jcr:title': 'bar'
            }
        }, {
            'property': 'jcr:title',
            'property.value': 'bar',
            'property.operation': 'equals'
        });
        verifyOutput({
            where: {
                'jcr:title': ['foo', 'bar']
            }
        }, {
            'property': 'jcr:title',
            'property.1_value': 'foo',
            'property.2_value': 'bar',
            'property.operation': 'equals'
        });
    });
    it('should be equivalent to boolproperty predicate when specified boolean values', function () {
        verifyOutput({
            where: {
                'jcr:isCheckedOut': true
            }
        }, {
            'boolproperty': 'jcr:isCheckedOut',
            'boolproperty.value': 'true'
        });
        verifyOutput({
            where: {
                'jcr:isCheckedOut': false
            }
        }, {
            'boolproperty': 'jcr:isCheckedOut',
            'boolproperty.value': 'false'
        });
    })
    it('should not return parameter for unknown predicate', function () {
        verifyOutput({
            where: {
                // @ts-ignore
                property: { unknown: 1 }
            }
        }, {});
    });
});

describe('Predicate.fulltext', function () {
    it('should emit fulltext parameter when specified', function () {
        verifyOutput({
            fulltext: 'Test'
        }, {
            'fulltext': 'Test'
        });
    });
    it('should emit fulltext.relPath parameter when relPath is specified', function () {
        verifyOutput({
            fulltext: {
                keyword: 'Test',
                relPath: 'jcr:content/@cq:tags'
            }
        }, {
            'fulltext': 'Test',
            'fulltext.relPath': 'jcr:content/@cq:tags',
        });
    });
});

describe('QueryProps.nodeDepth', function () {
    it('should emit p.nodedepth parameter when specified true', function () {
        verifyOutput({
            nodeDepth: 10
        }, {
            'p.nodedepth': '10'
        });
    });
    it('should not emit p.nodedepth parameter when specified falsy value', function () {
        verifyOutput({
            nodeDepth: 0
        }, {});
        verifyOutput({
            nodeDepth: undefined
        }, {});
    });
});

describe('QueryProps.offset', function () {
    it('should emit p.offset parameter when specified true', function () {
        verifyOutput({
            offset: 10
        }, {
            'p.offset': '10'
        });
    });
    it('should not emit p.offset parameter when specified falsy value', function () {
        verifyOutput({
            offset: 0
        }, {});
        verifyOutput({
            offset: undefined
        }, {});
    });
});

describe('QueryProps.limit', function () {
    it('should emit p.limit parameter', function () {
        verifyOutput({
            limit: 1
        }, {
            'p.limit': '1'
        });
    });
    it('should emit p.limit parameter with value "-1" when not specified or is falsy', function () {
        verifyOutput({}, {
            'p.limit': '-1'
        });
        verifyOutput({
            limit: undefined
        }, {
            'p.limit': '-1'
        });
        verifyOutput({
            limit: 0
        }, {
            'p.limit': '-1'
        });
    });
});

describe('QueryProps.facets', function () {
    it('should emit p.facets parameter when specified true', function () {
        verifyOutput({
            facets: true
        }, {
            'p.facets': 'true'
        });
    });
    it('should not emit p.facets parameter when specified falsy value', function () {
        verifyOutput({
            facets: false
        }, {});
        verifyOutput({
            facets: undefined
        }, {});
    });
});

describe('QueryProps.guessTotal', function () {
    it('should emit p.guessTotal parameter when specified true', function () {
        verifyOutput({
            guessTotal: true
        }, {
            'p.guesstotal': 'true'
        });
    });
    it('should not emit p.guessTotal parameter when specified falsy value', function () {
        verifyOutput({
            guessTotal: false
        }, {});
        verifyOutput({
            guessTotal: undefined
        }, {});
    });
});

describe('QueryProps.excerpt', function () {
    it('should emit p.excerpt parameter when specified true', function () {
        verifyOutput({
            excerpt: true
        }, {
            'p.excerpt': 'true'
        });
    });
    it('should not emit p.excerpt parameter when specified falsy value', function () {
        verifyOutput({
            excerpt: false
        }, {});
        verifyOutput({
            excerpt: undefined
        }, {});
    });
});

describe('QueryProps.select', function () {
    it('should emit p.hits parameter with value "full" when specified "*"', function () {
        verifyOutput({
            select: '*'
        }, {
            'p.hits': 'full'
        });
    });
    it('should emit p.hits parameter with value "selective" and p.properties when specified an array', function () {
        verifyOutput({
            select: ['prop1']
        }, {
            'p.hits': 'selective',
            'p.properties': 'prop1'
        });
    });
    it('should emit p.properties parameter as an whitespace-separated string', function () {
        verifyOutput({
            select: ['prop1', 'sub/prop']
        }, {
            'p.hits': 'selective',
            'p.properties': 'prop1 sub/prop'
        });
    });
});

describe('QueryProps.orderBy', function () {
    it('should emit orderby parameter prefixed with @', () => {
        verifyOutput({
            orderBy: 'jcr:score'
        }, {
            'orderby': '@jcr:score'
        });
        verifyOutput({
            orderBy: '@jcr:score'
        }, {
            'orderby': '@jcr:score'
        });
    });
    it('should emit orderby parameter for special property path and nodename without @ prefix', () => {
        verifyOutput({
            orderBy: 'path'
        }, {
            'orderby': 'path'
        });
        verifyOutput({
            orderBy: 'nodename'
        }, {
            'orderby': 'nodename'
        });
    });
    it('should emit N_orderby parameters when specified an array', () => {
        verifyOutput({
            orderBy: ['jcr:score', 'jcr:title']
        }, {
            '1_orderby': '@jcr:score',
            '2_orderby': '@jcr:title'
        });
    });
    it('should emit orderby.sort parameter when descending is specified', () => {
        verifyOutput({
            orderBy: {
                property: 'jcr:score',
                descending: true
            }
        }, {
            'orderby': '@jcr:score',
            'orderby.sort': 'desc'
        });
        verifyOutput({
            orderBy: [
                'jcr:title',
                {
                    property: 'jcr:score',
                    descending: true
                }
            ]
        }, {
            '1_orderby': '@jcr:title',
            '2_orderby': '@jcr:score',
            '2_orderby.sort': 'desc'
        });
    });
    it('should emit orderby.case parameter when ignoreCase is specified', () => {
        verifyOutput({
            orderBy: {
                property: 'jcr:score',
                ignoreCase: true
            }
        }, {
            'orderby': '@jcr:score',
            'orderby.case': 'ignore'
        });
        verifyOutput({
            orderBy: [
                'jcr:title',
                {
                    property: 'jcr:score',
                    ignoreCase: true
                }
            ]
        }, {
            '1_orderby': '@jcr:title',
            '2_orderby': '@jcr:score',
            '2_orderby.case': 'ignore'
        });
    });
});

describe('PropertyDefaultPredicateProps', function () {
    it('should emit property parameter with operation "equals" when eq is specified', function () {
        verifyOutput({
            where: {
                'jcr:title': { eq: 'bar' }
            }
        }, {
            'property': 'jcr:title',
            'property.value': 'bar',
            'property.operation': 'equals'
        });
        verifyOutput({
            where: {
                'jcr:title': { eq: ['foo', 'bar'] }
            }
        }, {
            'property': 'jcr:title',
            'property.1_value': 'foo',
            'property.2_value': 'bar',
            'property.operation': 'equals'
        });
    });
    it('should emit property parameter with operation "unequals" when ne is specified', function () {
        verifyOutput({
            where: {
                'jcr:title': { ne: 'bar' }
            }
        }, {
            'property': 'jcr:title',
            'property.value': 'bar',
            'property.operation': 'unequals'
        });
        verifyOutput({
            where: {
                'jcr:title': { ne: ['foo', 'bar'] }
            }
        }, {
            'property': 'jcr:title',
            'property.1_value': 'foo',
            'property.2_value': 'bar',
            'property.operation': 'unequals'
        });
    });
    it('should emit property parameter with operation "like" when like is specified', function () {
        verifyOutput({
            where: {
                'jcr:title': { like: 'bar' }
            }
        }, {
            'property': 'jcr:title',
            'property.value': 'bar',
            'property.operation': 'like'
        });
        verifyOutput({
            where: {
                'jcr:title': { like: ['foo', 'bar'] }
            }
        }, {
            'property': 'jcr:title',
            'property.1_value': 'foo',
            'property.2_value': 'bar',
            'property.operation': 'like'
        });
    });
    it('should emit property parameter with operation "exists" when exists is true', function () {
        verifyOutput({
            where: {
                'jcr:title': { exists: true }
            }
        }, {
            'property': 'jcr:title',
            'property.value': 'true',
            'property.operation': 'exists'
        });
    });
    it('should emit property parameter with operation "not" when exists is false', function () {
        verifyOutput({
            where: {
                'jcr:title': { exists: false }
            }
        }, {
            'property': 'jcr:title',
            'property.value': 'true',
            'property.operation': 'not'
        });
    });
    it('should emit property parameter with operation "like" in NOT group when notLike is specified', function () {
        verifyOutput({
            where: {
                'jcr:title': { notLike: 'bar' }
            }
        }, {
            'p.not': 'true',
            'property': 'jcr:title',
            'property.value': 'bar',
            'property.operation': 'like'
        });
        verifyOutput({
            where: {
                'jcr:title': { notLike: ['foo', 'bar'] }
            }
        }, {
            'p.not': 'true',
            'property': 'jcr:title',
            'property.1_value': 'foo',
            'property.2_value': 'bar',
            'property.operation': 'like'
        });
    });
    it('should emit property.depth when depth is specified', function () {
        verifyOutput({
            where: {
                'jcr:title': { eq: 'bar', depth: 1 }
            }
        }, {
            'property': 'jcr:title',
            'property.value': 'bar',
            'property.operation': 'equals',
            'property.depth': '1'
        });
    });
    it('should throw error when more than one operation is specified', function () {
        shouldThrow({
            where: {
                'jcr:title': {
                    eq: 'foo',
                    ne: 'bar'
                }
            }
        });
    });
});

describe('PropertyBooleanPredicateProps', function () {
    it('should emit boolproperty parameter', function () {
        verifyOutput({
            where: {
                'jcr:isCheckedOut': { eq: true }
            }
        }, {
            'boolproperty': 'jcr:isCheckedOut',
            'boolproperty.value': 'true'
        });
        verifyOutput({
            where: {
                'jcr:isCheckedOut': { eq: false }
            }
        }, {
            'boolproperty': 'jcr:isCheckedOut',
            'boolproperty.value': 'false'
        });
    });
});

describe('PropertyDateComparisonPredicateProps', function () {
    it('should emit dateComparison parameter with operation "equals" when eq is specified', function () {
        verifyOutput({
            where: {
                foo: { eq: QueryBuilder.ref('bar', 'date') }
            }
        }, {
            'dateComparison.property1': 'foo',
            'dateComparison.property2': 'bar',
            'dateComparison.operation': 'equals'
        });
    });
    it('should emit dateComparison parameter with operation "!=" when ne is specified', function () {
        verifyOutput({
            where: {
                foo: { ne: QueryBuilder.ref('bar', 'date') }
            }
        }, {
            'dateComparison.property1': 'foo',
            'dateComparison.property2': 'bar',
            'dateComparison.operation': '!='
        });
    });
    it('should emit dateComparison parameter with operation "greater" when gt is specified', function () {
        verifyOutput({
            where: {
                foo: { gt: QueryBuilder.ref('bar', 'date') }
            }
        }, {
            'dateComparison.property1': 'foo',
            'dateComparison.property2': 'bar',
            'dateComparison.operation': 'greater'
        });
    });
    it('should emit dateComparison parameter with operation ">=" when ge is specified', function () {
        verifyOutput({
            where: {
                foo: { ge: QueryBuilder.ref('bar', 'date') }
            }
        }, {
            'dateComparison.property1': 'foo',
            'dateComparison.property2': 'bar',
            'dateComparison.operation': '>='
        });
    });
    it('should emit dateComparison parameter with operation ">=" and properties swapped when lt is specified', function () {
        verifyOutput({
            where: {
                foo: { lt: QueryBuilder.ref('bar', 'date') }
            }
        }, {
            'dateComparison.property1': 'bar',
            'dateComparison.property2': 'foo',
            'dateComparison.operation': '>='
        });
    });
    it('should emit dateComparison parameter with operation "greater" and properties swapped when le is specified', function () {
        verifyOutput({
            where: {
                foo: { le: QueryBuilder.ref('bar', 'date') }
            }
        }, {
            'dateComparison.property1': 'bar',
            'dateComparison.property2': 'foo',
            'dateComparison.operation': 'greater'
        });
    });
    it('should emit AND group if more than 1 property is specified', function () {
        verifyOutput({
            where: {
                foo: {
                    eq: QueryBuilder.ref('bar', 'date'),
                    ne: QueryBuilder.ref('baz', 'date')
                }
            }
        }, {
            '1_dateComparison.property1': 'foo',
            '1_dateComparison.property2': 'bar',
            '1_dateComparison.operation': 'equals',
            '2_dateComparison.property1': 'foo',
            '2_dateComparison.property2': 'baz',
            '2_dateComparison.operation': '!='
        });
    });
});

describe('PropertyDateRangePredicateProps', function () {
    let d = new Date();
    let s = d.toISOString();
    it('should emit daterange parameter with upperBound', function () {
        verifyOutput({
            where: {
                foo: {
                    le: d
                }
            }
        }, {
            'daterange.property': 'foo',
            'daterange.upperBound': s,
            'daterange.upperOperation': '<='
        });
        verifyOutput({
            where: {
                foo: {
                    lt: d
                }
            }
        }, {
            'daterange.property': 'foo',
            'daterange.upperBound': s,
            'daterange.upperOperation': '<'
        });
    });
    it('should emit daterange parameter with lowerBound', function () {
        verifyOutput({
            where: {
                foo: {
                    ge: d
                }
            }
        }, {
            'daterange.property': 'foo',
            'daterange.lowerBound': s,
            'daterange.lowerOperation': '>='
        });
        verifyOutput({
            where: {
                foo: {
                    gt: d
                }
            }
        }, {
            'daterange.property': 'foo',
            'daterange.lowerBound': s,
            'daterange.lowerOperation': '>'
        });
    });
    it('should throw if both le or lt, ge or gt are both specified', function () {
        shouldThrow({
            where: {
                foo: {
                    le: d,
                    lt: d
                }
            }
        });
        shouldThrow({
            where: {
                foo: {
                    le: d,
                    lt: d
                }
            }
        });
    });
});

describe('PropertyLogicalPredicateProps', function () {
    it('should emit nested predicates within OR group', function () {
        verifyOutput({
            where: {
                'jcr:title': {
                    or: [
                        { eq: 'foo' },
                        { eq: 'bar' }
                    ]
                }
            }
        }, {
            'p.or': 'true',
            '1_property': 'jcr:title',
            '1_property.value': 'foo',
            '1_property.operation': 'equals',
            '2_property': 'jcr:title',
            '2_property.value': 'bar',
            '2_property.operation': 'equals',
        });
    });
    it('should emit child predicates in the same group when operation is the same', function () {
        verifyOutput({
            or: [
                {
                    nodename: 'test*'
                },
                {
                    where: {
                        'jcr:title': {
                            or: [
                                { eq: 'foo' },
                                { eq: 'bar' }
                            ]
                        }
                    }
                }
            ]
        }, {
            'p.or': 'true',
            'nodename': 'test*',
            '1_property': 'jcr:title',
            '1_property.value': 'foo',
            '1_property.operation': 'equals',
            '2_property': 'jcr:title',
            '2_property.value': 'bar',
            '2_property.operation': 'equals',
        });
    });
});

describe('PropertyRangePredicateProps', function () {
    it('should emit rangeproperty parameter with upperBound', function () {
        verifyOutput({
            where: {
                foo: {
                    le: 1
                }
            }
        }, {
            'rangeproperty.property': 'foo',
            'rangeproperty.upperBound': '1',
            'rangeproperty.upperOperation': '<='
        });
        verifyOutput({
            where: {
                foo: {
                    lt: 1
                }
            }
        }, {
            'rangeproperty.property': 'foo',
            'rangeproperty.upperBound': '1',
            'rangeproperty.upperOperation': '<'
        });
    });
    it('should emit rangeproperty parameter with lowerBound', function () {
        verifyOutput({
            where: {
                foo: {
                    ge: 1
                }
            }
        }, {
            'rangeproperty.property': 'foo',
            'rangeproperty.lowerBound': '1',
            'rangeproperty.lowerOperation': '>='
        });
        verifyOutput({
            where: {
                foo: {
                    gt: 1
                }
            }
        }, {
            'rangeproperty.property': 'foo',
            'rangeproperty.lowerBound': '1',
            'rangeproperty.lowerOperation': '>'
        });
    });
    it('should throw if both le or lt, ge or gt are both specified', function () {
        shouldThrow({
            where: {
                foo: {
                    le: 1,
                    lt: 1
                }
            }
        });
        shouldThrow({
            where: {
                foo: {
                    le: 1,
                    lt: 0
                }
            }
        });
    });
});

describe('PropertyRelativeDateRangePredicateProps', function () {
    it('should emit relativedaterange parameter', function () {
        verifyOutput({
            where: {
                'jcr:created': {
                    within: ['-1y', null]
                }
            }
        }, {
            'relativedaterange.property': 'jcr:created',
            'relativedaterange.lowerBound': '-1y'
        });
        verifyOutput({
            where: {
                'jcr:created': {
                    within: [null, '1y']
                }
            }
        }, {
            'relativedaterange.property': 'jcr:created',
            'relativedaterange.upperBound': '1y'
        });
        verifyOutput({
            where: {
                'jcr:created': {
                    within: ['-1y', '1y']
                }
            }
        }, {
            'relativedaterange.property': 'jcr:created',
            'relativedaterange.lowerBound': '-1y',
            'relativedaterange.upperBound': '1y'
        });
    });
});

describe('PropertyTagIDPredicateProps', function () {
    it('should emit tagid parameter', function () {
        verifyOutput({
            where: {
                'cq:tags': {
                    containsAny: 'marketing:interest/product'
                }
            }
        }, {
            'tagid': 'marketing:interest/product',
            'tagid.property': 'cq:tags'
        });
    });
    it('should emit tagid.N_value parameters when tagID is specified an array', function () {
        verifyOutput({
            where: {
                'cq:tags': {
                    containsAny: ['marketing:interest/product', 'marketing:interest/other']
                }
            }
        }, {
            'tagid.1_value': 'marketing:interest/product',
            'tagid.2_value': 'marketing:interest/other',
            'tagid.property': 'cq:tags'
        });
    });
    it('should emit tagid.all parameter when containsAllTags is true', function () {
        verifyOutput({
            where: {
                'cq:tags': {
                    containsAll: ['marketing:interest/product', 'marketing:interest/other']
                }
            }
        }, {
            'tagid.1_value': 'marketing:interest/product',
            'tagid.2_value': 'marketing:interest/other',
            'tagid.property': 'cq:tags',
            'tagid.and': 'true'
        });
    });
});

describe('PropertyTagSearchPredicateProps', function () {
    it('should emit tagsearch parameter', function () {
        verifyOutput({
            where: {
                'cq:tags': {
                    keyword: 'foo'
                }
            }
        }, {
            'tagsearch': 'foo',
            'tagsearch.property': 'cq:tags'
        });
    });
    it('should emit tagsearch.all parameters when all is true', function () {
        verifyOutput({
            where: {
                'cq:tags': {
                    keyword: 'foo',
                    fulltext: true
                }
            }
        }, {
            'tagsearch': 'foo',
            'tagsearch.property': 'cq:tags',
            'tagsearch.all': 'true'
        });
        verifyOutput({
            where: {
                'cq:tags': {
                    keyword: 'foo',
                    fulltext: false
                }
            }
        }, {
            'tagsearch': 'foo',
            'tagsearch.property': 'cq:tags'
        });
    });
    it('should emit tagsearch.lang parameter when language is specified', function () {
        verifyOutput({
            where: {
                'cq:tags': {
                    keyword: 'foo',
                    language: 'de',
                    fulltext: true
                }
            }
        }, {
            'tagsearch': 'foo',
            'tagsearch.property': 'cq:tags',
            'tagsearch.lang': 'de',
            'tagsearch.all': 'true'
        });
    });
});
