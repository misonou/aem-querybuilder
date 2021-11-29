/// <reference path="internal.d.ts" />

'use strict';

const toQueryString = (function () {
    /** @type {typeof import("url").URLSearchParams} */
    /* istanbul ignore next */
    // @ts-ignore
    let URLSearchParams = (typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : {}).URLSearchParams;
    /* istanbul ignore next */
    if (typeof URLSearchParams === 'function' && (typeof process === 'undefined' || process.env?.npm_lifecycle_event !== 'test')) {
        return function (/** @type {Generator<[string, string]>} */ props) {
            return new URLSearchParams(props).toString();
        };
    }
    // URLSearchParams use application/x-www-form-urlencoded encoding set and spaceAsPlus being true
    // swap encoded/unencoded form for inconsistent characters
    let repl = {
        '%20': '+',
        '!': '%21',
        '\'': '%27',
        '(': '%28',
        ')': '%29',
        '~': '%7E'
    };
    return function (/** @type {Generator<[string, string]>} */ props) {
        let arr = [];
        for (let [k, v] of props) {
            arr.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
        }
        return arr.join('&').replace(/%20|[!'()~]/g, v => repl[v] || /* istanbul ignore next */ v);
    };
})();

/** @type {LogicalOp[]} */
const logicalOps = ['or', 'and', 'not'];

/** @type {(typeof PropertyPredicate)[]} */
const filterTypes = [];

/** @type {<T>(a: ScalarOrArray<T>) => T[]} */
function makeArray(a) {
    return Array.isArray(a) ? a : a === undefined || a === null ? [] : [a];
}

/** @type {<T>(p: T, props: (keyof T)[]) => void} */
function checkMutualExclusiveProps(p, props) {
    if (props.filter(v => p[v] !== undefined)[1]) {
        throw new Error(`${props} properties cannot be specified at the same time`);
    }
}

/**
 * @param {Predicate} p
 */
function isLogicalPredicate(p) {
    for (let i in p) {
        if (i !== 'and' && i !== 'or' && i !== 'not') {
            return false;
        }
    }
    return true;
}

/**
 * @param {Predicate[]} and
 * @param {Predicate[]} or
 * @param {Predicate[]} not
 * @param {[string, LogicalOp, any][]} entries
 * @returns {LogicalOp | undefined}
 */
function getImplicitOp(and, or, not, entries) {
    if ((and.length + +!!or.length + not.length + entries.length) > 1) {
        return 'and';
    } else if (or.length > 1 || entries[0]?.[1] === 'or') {
        return 'or';
    } else if (not.length) {
        return 'not';
    }
}

class Ref {
    /**
     * @param {string} property
     * @param {string} type
     */
    constructor(property, type) {
        this.property = property;
        this.type = type;
    }
}

class OrderBy {
    /**
     * @param {string | OrderByProps} props
     */
    constructor(props) {
        if (typeof props === 'string') {
            props = { property: props };
        }
        Object.assign(this, props);
    }

    /**
     * @this {OrderBy & OrderByProps}
     * @returns {Generator<[string, string]>}
     */
    *generateEntries() {
        if (this.property === 'path' || this.property === 'nodename' || this.property[0] === '@') {
            yield ['_', this.property];
        } else {
            yield ['_', '@' + this.property];
        }
        if (this.descending) {
            yield ['sort', 'desc'];
        }
        if (this.ignoreCase) {
            yield ['case', 'ignore'];
        }
    }
}

class PathPredicate {
    /**
     * @param {string | PathPredicateProps} props
     */
    constructor(props) {
        if (typeof props === 'string') {
            props = { path: props };
        }
        Object.assign(this, props);
    }

    /**
     * @param {ScalarOrArray<string | PathPredicateProps>} values
     * @param {PredicateBuilder} builder
     */
    static fromProps(values, builder) {
        let excludes = [];
        let includes = [];
        for (let v of makeArray(values)) {
            if (typeof v === 'object' && v.scope === 'exclude') {
                excludes.push({ path: v.path, includeSelf: true });
            } else {
                includes.push(v);
            }
        }
        if (!excludes.length) {
            builder.append('path', includes.map(v => new PathPredicate(v)), 'or');
        } else {
            builder.append({
                path: includes,
                not: excludes.map(v => ({ path: v }))
            });
        }
    }

    /**
     * @this {PathPredicate & PathPredicateProps}
     * @returns {Generator<[string, string]>}
     */
    *generateEntries() {
        yield ['_', this.path];
        if (this.includeSelf) {
            yield ['self', 'true'];
        }
        switch (this.scope) {
            case 'children':
                yield ['flat', 'true'];
                break;
            case 'exact':
                yield ['exact', 'true'];
                break;
        }
    }
}

class FulltextPredicate {
    /**
     * @param {string | FulltextPredicateProps} props
     */
    constructor(props) {
        if (typeof props === 'string') {
            props = { keyword: props };
        }
        Object.assign(this, props);
    }

    /**
     * @this {FulltextPredicate & FulltextPredicateProps}
     * @returns {Generator<[string, string]>}
     */
    *generateEntries() {
        yield ['_', this.keyword];
        if (this.relPath) {
            yield ['relPath', this.relPath];
        }
    }
}

class PropertyPredicate {
    /**
     * @param {string} property
     * @param {Record<string, any>} props
     */
    constructor(property, props) {
        this.property = property;
        Object.assign(this, props);
    }

    /**
     * @param {string} property
     * @param {any} props
     */
    static fromProps(property, props) {
        if (typeof props !== 'object' || Array.isArray(props)) {
            props = { eq: props };
        }
        for (let t of filterTypes) {
            if (t.shouldProcess(props)) {
                return new t(property, props).normalize();
            }
        }
        return [];
    }

    /**
     * @param {(typeof PropertyPredicate)[]} args
     */
    static register(...args) {
        filterTypes.splice(1, 0, ...args);
    }

    /**
     * @param {any} props
     */
    /* istanbul ignore next */
    static shouldProcess(props) {
        return false;
    }

    /**
     * @returns {PropertyPredicate[]}
     */
    normalize() {
        return [this];
    }

    /**
     * @param {PredicateBuilder} builder
     */
    emit(builder) {
        // @ts-ignore
        let rootName = this.constructor.rootName;
        builder.append(rootName, this);
    }

    /**
     * @returns {Generator<[string, string]>}
     */
    /* istanbul ignore next */
    *generateEntries() {
    }
}

class PropertyDefaultPredicate extends PropertyPredicate {
    static rootName = 'property';

    /**
     * @param {string} name
     * @param {Record<string, any>} props
     * @this {PropertyPredicate & PropertyDefaultPredicateProps}
     */
    constructor(name, props) {
        super(name, props);
        checkMutualExclusiveProps(this, ['eq', 'ne', 'like', 'notLike', 'exists']);
    }

    static shouldProcess(props) {
        return ['eq', 'ne', 'like', 'notLike', 'exists'].some(v => props[v] !== undefined);
    }

    /**
     * @this {PropertyPredicate & PropertyDefaultPredicateProps}
     */
    normalize() {
        if (this.notLike) {
            return new PropertyLogicalPredicate(this.property, { not: { like: this.notLike, depth: this.depth } }).normalize();
        }
        return super.normalize();
    }

    /**
     * @this {PropertyPredicate & PropertyDefaultPredicateProps}
     * @returns {Generator<[string, string]>}
     */
    *generateEntries() {
        yield ['_', this.property];
        if (this.depth) {
            yield ['depth', String(this.depth)];
        }
        let arr = this.eq || this.ne || this.like;
        if (!arr) {
            yield ['operation', this.exists ? 'exists' : 'not'];
            yield ['value', 'true'];
        } else {
            yield ['operation', this.eq ? 'equals' : this.ne ? 'unequals' : 'like'];
            yield* generateEntries('value', arr);
        }
    }
}

class PropertyBooleanPredicate extends PropertyPredicate {
    static rootName = 'boolproperty';

    /**
     * @param {Record<string, any>} props
     */
    static shouldProcess(props) {
        return typeof props.eq === 'boolean';
    }

    /**
     * @this {PropertyPredicate & PropertyBooleanPredicateProps}
     * @returns {Generator<[string, string]>}
     */
    *generateEntries() {
        yield ['_', this.property];
        yield ['value', String(this.eq)];
    }
}

class PropertyDateComparisonPredicate extends PropertyPredicate {
    static rootName = 'dateComparison';

    /**
     * @param {Record<string, any>} props
     */
    static shouldProcess(props) {
        let value = props.eq || props.ne || props.le || props.lt || props.ge || props.gt;
        return value instanceof Ref && value.type === 'date';
    }

    /**
     * @this {PropertyPredicate & PropertyDateComparisonPredicateProps}
     */
    normalize() {
        let keys = ['eq', 'ne', 'le', 'lt', 'ge', 'gt'].filter(v => this[v]);
        if (keys.length > 1) {
            return keys.map(v => new PropertyDateComparisonPredicate(this.property, { [v]: this[v] }));
        }
        return super.normalize();
    }

    /**
     * @this {PropertyPredicate & PropertyDateComparisonPredicateProps}
     * @returns {Generator<[string, string]>}
     */
    *generateEntries() {
        let [property1, property2] = [this.property, (this.eq || this.ne || this.le || this.lt || this.ge || this.gt).property];
        if (this.le || this.lt) {
            [property1, property2] = [property2, property1];
        }
        yield ['property1', property1];
        yield ['property2', property2];
        yield ['operation', this.eq ? 'equals' : this.ne ? '!=' : (this.gt || this.le) ? 'greater' : '>='];
    }
}

class PropertyDateRangePredicate extends PropertyPredicate {
    static rootName = 'daterange';

    /**
     * @param {string} name
     * @param {Record<string, any>} props
     * @this {PropertyPredicate & PropertyDateRangePredicateProps}
     */
    constructor(name, props) {
        super(name, props);
        checkMutualExclusiveProps(this, ['le', 'lt']);
        checkMutualExclusiveProps(this, ['ge', 'gt']);
    }

    /**
     * @param {Record<string, any>} props
     */
    static shouldProcess(props) {
        return (props.le || props.lt || props.ge || props.gt) instanceof Date;
    }

    /**
     * @this {PropertyPredicate & PropertyDateRangePredicateProps}
     * @returns {Generator<[string, string]>}
     */
    *generateEntries() {
        let upperBound = this.le || this.lt;
        let lowerBound = this.ge || this.gt;
        yield ['property', this.property];
        if (upperBound) {
            yield ['upperBound', upperBound.toISOString()];
            yield ['upperOperation', this.le ? '<=' : '<'];
        }
        if (lowerBound) {
            yield ['lowerBound', lowerBound.toISOString()];
            yield ['lowerOperation', this.ge ? '>=' : '>'];
        }
    }
}

class PropertyLogicalPredicate extends PropertyPredicate {
    /**
     * @param {Record<string, any>} props
     */
    static shouldProcess(props) {
        return props.or || props.and || props.not;
    }

    /**
     * @param {PredicateBuilder} builder
     * @this {PropertyPredicate & PropertyLogicalPredicate}
     */
    emit(builder) {
        let p = Object.fromEntries(logicalOps.map(op => {
            return [op, makeArray(this[op]).map(v => ({ where: { [this.property]: v } }))];
        }))
        builder.append(p);
    }
}

class PropertyRangePredicate extends PropertyPredicate {
    static rootName = 'rangeproperty';

    /**
     * @param {string} name
     * @param {Record<string, any>} props
     * @this {PropertyPredicate & PropertyRangePredicateProps}
     */
    constructor(name, props) {
        super(name, props);
        checkMutualExclusiveProps(this, ['le', 'lt']);
        checkMutualExclusiveProps(this, ['ge', 'gt']);
    }

    /**
     * @param {Record<string, any>} props
     */
    static shouldProcess(props) {
        return ['le', 'lt', 'ge', 'gt'].some(v => typeof props[v] === 'number');
    }

    /**
     * @this {PropertyPredicate & PropertyRangePredicateProps}
     * @returns {Generator<[string, string]>}
     */
    *generateEntries() {
        yield ['property', this.property];
        if (this.le !== undefined) {
            yield ['upperBound', String(this.le)];
            yield ['upperOperation', '<='];
        } else if (this.lt !== undefined) {
            yield ['upperBound', String(this.lt)];
            yield ['upperOperation', '<'];
        }
        if (this.ge != undefined) {
            yield ['lowerBound', String(this.ge)];
            yield ['lowerOperation', '>='];
        } else if (this.gt != undefined) {
            yield ['lowerBound', String(this.gt)];
            yield ['lowerOperation', '>'];
        }
    }
}

class PropertyRelativeDateRangePredicate extends PropertyPredicate {
    static rootName = 'relativedaterange';

    /**
     * @param {Record<string, any>} props
     */
    static shouldProcess(props) {
        return props.within;
    }

    /**
     * @this {PropertyPredicate & PropertyRelativeDateRangePredicateProps}
     * @returns {Generator<[string, string]>}
     */
    *generateEntries() {
        let [lowerBound, upperBound] = this.within;
        yield ['property', this.property];
        if (upperBound) {
            yield ['upperBound', String(upperBound)];
        }
        if (lowerBound) {
            yield ['lowerBound', String(lowerBound)];
        }
    }
}

class PropertyTagIDPredicate extends PropertyPredicate {
    static rootName = 'tagid';

    /**
     * @param {Record<string, any>} props
     */
    static shouldProcess(props) {
        return props.containsAny || props.containsAll;
    }

    /**
     * @this {PropertyPredicate & PropertyTagIDPredicateProps}
     * @returns {Generator<[string, string]>}
     */
    *generateEntries() {
        let values = this.containsAny || this.containsAll;
        if (Array.isArray(values)) {
            yield* generateEntries('value', values);
        } else {
            yield ['_', values];
        }
        yield ['property', this.property];
        if (this.containsAll) {
            yield ['and', 'true'];
        }
    }
}

class PropertyTagSearchPredicate extends PropertyPredicate {
    static rootName = 'tagsearch';

    /**
     * @param {Record<string, any>} props
     */
    static shouldProcess(props) {
        return props.keyword;
    }

    /**
     * @this {PropertyPredicate & PropertyTagSearchPredicateProps}
     * @returns {Generator<[string, string]>}
     */
    *generateEntries() {
        yield ['_', this.keyword];
        yield ['property', this.property];
        if (this.fulltext) {
            yield ['all', 'true'];
        }
        if (this.language) {
            yield ['lang', this.language];
        }
    }
}

class PredicateGroup {
    counter = {};

    /**
     * @param {LogicalOp} [op]
     * @param {Record<string, number>} [initial]
     */
    constructor(op, initial) {
        this.op = op;
        this.totalCount = { ...initial };
    }

    /**
     * @param {string} prop
     * @param {number} count
     */
    countParam(prop, count) {
        this.totalCount[prop] = (this.totalCount[prop] || 0) + count;
    }

    /**
     * @param {string} prop
     */
    getParam(prop) {
        if (this.totalCount[prop] > 1) {
            this.counter[prop] = this.counter[prop] || 0;
            return `${++this.counter[prop]}_${prop}`;
        }
        return prop;
    }
}

/**
 * @param {string} prefix
 * @param {Generator<[string, string]>} generator
 * @returns {Generator<[string, string]>}
 */
function* withPrefix(prefix, generator) {
    for (let [k, v] of generator) {
        if (k === '_') {
            yield [prefix, v];
        } else {
            yield [`${prefix}.${k}`, v];
        }
    }
}

/**
 * @param {string} prop
 * @param {ScalarOrArray<string | number | boolean | QueryPart>} value
 * @param {PredicateGroup} [group]
 * @returns {Generator<[string, string]>}
 */
function* generateEntries(prop, value, group) {
    value = makeArray(value);
    group = group || new PredicateGroup('and', { [prop]: value.length });
    for (let item of value) {
        let prefix = group.getParam(prop);
        if (typeof item === 'object') {
            yield* withPrefix(prefix, item.generateEntries());
        } else {
            yield [prefix, String(item)];
        }
    }
}

/**
 * @param {QueryBuilder} q
 * @param {Predicate} p
 * @param {PredicateGroup} [group]
 * @returns {Generator<[string, string]>}
 */
function generateEntriesForPredicate(q, p, group) {
    /** @type {(g: Generator<[string, string]>) => Generator<[string, string]>} */
    let wrapper = g => g;

    let { and, or, not, ...rest } = p;
    group = group || new PredicateGroup();
    and = [...makeArray(and)];
    or = [...makeArray(or)];
    not = [...makeArray(not)];

    /** @type {Record<LogicalOp, Predicate[]>} */
    let logical = { and, or, not };
    /** @type {Record<string, [string, 'and' | 'or', (string | QueryPart)[]]>} */
    let props = {};
    /** @type {[string, 'and' | 'or', (string | QueryPart)[]][]} */
    let entries = [];
    /** @type {(name: string | Predicate, values?: ScalarOrArray<string | QueryPart>, op?: 'and' | 'or') => void} */
    let append = (name, values, op) => {
        if (typeof name !== 'string') {
            logical.and.push(name);
        } else {
            values = makeArray(values);
            if (op === 'or' && values.length > 1) {
                entries.push([name, 'or', values]);
            } else {
                let [, , arr] = props[name] || (props[name] = entries[entries.length] = [name, 'and', []]);
                arr.push(...values);
            }
        }
    };
    for (let i in rest) {
        QueryBuilder.predicates[i]?.({ append }, rest[i], i, p, q);
    }

    // decompose nested predicates if there is exactly one AND sub-predicate
    // to reduce unnecessary predicate groups
    while (true) {
        if (and.length === 1 && !not[0] && !or[0] && isLogicalPredicate(and[0])) {
            let inner = and.splice(0)[0];
            for (let op of logicalOps) {
                logical[op].push(...makeArray(inner[op]));
            }
            continue;
        }
        if (or.length === 1) {
            and.push(...or.splice(0));
            continue;
        }
        break;
    }

    // determine logical operation for this predicate group inferred by child predicates
    // create a new predicate group to contain child predicates when groups are not collapsible
    // i.e. inferred logical operation is different from current predicate group or nested NOTs
    let op = getImplicitOp(and, or, not, entries);
    if (op && group.op && (op !== group.op || op === 'not')) {
        let parentGroup = group;
        parentGroup.countParam('group', 1);
        wrapper = function* (g) {
            let prefix = parentGroup.getParam('group');
            yield* withPrefix(prefix, g);
        };
        group = new PredicateGroup(op);
    }
    op = group.op = group.op || op || 'and';

    // count the number of each parameter to determine if number prefixing is needed
    // child predicates of the same logical operation are required to count before generation
    // as parameters are generated in the same predicate group
    let generators = logical[op].splice(0).map(v => {
        return generateEntriesForPredicate(q, v, group);
    });
    group.countParam('group', +!!or.length + not.length);
    for (let [name, thisOp, values] of entries) {
        if (op === thisOp || values.length <= 1) {
            group.countParam(name, values.length);
        } else {
            group.countParam('group', 1);
        }
    }

    return wrapper(/** @return {Generator<[string, string]>} */function* () {
        if (op !== 'and') {
            if (!group.totalCount[op]) {
                group.countParam(op, 1);
                yield [`p.${op}`, 'true'];
            }
        }
        for (let g of generators) {
            yield* g;
        }
        if (or.length) {
            let prefix = group.getParam('group');
            yield* withPrefix(prefix, generateEntriesForPredicate(q, { or }));
        }
        for (let p of not) {
            let prefix = group.getParam('group');
            yield* withPrefix(prefix, generateEntriesForPredicate(q, p, new PredicateGroup('not')));
        }
        for (let [name, thisOp, values] of entries) {
            if (name in group.totalCount) {
                yield* generateEntries(name, values, group);
            } else {
                let prefix = group.getParam('group');
                if (thisOp === 'or') {
                    yield [`${prefix}.p.or`, 'true'];
                }
                yield* withPrefix(prefix, generateEntries(name, values));
            }
        }
    }());
}

class QueryBuilder {
    /**
     * @param {QueryProps} props
     */
    constructor(props) {
        Object.assign(this, props);
    }

    toJSON() {
        return Object.fromEntries(this.generateEntries());
    }

    toString() {
        return toQueryString(this.generateEntries());
    }

    /**
     * @this {QueryBuilder & QueryProps}
     * @returns {Generator<[string, string]>}
     */
    *generateEntries() {
        yield* generateEntriesForPredicate(this, this);
        if (this.nodeDepth) {
            yield ['p.nodedepth', String(this.nodeDepth)];
        }
        if (this.offset) {
            yield ['p.offset', String(this.offset)];
        }
        if (this.limit) {
            yield ['p.limit', String(this.limit)];
        } else {
            yield ['p.limit', '-1'];
        }
        if (this.facets) {
            yield ['p.facets', 'true'];
        }
        if (this.guessTotal) {
            yield ['p.guesstotal', 'true'];
        }
        if (this.excerpt) {
            yield ['p.excerpt', 'true'];
        }
        if (this.select) {
            if (this.select === '*') {
                yield ['p.hits', 'full'];
            } else {
                yield ['p.hits', 'selective'];
                yield ['p.properties', makeArray(this.select).join(' ')];
            }
        }
        if (this.orderBy) {
            let arr = makeArray(this.orderBy).map(v => new OrderBy(v));
            yield* generateEntries('orderby', arr);
        }
    }
}

/** @type {QueryBuilderStatic['ref']} */
QueryBuilder.ref = function (property, type) {
    // @ts-ignore
    return new Ref(property, type);
};

/** @type {QueryBuilderStatic['scope']} */
QueryBuilder.scope = {
    exact: p => ({ path: p, scope: 'exact' }),
    children: p => ({ path: p, scope: 'children' }),
    recursive: p => ({ path: p, scope: 'recursive' }),
    exclude: p => ({ path: p, scope: 'exclude' }),
};

/** @type {QueryBuilderStatic['predicates']} */
QueryBuilder.predicates = {
    where(builder, value) {
        for (let i in value) {
            for (let p of PropertyPredicate.fromProps(i, value[i])) {
                p.emit(builder);
            }
        }
    },
    path(builder, value) {
        PathPredicate.fromProps(value, builder);
    },
    fulltext(builder, value) {
        builder.append('fulltext', makeArray(value).map(v => new FulltextPredicate(v)));
    },
    excludePaths(builder, value) {
        builder.append('excludepaths', makeArray(value));
    },
    type(builder, value) {
        builder.append('type', makeArray(value), 'or');
    },
    nodename(builder, value) {
        builder.append('nodename', makeArray(value), 'or');
    },
    hasPermission(builder, value) {
        builder.append('hasPermission', makeArray(value).join(','));
    },
    contentFragment(builder, value) {
        builder.append('contentfragment', String(value));
    },
    mainAsset(builder, value) {
        builder.append('mainasset', String(value));
    },
    language(builder, value) {
        builder.append('language', makeArray(value), 'or');
    }
};

PropertyPredicate.register(
    PropertyLogicalPredicate,
    PropertyBooleanPredicate,
    PropertyDateComparisonPredicate,
    PropertyDateRangePredicate,
    PropertyRangePredicate,
    PropertyRelativeDateRangePredicate,
    PropertyTagIDPredicate,
    PropertyTagSearchPredicate,
    PropertyDefaultPredicate
);

QueryBuilder.default = QueryBuilder;
QueryBuilder.PropertyPredicate = PropertyPredicate;
module.exports = QueryBuilder;
