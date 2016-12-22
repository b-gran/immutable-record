import ImmutableRecord from '../src/index';
import _ from 'lodash';

expect.extend({

  /**
   * Expects a given function to have a specific arity.
   *
   * Throws if the received value is a non-function or if the expected arity
   * isn't a number.
   *
   * @param {Function} receivedFunction
   * @param {Number} correctArity
   */
  toHaveArity (receivedFunction, correctArity) {
    if (typeof correctArity !== 'number') {
      throw new Error(
        `The expected arity value passed to toHaveArity() should be a number, ` +
        `but got ${Object.prototype.toString.call(correctArity)}`
      );
    }

    if (typeof receivedFunction !== 'function') {
      throw new Error(
        `The actual value passed to toHaveArity() should be a function, ` +
        `but got ${Object.prototype.toString.call(receivedFunction)}`
      );
    }

    const hasCorrectArity = receivedFunction.length === correctArity;

    return {
      pass: hasCorrectArity,
      message: `expected the arity ${receivedFunction.length} to ` +
      `${ hasCorrectArity ? 'not ' : '' }be ${correctArity}`
    };
  }

});

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
    it(`throws if a required field is missing`, () => {
      const RequiredRecord = ImmutableRecord({
        requiredField: { required: true }
      });

      expect(() => new RequiredRecord({})).toThrowError(/requiredField is missing/);
    });

    const recordSpec = {
      defaultField: { default: 'default value' },
      simpleType: { type: 'number' },
      complexType: { type: val => val > 5 }
    };

    const Record = ImmutableRecord(recordSpec);

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
      })).toThrowError(/the value at "simpleType" is invalid/i);
    });

    it(`enforces complex (validator func) field types`, () => {
      const value = 6;
      const instance = new Record({
        complexType: value
      });

      expect(instance.complexType).toBe(value);

      expect(() => new Record({
        complexType: 5
      })).toThrowError(/the value at "complexType" is invalid/i);
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
  });
});