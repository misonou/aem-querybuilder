type ScalarOrArray<T> = T | T[];
type LogicalOp = 'or' | 'and' | 'not';

/**
 * Represents possible kinds of predicates on property of a JCR node.
 */
type PropertyPredicateProps = PropertyDefaultPredicateProps | PropertyBooleanPredicateProps | PropertyDateComparisonPredicateProps | PropertyDateRangePredicateProps | PropertyRangePredicateProps | PropertyRelativeDateRangePredicateProps | PropertyTagIDPredicateProps | PropertyTagSearchPredicateProps;

/**
 * Represents possible kinds of predicates on property of a JCR node, extended with shorthands and logical operations.
 * If string or array of strings is given, it is equivalent to specifying {@link PropertyDefaultPredicateProps} with `eq` property set.
 * If boolean is given, it is equivalent to specifying {@link PropertyBooleanPredicateProps}.
 */
type PropertyProps<T = never> = boolean | string | string[] | PropertyPredicateProps | PropertyLogicalPredicateProps<T> | T;

interface Predicate<T = never> {
    /**
     * Specifies a group combining the given predicates by logical `or` operation.
     * This property cannot be used together with `and` and `not` properties.
     */
    or?: ScalarOrArray<Predicate<T>>;
    /**
     * Specifies a group combining the given predicates by logical `and` operation.
     * This property cannot be used together with `or` and `not` properties.
     */
    and?: ScalarOrArray<Predicate<T>>;
    /**
     * Negates the given predicate.
     * This property cannot be used together with `or` and `and` properties.
     */
    not?: ScalarOrArray<Predicate<T>>;
    /**
     * Paths to search within.
     * Multiple paths are combined using `or` operation, i.e. contents within all paths are included.
     */
    path?: ScalarOrArray<string | PathPredicateProps>;
    /**
     * Excludes nodes from the result where their path matches a regular expression.
     * Multiple expressions are combined using `and` operation given, i.e. paths are matched against all such expressions.
     */
    excludePaths?: ScalarOrArray<string>;
    /**
     * Restricts results to a specific JCR node type, both primary node type or mixin type.
     * Multiple types are combined using `or` operation.
     */
    type?: ScalarOrArray<string>;
    /**
     * Matches on JCR node names.
     * Multiple types are combined using `or` operation.
     */
    nodename?: ScalarOrArray<string>;
    /**
     * Restricts the result to items where the current session has the specified JCR privileges.
     */
    hasPermission?: ScalarOrArray<string>;
    /**
     * Restricts the result to content fragments.
     */
    contentFragment?: boolean;
    /**
     * Checks if a node is a DAM main asset and not a sub asset.
     */
    mainAsset?: boolean;
    /**
     * Finds CQ pages in a specific language.
     * Multiple types are combined using `or` operation.
     */
    language?: ScalarOrArray<string>;
    /**
     * Matches on JCR properties and their values.
     * Keys of the given object are interpreted as relative path to property associated with the predicate.
     */
    where?: Record<string, PropertyProps<T>>;
    /**
     * Searches for terms in the fulltext index.
     */
    fulltext?: ScalarOrArray<string | FulltextPredicateProps>;
}

/**
 * Represents a reference to other node in predicates.
 * It is primarily used in date comparison between to two field.
 */
interface Ref<T extends string> {
    readonly property: string;
    readonly type: T;
}

interface OrderByProps {
    property: string;
    descending?: boolean;
    ignoreCase?: boolean;
}

interface PathPredicateProps {
    path: string;
    /**
     * Specifies whether descendants are included in searching.
     * - `exact` means no descendants are included;
     * - `children` means only direct children are included; and
     * - `recursive` means all decendants are included.
     * - `exclude` means all decendants are excluded.
     * Default is `recursive`.
     */
    scope?: 'exact' | 'children' | 'recursive' | 'exclude';
    /**
     * Specifies whether the base node is included in searching.
     */
    includeSelf?: boolean;
}

interface FulltextPredicateProps {
    keyword: string;
    /**
     * Specifies the relative path to search in the property or subnode.
     * This property is optional.
     */
    relPath?: string;
}

/**
 * Matches on JCR properties and their values.
 * Equivalent to `property` parameters.
 */
interface PropertyDefaultPredicateProps {
    /**
     * Specifies `equals` operation.
     * This property cannot be used together with other properties excerpt `depth`.
     */
    eq?: ScalarOrArray<string>;
    /**
     * Specifies `unequals` operation.
     * This property cannot be used together with other properties excerpt `depth`.
     */
    ne?: ScalarOrArray<string>;
    /**
     * Specifies `like` operation.
     * This property cannot be used together with other properties excerpt `depth`.
     */
    like?: ScalarOrArray<string>;
    /**
     * Specifies `like` operation within a NOT group.
     * This property cannot be used together with other properties excerpt `depth`.
     */
    notLike?: ScalarOrArray<string>;
    /**
     * Specifies `exists` or `not` operation.
     * This property cannot be used together with other properties excerpt `depth`.
     */
    exists?: boolean;
    /**
     * Specifies the number of wildcard levels underneath which the property or relative path can exist.
     * For instance, specifying `2` for `size` property will check `node/size`, `node/(*)/size` and `node/(**)/size`.
     */
    depth?: number;
}

/**
 * Matches on JCR BOOLEAN properties.
 * Equivalent to `boolproperty` parameters.
 */
interface PropertyBooleanPredicateProps {
    eq?: boolean;
}

/**
 * Compares two JCR DATE properties with each other.
 * Equivalent to `dateComparison` parameters.
 */
interface PropertyDateComparisonPredicateProps {
    eq?: Ref<'date'>;
    ne?: Ref<'date'>;
    le?: Ref<'date'>;
    lt?: Ref<'date'>;
    ge?: Ref<'date'>;
    gt?: Ref<'date'>;
}

/**
 * Matches JCR DATE properties against a date/time interval.
 * Equivalent to `daterange` parameters.
 */
interface PropertyDateRangePredicateProps {
    le?: Date;
    lt?: Date;
    ge?: Date;
    gt?: Date;
}

/**
 * Allows to build nested conditions.
 * Equivalent to `group` parameters.
 */
interface PropertyLogicalPredicateProps<T = never> {
    or?: ScalarOrArray<PropertyProps<T>>;
    and?: ScalarOrArray<PropertyProps<T>>;
    not?: ScalarOrArray<PropertyProps<T>>;
}

/**
 * Matches a JCR property against an interval. This applies to properties with linear types such as LONG, DOUBLE and DECIMAL.
 * Equivalent to `rangeproperty` parameters.
 */
interface PropertyRangePredicateProps {
    le?: number;
    lt?: number;
    ge?: number;
    gt?: number;
}

/**
 * Matches JCR DATE properties against a date/time interval using time offsets relative to the current server time.
 * Equivalent to `relativedaterange` parameters.
 */
interface PropertyRelativeDateRangePredicateProps {
    /**
     * Specified the lower bound and upper bound in bugzilla relative time format, i.e. `1s 2m 3h 4d 5w 6M 7y`.
     */
    within: [string?, string?];
}

/**
 * Searches for content tagged with one or more tags, by specifying tag IDs.
 * Equivalent to `tagid` parameters.
 */
interface PropertyTagIDPredicateProps {
    containsAny?: ScalarOrArray<string>;
    containsAll?: ScalarOrArray<string>;
}

/**
 * Searches for content tagged with one or more tags, by specifying keywords.
 * Equivalent to `tagsearch` parameters.
 */
interface PropertyTagSearchPredicateProps {
    keyword: string;
    /**
     * To search in a certain localized tag title only.
     */
    language?: string;
    /**
     * Whether to search entire tag fulltext, i.e. all titles, description etc. (takes precedence over `language`)
     */
    fulltext?: boolean;
}

interface QueryProps<T extends Predicate = Predicate> extends T {
    /**
     * Specifies how many level of descendent nodes of matched nodes should be returned.
     */
    nodeDepth?: number;
    /**
     * Specifies the start of the result page, i.e. how many items to skip.
     */
    offset?: number;
    /**
     * Specifies the page size, i.e. how many items to be returned.
     * If not specified, all matched items are returned.
     */
    limit?: number;
    /**
     * Specifies whether to return facet information.
     */
    facets?: boolean;
    /**
     * Specifies whether to return an estimated total of matched nodes.
     */
    guessTotal?: boolean;
    /**
     * Specifies whether to return excerpt for full-text search.
     */
    excerpt?: boolean;
    /**
     * Specifies what properties to be returned.
     * - If `*` is given, all properties of the matched node are returned.
     * - If not specified, it is equivalent to setting `p.hits=simple` where only a default set of extracted properties.
     */
    select?: '*' | string[];
    /**
     * Specifies how search results are sorted.
     * Search results can be sorted by more than one property.
     * If string is given, it is equivalent to ascending and case-sensitive.
     */
    orderBy?: ScalarOrArray<string | OrderByProps>;
}

interface QueryPart {
    /**
     * Returns a generator yielding actual key-value pairs of predicate parameters.
     * A query part does not imply the parameter name by itself; for the fact that the parameter name is specified through {@link PredicateBuilder.append}.
     *
     * To yield a simple value, set the key to `_`, for example:
     * ```javascript
     * yield ['_', 'value'];
     * ```
     * will generate `xxx=value`.
     *
     * To yield a sub-property, set the key to whatever the sub-property is named, for example:
     * ```javascript
     * yield ['subProperty', 'value'];
     * ```
     * will generate `xxx.subProperty=value`.
     *
     * @see {@link PredicateBuilder}
     */
    generateEntries(): Generator<[string, string]>;
}

interface PredicateBuilder<T = Predicate> {
    /**
     * Appends query parameter.
     *
     * If multiple values are supplied, a nested predicate group will contain N_parameters generated for each value,
     * joined by the logical operation specified by the third argument, for example:
     * ```javascript
     * builder.append('nodename', ['foo*', 'bar*'], 'or');
     * ```
     * will result in
     * ```ini
     * p.or=true
     * 1_nodename=foo*
     * 2_nodename=bar*
     * ```
     *
     * If the evaulator of the given parameter accepts sub-property, i.e. `param.subProperty`,
     * objects implemented the {@link QueryPart} interface can be supplied, see {@link QueryPart.generateEntries}.
     *
     * @param name Parameter name.
     * @param values One or multiple values.
     * @param op Specifies the logical operation when multiple values are supplied, defaults to `and`.
     */
    append(name: string, values: ScalarOrArray<string | QueryPart>, op?: 'and' | 'or'): void;

    /**
     * Appends nested predicates.
     * @param nested Object representing nested predicate.
     */
    append(nested: T): void;
}

/**
 * Defines the logic to convert a given predicate into query parameters.
 */
interface PredicateHandler<V = any, T = Predicate> {
    /**
     * @param builder Provides methods to emit query parameters or nested predicates.
     * @param value Values received.
     * @param key Name of the predicate, i.e. key in the {@link Predicate} interface.
     * @param predicate Predicate group being processed. It can be either the root or a nested one. For the root case, it is the same object as the `query` parameter.
     * @param query The {@link QueryBuilder} object being processed.
     */
    (builder: PredicateBuilder<T>, value: V, key: string, predicate: T, query: QueryBuilder<T>): void;
}

interface PropertyPredicate<T extends {} = {}> extends T {
}

/**
 * Defines the logic to convert a given property predicate into query parameters.
 */
abstract class PropertyPredicate<T = {}> implements QueryPart {
    /**
     * Relative path to the property or sub-node which this predicate is matching against.
     */
    readonly property: string;

    /**
     * @param property Relative path to the property or sub-node which this predicate is matching against.
     * @param props Predicate values.
     */
    constructor(property: string, props: T);

    /**
     * Returns a list of canonical form of {@link PropertyPredicate} decomposed
     * from complex or shorthanded predicate values passed to this instance.
     * Ideally each canonical form should correspond to a single query parameter.
     *
     * Default is to return an array containing only itself.
     * ```javascript
     * normalize() {
     *     return [this];
     * }
     * ```
     */
    normalize(): PropertyPredicate[];

    /**
     * Appends query parameters or nested predicates to the result query.
     * Multiple parameters or nested predicates are joined by `and` operation.
     *
     * Default is to append a single query parameter named from the static property `rootName`.
     * ```javascript
     * emit(builder) {
     *     builder.append(this.constructor.rootName, this);
     * }
     * ```
     */
    emit(builder: PredicateBuilder): void;

    /**
     * When implemented, generates actual query parameters.
     * @see {@link QueryPart.generateEntries}
     */
    abstract generateEntries(): Generator<[string, string]>;

    /**
     * Constructs a list of {@link PropertPredicate} from the given predicate values.
     * @param property Relative path to the property or sub-node which this predicate is matching against.
     * @param props Predicate values.
     */
    static fromProps(property: string, props: PropertyProps): PropertyPredicate[];

    /**
     * Register custom property predicates.
     */
    static register(...args: (typeof PropertyPredicate)[]): void;
}

interface QueryBuilderStatic<T = Predicate> {
    /**
     * Creates query based on specified properties.
     */
    new <T = Predicate>(props: QueryProps<T>): QueryBuilder<T>;

    readonly PropertyPredicate: typeof PropertyPredicate;

    /**
     * Defines how each named entry in the {@link Predicate} interface are converted into query parameters.
     */
    readonly predicates: Record<string, PredicateHandler<any, T>> & { [P in Exclude<keyof T, LogicalOp>]?: PredicateHandler<T[P], T> };

    readonly scope: {
        /**
         * Searches only the main node. No descendants are included.
         * Equivalent to setting `path.exact` parameter to `true`.
         * @param path Path to search.
         */
        exact(path: string): PathPredicateProps;
        /**
         * Searches only direct children.
         * Equivalent to setting `path.flat` parameter to `true`.
         * @param path Path to search under.
         */
        children(path: string): PathPredicateProps;
        /**
         * Searches all descendants.
         * Equivalent to setting `path.exact` parameter to `false`.
         * @param path Path to search under.
         */
        recursive(path: string): PathPredicateProps;
        /**
         * Excludes the main node and all descendants from the specified path.
         * @param path Path to exclude.
         */
        exclude(path: string): PathPredicateProps;
    }

    /**
     * Creates a {@link Ref} object representing another node within query.
     * @param property Relative path to a property or a sub-node.
     */
    ref<T extends 'date'>(property: string, type: T): Ref<T>;
}

interface QueryBuilder<T = Predicate> extends QueryProps<T> {
    /**
     * Returns an object which key-value pairs representing parameters to be sent to
     * query builder servlet.
     */
    toJSON(): Record<string, any>;

    /**
     * Returns an `application/x-www-form-urlencoded` string representing the query to be sent to query builder servlet,
     * which can also be used as part of a query string.
     */
    toString(): string;
}

declare const QueryBuilder: QueryBuilderStatic;
export = QueryBuilder;
export {
    ScalarOrArray,
    LogicalOp,
    PropertyPredicateProps,
    PropertyProps,
    Predicate,
    Ref,
    OrderByProps,
    PathPredicateProps,
    FulltextPredicateProps,
    PropertyDefaultPredicateProps,
    PropertyBooleanPredicateProps,
    PropertyDateComparisonPredicateProps,
    PropertyDateRangePredicateProps,
    PropertyLogicalPredicateProps,
    PropertyRangePredicateProps,
    PropertyRelativeDateRangePredicateProps,
    PropertyTagIDPredicateProps,
    PropertyTagSearchPredicateProps,
    QueryProps,
    QueryPart,
    PredicateBuilder,
    PredicateHandler,
    QueryBuilderStatic as Static
}
