import './shared';

import ImmutableRecord from '../src/index';
import _ from 'lodash';

/*
 * Tests for the top-level API itself, not the Record class returned by the
 * top-level function.
 */
describe('ImmutableRecord', () => {
  it(`is a function`, () => {
    expect(ImmutableRecord).toBeInstanceOf(Function);
  });

  describe('top level API', () => {
    it(`throws if the first argument is a non-object`, () => {
      expect(() => ImmutableRecord(undefined)).toThrowError(/plain object/i);
      expect(() => ImmutableRecord('foo')).toThrowError(/plain object/i);
    });

    it(`throws if the first argument has no keys`, () => {
      expect(() => ImmutableRecord({})).toThrowError(/plain object/i);
    });

    it(`throws if any default values fail validation`, () => {
      expect(() => ImmutableRecord({
        foo: {
          type: 'string',
          default: { not: 'a string' }
        }
      })).toThrowError(/The default value is not valid according to the type/);
    });

    it(`returns a Record class with set and remove methods`, () => {
      const RecordKlass = ImmutableRecord({ foo: null });

      expect(RecordKlass).toBeInstanceOf(Function);
      expect(RecordKlass.name).toBe('Record');

      expect(RecordKlass.prototype.set).toBeInstanceOf(Function);
      expect(RecordKlass.prototype.set).toHaveArity(2);

      expect(RecordKlass.prototype.remove).toBeInstanceOf(Function);
      expect(RecordKlass.prototype.remove).toHaveArity(1);
    });

    it(`sets the name of the Record class`, () => {
      const recordName = 'Test';
      const RecordKlass = ImmutableRecord({ foo: null }, recordName);

      expect(RecordKlass.name).toBe(recordName);
    });
  });
});

/*
 * Tests for the Record class returned by the top-level
 * ImmutableRecord function.
 */
describe('Record', () => {

  describe(`constructor`, () => {
    const recordSpec = {
      defaultField: { default: 'default value' },
      simpleType: { type: 'number' },
      complexType: { type: val => val > 5 }
    };

    const Record = ImmutableRecord(recordSpec);

    it(`throws if a required field is missing`, () => {
      const RequiredRecord = ImmutableRecord({
        requiredField: { required: true }
      });

      expect(() => new RequiredRecord({})).toThrowError(/"requiredField" is missing/);
    });

    it(`uses default field values`, () => {
      const instance = new Record({});

      expect(instance.defaultField).toBe(recordSpec.defaultField.default);
    });

    it(`enforces simple (string) field types`, () => {
      const value = 2;
      const instance = new Record({
        simpleType: value
      });

      expect(instance.simpleType).toBe(value);

      expect(() => new Record({
        simpleType: 'string value'
      })).toThrowError(/the value "string value" at "simpleType" is invalid/i);
    });

    it(`enforces complex (validator func) field types`, () => {
      const value = 6;
      const instance = new Record({
        complexType: value
      });

      expect(instance.complexType).toBe(value);

      expect(() => new Record({
        complexType: 5
      })).toThrowError(/the value 5 at "complexType" is invalid/i);
    });

    it(`does not store unspecified values`, () => {
      const instance = new Record({
        not: 'specified',
        also: 'not specified'
      });

      const keys = Object.keys(instance);

      expect(keys).toHaveLength(1);
      expect(keys[0]).toBe('defaultField');
    });

  });

  describe(`accessors`, () => {
    const recordSpec = {
      defaultField: {
        default: 'default value'
      },
      one: {},
      two: {},
    };

    const Record = ImmutableRecord(recordSpec);

    expect.extend({

      /**
       * Expects a Record instance to have a (valid) Record accessor at some property.
       *
       * @param {Record} receivedRecordInstance
       * @param {String} propertyName
       */
      toHaveAccessorAt (receivedRecordInstance, propertyName) {
        const descriptor = Object.getOwnPropertyDescriptor(
          receivedRecordInstance,
          propertyName
        );

        if (_.isUndefined(descriptor)) {
          return {
            pass: false,
            message: `Expected an accessor at "${propertyName}"`
          };
        }

        const descriptorErrors = [
          [_.isFunction(descriptor.get),
            `Expected a getter at "${propertyName}"`],

          [_.isFunction(descriptor.set),
            `Expected a setter at "${propertyName}"`],

          [descriptor.enumerable,
            `Expected "${propertyName}" to be enumerable`],

          [!descriptor.configurable,
            `Expected "${propertyName}" to not be configurable`]
        ]
          .filter(([ isOkay ]) => !isOkay)
          .map(([ , errorMessage ]) => errorMessage);

        return {
          pass: descriptorErrors.length === 0,
          message: descriptorErrors.join('\n')
        };
      }

    });

    it(`have the following properties: getter, setter, enumerable, not configurable`, () => {
      const instance = new Record({
        one: 'some value'
      });

      const descriptor = Object.getOwnPropertyDescriptor(
        instance,
        'one'
      );

      expect(instance).toHaveAccessorAt('one');
      expect(descriptor.get).toBeInstanceOf(Function);
      expect(descriptor.set).toBeInstanceOf(Function);
      expect(descriptor.enumerable).toBe(true);
      expect(descriptor.configurable).toBe(false);
    });

    it(`has accessors for explicitly defined fields`, () => {
      const instance = new Record({
        one: 'some value'
      });
      expect(instance).toHaveAccessorAt('one');
    });

    it(`has accessors for fields with defaults`, () => {
      const defaultUnspecified = new Record();
      expect(defaultUnspecified).toHaveAccessorAt('defaultField');

      const defaultSpecified = new Record({
        defaultField: 'some value'
      });
      expect(defaultSpecified).toHaveAccessorAt('defaultField');
    });

    it(`no accessors for values without defaults that aren't supplied to the constructor`, () => {
      const instance = new Record();
      expect(instance.one).toBeUndefined();
      expect(instance.two).toBeUndefined();
    });

    it(`no accessors for unspecified values`, () => {
      const instance = new Record({
        notPresentOnRecord: 'whatever'
      });
      expect(instance.notPresentOnRecord).toBeUndefined();
    });

    it(`getter returns a value strictly equal to the original value`, () => {
      const object = {
        foo: { bar: 'baz' }
      };

      const instance = new Record({
        one: object
      });

      const getter = Object.getOwnPropertyDescriptor(
        instance,
        'one'
      ).get;

      expect(instance.one).toBe(object);
      expect(getter()).toBe(object);
    });

    it(`setter throws`, () => {
      const instance = new Record({
        one: 'whatever'
      });

      const setter = Object.getOwnPropertyDescriptor(
        instance,
        'one'
      ).set;

      const errorRegexp = /Use the "set" function to update the values of an ImmutableRecord/;

      expect(() => (instance.one = 'something else')).toThrowError(errorRegexp);
      expect(() => setter()).toThrowError(errorRegexp);
    });

    it(`should throw when configuration is attempted`, () => {
      const instance = new Record({ one: 'whatever' });

      expect(() => Object.defineProperty(
        instance,
        'one',
        {
          configurable: true
        }
      )).toThrowError(/Cannot redefine property: one/);
    });

    it(`handles undefined as a value`, () => {
      const instance = new Record({ one: undefined });

      expect(instance).toHaveAccessorAt('one');
      expect(instance.one).toBeUndefined();
    });

  });

  describe(`set (property, newValue) -> Record`, () => {
    const recordSpec = {
      default: {
        default: 'whatever'
      },

      complex: {
        type: val => val > 5
      }
    };

    const Record = ImmutableRecord(recordSpec);

    it(`throws if the property wasn't specified in the Record`, () => {
      const instance = new Record();

      const notSpecified = 'notSpecified';
      expect(
        () => instance.set(notSpecified, 'whatever')
      ).toThrowError(new RegExp(`"${notSpecified}" is not a valid field`));
    });

    it(`throws if the new value fails validation`, () => {
      const instance = new Record();

      expect(
        () => instance.set('complex', 5)
      ).toThrowError(/The value 5 at "complex" is invalid/);
    });

    it(`returns a new Record with the property set to the new value`, () => {
      const instance = new Record();
      expect(instance.complex).toBeUndefined();
      expect(instance).not.toHaveAccessorAt('complex');

      const updated = instance.set('complex', 6);
      expect(updated).toBeInstanceOf(Record);
      expect(updated).toHaveAccessorAt('complex');
      expect(updated.complex).toBe(6);
      expect(updated).toHaveAccessorAt('default');
      expect(updated.default).toBe(recordSpec.default.default);
    });

  });

  describe(`remove (property) -> Record`, () => {
    const recordSpec = {
      default: {
        default: 'whatever'
      },

      complex: {
        type: val => val > 5
      }
    };

    const Record = ImmutableRecord(recordSpec);

    it(`throws if the property wasn't specified in the Record`, () => {
      const instance = new Record();

      const notSpecified = 'notSpecified';
      expect(
        () => instance.set(notSpecified, 'whatever')
      ).toThrowError(new RegExp(`"${notSpecified}" is not a valid field`));
    });

    it(`throws if the removed property was required`, () => {
      const RequiredRecord = ImmutableRecord({
        required: {
          required: true
        }
      });

      const instance = new RequiredRecord({ required: 'whatever' });
      expect(() => instance.remove('required')).toThrowError(
        /"required" is missing from the record/
      )
    });

    it(`replaces the property with the default, if a default is specified`, () => {
      const instance = new Record({ default: 'not the default' });
      expect(instance.default).not.toBe(recordSpec.default.default);

      const updated = instance.remove('default');
      expect(updated.default).toBe(recordSpec.default.default);
    });

  });

  describe(`toString() -> String`, () => {

    it(`contains all of the keys and values`, () => {
      const Record = ImmutableRecord({
        one: {},
        two: {}
      });

      const instance = new Record({
        one: 'foo',
        two: 'bar'
      });

      const string = instance.toString();

      // Matches any characters, across newlines
      const any = '(?:.|[^])*';

      // Matches /one foo two bar/ in order with any characters in between.
      const matchInstance = new RegExp([
        'one', 'foo',
        'two', 'bar'
      ].join(any));

      expect(string).toMatch(matchInstance);
    });

  });

  describe(`keys`, () => {

    test(`Object.keys() returns keys for values present on the record`, () => {
      const Record = ImmutableRecord({
        one: {},
        two: {}
      });

      const instance = new Record({
        one: 'foo',
      });

      expect(Object.keys(instance)).toBeSameSet([ 'one' ]);
    });

    const ConflictingRecord = ImmutableRecord({
      set: {},
      remove: {}
    });

    const conflictingInstance = new ConflictingRecord({
      set: '',
      remove: ''
    });

    // NOTE:
    //    this test documents the current behavior of key names that conflict
    //    with functions on the Record prototype.
    //
    // If you're reading this test and wondering what to do if you need to
    // have key names that conflict with the prototype, see the next test below.
    test(`key names that conflict with prototype functions`, () => {
      expect(Object.keys(conflictingInstance)).toBeSameSet([ 'set', 'remove' ]);
      expect(_.isString(conflictingInstance.set)).toBeTruthy();
      expect(_.isString(conflictingInstance.remove)).toBeTruthy();
    });

    // Workaround: call the functions directly from the prototype, using a
    // record instance for the "this" value.
    test(`workaround for keys that conflict with prototype functions`, () => {
      const set = (record, keyName, value) => {
        return ConflictingRecord.prototype.set.call(record, keyName, value);
      };

      const remove = (record, keyName) => {
        return ConflictingRecord.prototype.remove.call(record, keyName);
      };

      const itWorks = 'it works!';
      expect(
        set(conflictingInstance, 'set', itWorks).set
      ).toEqual(itWorks);

      expect(
        remove(conflictingInstance, 'set').set
      ).toBeInstanceOf(Function);
    });

  });

});