//TODO: move this back to types.ts
namespace ts {
    export interface MapLike<T> {
        [index: string]: T;
    }

    //Abstract data type pattern: export only a brand, and internally cast to 'any'. What fun!
    //NOTE: this changes the public interface. People shouldn't directly access Maps.
    export interface Map<T> {
        __mapBrand: T; //ensure Map<string> and Map<number> are incompatible
    }
}

//sort me
/* @internal */
namespace ts {
    export function sortInV8ObjectInsertionOrder<T>(values: T[], toKey: (t: T) => string): T[] {
        const naturals: T[] = []; //name
        const everythingElse: T[] = [];
        for (const value of values) {
            // "0" looks like a natural but "08" doesn't.
            const looksLikeNatural = /^(0|([1-9]\d*))$/.test(toKey(value));
            (looksLikeNatural ? naturals : everythingElse).push(value);
        }
        function toInt(value: T): number {
            return parseInt(toKey(value), 10);
        }
        naturals.sort((a, b) => toInt(a) - toInt(b));
        return naturals.concat(everythingElse);
    }
}


/* @internal */
//map implementation
namespace ts {
    interface Iterator<T> {
        next(): { value: T, done: boolean }; //{ value: T, done: false } | { value: never, done: true }
    }

    interface NativeMap<T> extends Map<T> {
        clear(): void;
        delete(key: string): boolean;
        get(key: string): T;
        has(key: string): boolean;
        set(key: string, value: T): this;

        keys(): Iterator<string>;
        values(): Iterator<T>;
        entries(): Iterator<[string, T]>;
    }

    declare const Map: { new<T>(): NativeMap<T> } | undefined;
    const realMaps = typeof Map !== "undefined"; //false;

    function asNative<T>(map: Map<T>): NativeMap<T> {
        Debug.assert(map instanceof Map);
        return map as any as NativeMap<T>;
    }
    function asObj<T>(map: Map<T>): MapLike<T> {
        return map as any as MapLike<T>;
    }

    const createObject = Object.create;
    const hasOwnProperty = Object.prototype.hasOwnProperty;

    export const createMap: <T>(template?: MapLike<T>) => Map<T> = realMaps
        ? <T>(template?: MapLike<T>) => {
            const map = new Map<T>();
            fillMapFromTemplate(map, template);
            return map;
        }
        : <T>(template?: MapLike<T>) => {
            const map: Map<T> = createDictionaryModeObject();
            fillMapFromTemplate(map, template);
            return map;
        };

    function fillMapFromTemplate<T>(map: Map<T>, template: MapLike<T> | undefined) {
        //console.log("Create map from template");
        //console.log(JSON.stringify(template, undefined, '\t'));
        // Copies keys/values from template. Note that for..in will not throw if
        // template is undefined, and instead will just exit the loop.
        for (const key in template) if (hasOwnProperty.call(template, key)) {
            //console.log(key, template[key]);
            _s(map, key, template[key]);
            //console.log(map);
        }
        //throw new Error("BAI");
    }

    function createDictionaryModeObject(): any {
        const map = createObject(null); // tslint:disable-line:no-null-keyword

        // Using 'delete' on an object causes V8 to put the object in dictionary mode.
        // This disables creation of hidden classes, which are expensive when an object is
        // constantly changing shape.
        map["__"] = undefined;
        delete map["__"];

        return map;
    }



    //PRIMITIVE OPERATIONS: Need a different strategy for real map vs {}

    export const _g: <T>(map: Map<T>, key: string) => T = realMaps
        ? <T>(map: Map<T>, key: string) => asNative(map).get(key)
        : <T>(map: Map<T>, key: string) => asObj(map)[key];

    export const _s: <T>(map: Map<T>, key: string, value: T) => T = realMaps
        ? <T>(map: Map<T>, key: string, value: T) => {
            asNative(map).set(key, value);
            return value;
        }
        : <T>(map: Map<T>, key: string, value: T) => asObj(map)[key] = value;

    //TODO: many calls to _has could be replaced by calling '_get' and checking the result
    export const _has: (map: Map<any>, key: string) => boolean = realMaps
        ? (map, key) => asNative(map).has(key)
        : (map, key) => key in asObj(map);

    export const _delete: (map: Map<any>, key: string) => void = realMaps
        ? (map, key) => {
            asNative(map).delete(key);
        }
        : (map, key) => {
            delete asObj(map)[key];
        };

    export const _each: <T>(map: Map<T>, f: (key: string, value: T) => void) => void = realMaps
        ? <T>(map: Map<T>, f: (key: string, value: T) => void) => {
            const iter = asNative(map).entries();
            while (true) {
                const { value: pair, done } = iter.next();
                if (done) {
                    return;
                }
                const [key, value] = pair;
                f(key, value);
            }
        }
        : <T>(map: Map<T>, f: (key: string, value: T) => void): void => {
            for (const key in asObj(map)) {
                f(key, _g(map, key));
            }
        };

    export const _find: <T, U>(map: Map<T>, f: (key: string, value: T) => U | undefined) => U | undefined = realMaps
        ? <T, U>(map: Map<T>, f: (key: string, value: T) => U | undefined) => {
            const iter = asNative(map).entries();
            while (true) {
                const { value: pair, done } = iter.next();
                if (done) {
                    return undefined;
                }
                const [key, value] = pair;
                const result = f(key, value);
                if (result !== undefined) {
                    return result;
                }
            }
        }
        : <T, U>(map: Map<T>, f: (key: string, value: T) => U | undefined) => {
            const obj = asObj(map);
            for (const key in obj) {
                const result = f(key, obj[key]);
                if (result !== undefined)
                    return result;
            }
            return undefined;
        };

    export const _someKey: (map: Map<any>, f: (key: string) => boolean) => boolean = realMaps
        ? (map, f) => {
            const iter = asNative(map).keys();
            while (true) {
                const { value: key, done } = iter.next();
                if (done) {
                    return false;
                }
                if (f(key)) {
                    return true;
                }
            }
        }
        : (map, f) => {
            for (const key in asObj(map)) {
                if (f(key)) {
                    return true;
                }
            }
            return false;
        };

    export const _someValue: <T>(map: Map<T>, f: (value: T) => boolean) => boolean = realMaps
        ? <T>(map: Map<T>, f: (value: T) => boolean) => {
            const iter = asNative(map).values();
            while (true) {
                const { value, done } = iter.next();
                if (done) {
                    return false;
                }
                if ((value)) {
                    return true;
                }
            }
        }
        : <T>(map: Map<T>, f: (value: T) => boolean) => {
            const obj = asObj(map);
            for (const key in obj) {
                if (f(obj[key])) {
                    return true;
                }
            }
            return false;
        };

    export const _someEntry: <T>(map: Map<T>, f: (key: string, value: T) => boolean) => boolean = realMaps
        ? <T>(map: Map<T>, f: (key: string, value: T) => boolean) => {
            const iter = asNative(map).entries();
            while (true) {
                const { value: pair, done } = iter.next();
                if (done) {
                    return false;
                }
                const [key, value] = pair;
                if (f(key, value)) {
                    return true;
                }
            }
        }
        : <T>(map: Map<T>, f: (key: string, value: T) => boolean) => {
            const obj = asObj(map);
            for (const key in obj) {
                if (f(key, obj[key])) {
                    return true;
                }
            }
            return false;
        };

    export const _eachKey: (map: Map<any>, f: (key: string) => void) => void = realMaps
        ? (map, f) => {
            const iter = asNative(map).keys();
            while (true) {
                const { value: key, done } = iter.next();
                if (done) {
                    return;
                }
                f(key);
            }
        }
        : (map, f) => {
            for (const key in map) {
                f(key);
            }
        };

    //reconsider
    export const _eachAndBreakIfReturningTrue: <T>(map: Map<T>, f: (key: string, value: T) => boolean) => void = realMaps
        ? <T>(map: Map<T>, f: (key: string, value: T) => boolean) => {
            const iter = asNative(map).entries();
            while (true) {
                const { value: pair, done } = iter.next();
                if (done) {
                    return;
                }
                const [key, value] = pair;
                f(key, value);
            }
        }
        : <T>(map: Map<T>, f: (key: string, value: T) => boolean) => {
            for (const key in map) {
                const shouldBreak = f(key, _g(map, key));
                if (shouldBreak) {
                    break;
                }
            }
        };

    export const _eachValue: <T>(map: Map<T>, f: (value: T) => void) => void = realMaps
        ? <T>(map: Map<T>, f: (value: T) => void) => {
            const iter = asNative(map).values();
            while (true) {
                const { value, done } = iter.next();
                if (done) {
                    return;
                }
                f(value);
            }
        }
        : <T>(map: Map<T>, f: (value: T) => void) => {
            for (const key in map) {
                f(_g(map, key));
            }
        };

    export const _toMapLike: <T>(map: Map<T>) => MapLike<T> = realMaps
        ? <T>(map: Map<T>) => {
            const obj = createDictionaryModeObject();
            _each(map, (key, value) => {
                obj[key] = value;
            });
            return obj;
        }
        : <T>(map: Map<T>) => asObj(map);

    export const _findMapValue: <T, U>(map: Map<T>, f: (value: T) => U | undefined) => U | undefined = realMaps
        ? <T, U>(map: Map<T>, f: (value: T) => U | undefined) => {
            const iter = asNative(map).values();
            while (true) {
                const { value, done } = iter.next();
                if (done) {
                    return undefined;
                }
                const result = f(value);
                if (result !== undefined) {
                    return result;
                }
            }
        }
        : <T, U>(map: Map<T>, f: (value: T) => U | undefined) => {
            const obj = asObj(map);
            for (const key in obj) {
                const result = f(obj[key]);
                if (result !== undefined) {
                    return result;
                }
            }
            return undefined;
        };

    //kill
    export function checkNotNativeMap(value: MapLike<any>) {
        Debug.assert(!(value instanceof Map));
    }
}


//Map extensions: don't depend on internal details
/* @internal */
namespace ts {
    export function isEmpty<T>(map: Map<T>): boolean {
        return !_someKey(map, () => true);
    }

    //rename these
    export function _deleteWakka(map: Map<any>, key: any): void {
        _delete(map, key.toString());
    }
    export function _hasWakka(map: Map<any>, key: any): boolean {
        return _has(map, key.toString());
    }
    export function _getWakka<T>(map: Map<T>, key: any): T {
        return _g(map, key.toString());
    }
    export function _setWakka<T>(map: Map<T>, key: any, value: T): T {
        return _s(map, key.toString(), value);
    }

    export function _mod<T>(map: Map<T>, key: string, modifier: (value: T) => T) {
        _s(map, key, modifier(_g(map, key)));
    }

    export function cloneMap<T>(map: Map<T>) {
        const clone = createMap<T>();
        copyMapPropertiesFromTo(map, clone);
        return clone;
    }

    /**
     * Performs a shallow copy of the properties from a source Map<T> to a target Map<T>
     *
     * @param source A map from which properties should be copied.
     * @param target A map to which properties should be copied.
     */
    export function copyMapPropertiesFromTo<T>(source: Map<T>, target: Map<T>): void {
        _each(source, (key, value) => {
            _s(target, key, value);
        });
    }

    //kill?
    /**
     * Reduce the properties of a map.
     *
     * NOTE: This is intended for use with Map<T> objects. For MapLike<T> objects, use
     *       reduceOwnProperties instead as it offers better runtime safety.
     *
     * @param map The map to reduce
     * @param callback An aggregation function that is called for each entry in the map
     * @param initial The initial value for the reduction.
     */
    export function reduceProperties<T, U>(map: Map<T>, callback: (aggregate: U, value: T, key: string) => U, initial: U): U {
        let result = initial;
        _each(map, (key, value) => {
            result = callback(result, value, String(key)); //why cast to string???
        });
        return result;
    }

    export function _mapValuesMutate<T>(map: Map<T>, mapValue: (value: T) => T): void {
        _each(map, (key, value) => {
            _s(map, key, mapValue(value));
        });
    }

    export function _ownKeys<T>(map: Map<T>): string[] {
        const keys: string[] = [];
        _eachKey(map, key => {
            keys.push(key);
        });
        return keys;
    }

    export function _getOrUpdate<T>(map: Map<T>, key: string, getValue: (key: string) => T): T {
        return _has(map, key) ? _g(map, key) : _s(map, key, getValue(key));
    }

    /**
     * Creates a map from the elements of an array.
     *
     * @param array the array of input elements.
     * @param makeKey a function that produces a key for a given element.
     *
     * This function makes no effort to avoid collisions; if any two elements produce
     * the same key with the given 'makeKey' function, then the element with the higher
     * index in the array will be the one associated with the produced key.
     */
    export function arrayToMap<T>(array: T[], makeKey: (value: T) => string): Map<T>;
    export function arrayToMap<T, U>(array: T[], makeKey: (value: T) => string, makeValue: (value: T) => U): Map<U>;
    export function arrayToMap<T, U>(array: T[], makeKey: (value: T) => string, makeValue?: (value: T) => U): Map<T | U> {
        const result = createMap<T | U>();
        for (const value of array) {
            _s(result, makeKey(value), makeValue ? makeValue(value) : value);
        }
        return result;
    }

    /**
     * Adds the value to an array of values associated with the key, and returns the array.
     * Creates the array if it does not already exist.
     */
    export function multiMapAdd<V>(map: Map<V[]>, key: string, value: V): V[] {
        const values = _g(map, key);
        if (values) {
            values.push(value);
            return values;
        }
        else {
            return _s(map, key, [value]);
        }
    }

    /**
     * Removes a value from an array of values associated with the key.
     * Does not preserve the order of those values.
     * Does nothing if `key` is not in `map`, or `value` is not in `map[key]`.
     */
    export function multiMapRemove<V>(map: Map<V[]>, key: string, value: V): void {
        const values = _g(map, key);
        if (values) {
            unorderedRemoveItem(values, value);
            if (!values.length) {
                _delete(map, key);
            }
        }
    }

    //todo: neater
    export function _equalMaps<T>(left: Map<T>, right: Map<T>, equalityComparer?: (left: T, right: T) => boolean) {
        if (left === right) return true;
        if (!left || !right) return false;
        const someInLeftHasNoMatch = _someEntry(left, (leftKey, leftValue) => {
            if (!_has(right, leftKey)) return true;
            const rightValue = _g(right, leftKey);
            return !(equalityComparer ? equalityComparer(leftValue, rightValue) : leftValue === rightValue);
        });
        if (someInLeftHasNoMatch) return false;
        const someInRightHasNoMatch = _someKey(right, rightKey => !_has(left, rightKey));
        return !someInRightHasNoMatch;
    }
}

//MAPLIKE CRAP
/* @internal */
namespace ts {
    const hasOwnProperty = Object.prototype.hasOwnProperty; //neater

    export function clone<T>(object: T): T {
        const result: any = {};
        for (const id in object) {
            if (hasOwnProperty.call(object, id)) {
                result[id] = (<any>object)[id];
            }
        }
        return result;
    }

    /**
     * Indicates whether a map-like contains an own property with the specified key.
     *
     * NOTE: This is intended for use only with MapLike<T> objects. For Map<T> objects, use
     *       the 'in' operator.
     *
     * @param map A map-like.
     * @param key A property key.
     */
    export function hasProperty<T>(map: MapLike<T>, key: string): boolean {
        checkNotNativeMap(map);
        return hasOwnProperty.call(map, key);
    }

    /**
     * Gets the value of an owned property in a map-like.
     *
     * NOTE: This is intended for use only with MapLike<T> objects. For Map<T> objects, use
     *       an indexer.
     *
     * @param map A map-like.
     * @param key A property key.
     */
    export function getProperty<T>(map: MapLike<T>, key: string): T | undefined {
        checkNotNativeMap(map);
        return hasOwnProperty.call(map, key) ? map[key] : undefined;
    }

    /**
     * Gets the owned, enumerable property keys of a map-like.
     *
     * NOTE: This is intended for use with MapLike<T> objects. For Map<T> objects, use
     *       Object.keys instead as it offers better performance.
     *
     * @param map A map-like.
     */
    export function getOwnKeys<T>(map: MapLike<T>): string[] {
        checkNotNativeMap(map);
        const keys: string[] = [];
        for (const key in map) if (hasOwnProperty.call(map, key)) {
            keys.push(key);
        }
        return keys;
    }

    export function assign<T1 extends MapLike<{}>, T2, T3>(t: T1, arg1: T2, arg2: T3): T1 & T2 & T3;
    export function assign<T1 extends MapLike<{}>, T2>(t: T1, arg1: T2): T1 & T2;
    export function assign<T1 extends MapLike<{}>>(t: T1, ...args: any[]): any;
    export function assign<T1 extends MapLike<{}>>(t: T1, ...args: any[]) {
        checkNotNativeMap(t);
        for (const arg of args) {
            checkNotNativeMap(arg);
            for (const p of getOwnKeys(arg)) {
                t[p] = arg[p];
            }
        }
        return t;
    }

    /**
     * Reduce the properties defined on a map-like (but not from its prototype chain).
     *
     * NOTE: This is intended for use with MapLike<T> objects. For Map<T> objects, use
     *       reduceProperties instead as it offers better performance.
     *
     * @param map The map-like to reduce
     * @param callback An aggregation function that is called for each entry in the map
     * @param initial The initial value for the reduction.
     */
    export function reduceOwnProperties<T, U>(map: MapLike<T>, callback: (aggregate: U, value: T, key: string) => U, initial: U): U {
        checkNotNativeMap(map);
        let result = initial;
        for (const key in map) if (hasOwnProperty.call(map, key)) {
            result = callback(result, map[key], String(key));
        }
        return result;
    }

    /**
     * Performs a shallow equality comparison of the contents of two map-likes.
     *
     * @param left A map-like whose properties should be compared.
     * @param right A map-like whose properties should be compared.
     */
    export function equalOwnProperties<T>(left: MapLike<T>, right: MapLike<T>, equalityComparer?: (left: T, right: T) => boolean) {
        checkNotNativeMap(left);
        checkNotNativeMap(right);
        if (left === right) return true;
        if (!left || !right) return false;
        for (const key in left) if (hasOwnProperty.call(left, key)) {
            if (!hasOwnProperty.call(right, key) === undefined) return false;
            if (equalityComparer ? !equalityComparer(left[key], right[key]) : left[key] !== right[key]) return false;
        }
        for (const key in right) if (hasOwnProperty.call(right, key)) {
            if (!hasOwnProperty.call(left, key)) return false;
        }
        return true;
    }

    export function extend<T1, T2>(first: T1 , second: T2): T1 & T2 {
        checkNotNativeMap(first);
        checkNotNativeMap(second);
        const result: T1 & T2 = <any>{};
        for (const id in second) if (hasOwnProperty.call(second, id)) {
            (result as any)[id] = (second as any)[id];
        }
        for (const id in first) if (hasOwnProperty.call(first, id)) {
            (result as any)[id] = (first as any)[id];
        }
        return result;
    }
}
