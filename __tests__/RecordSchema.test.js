import { stringify, not } from './shared';

import RecordSchema from '../src/RecordSchema';
import _ from 'lodash';

describe('RecordSchema', () => {

  describe('constructor', () => {

    expect.extend({

      /**
       * Given a RecordSchema definition, expect construction of a RecordSchema with that
       * definition to succeed.
       *
       * @param {Object} schemaDefinition
       */
      toBeValidSchema (schemaDefinition) {
        const isValidSchema = !_.isError(
          _.attempt(def => new RecordSchema(def), schemaDefinition)
        );

        return {
          pass: isValidSchema,
          message: (
            `Expected ${stringify(schemaDefinition)} to ${not(isValidSchema)}` +
            `be a valid RecordSchema.`
          )
        }
      }
    });

    it(`throws if the schema is not a plain object`, () => {
      expect(undefined).not.toBeValidSchema();
      expect('foo').not.toBeValidSchema();
      expect(5).not.toBeValidSchema();
    });

    it(`throws if the schema has zero keys`, () => {
      expect({}).not.toBeValidSchema();
    });

    it(`throws if a schema value is non-nil and not a plain object`, () => {
      expect({ a: NaN }).not.toBeValidSchema();
      expect({ a: 5 }).not.toBeValidSchema();
      expect({ a: '' }).not.toBeValidSchema();
    });

    it(`accepts nil and empty (object) schema values`, () => {
      expect({ a: {} }).toBeValidSchema();
      expect({ a: null }).toBeValidSchema();
      expect({ a: undefined }).toBeValidSchema();
    });

    it(`throws if a schema value contains any non-allowed keys`, () => {
      expect({
        a: { invalid: null }
      }).not.toBeValidSchema();

      expect({
        a: { foo: null, bar: null }
      }).not.toBeValidSchema();

      expect({
        a: { type: 'string', 'Type': 'bad' }
      }).not.toBeValidSchema();
    });

    /*
     * type must be either
     *  1. a type string
     *  2. a validator function (arity 1)
     */
    it(`throws if "type" is invalid`, () => {
      // Not a _valid_ type string.
      expect({
        a: { type: 'nottypestring' }
      }).not.toBeValidSchema();

      // Not a string.
      expect({
        a: { type: {} }
      }).not.toBeValidSchema();

      // Function has arity > 1.
      expect({
        a: {
          type: function tooLong (a, b) {}
        }
      }).not.toBeValidSchema();

      // Function has arity < 1
      expect({
        a: {
          type: function tooShort () {}
        }
      }).not.toBeValidSchema();
    });

    it(`throws if "required" is not a boolean`, () => {
      expect({
        a: { required: 'true' }
      }).not.toBeValidSchema();

      expect({
        a: { required: 1 }
      }).not.toBeValidSchema();

      expect({
        a: { required: 0 }
      }).not.toBeValidSchema();
    });

    it(`throws if "enumerable" is not a boolean`, () => {
      expect({
        a: { enumerable: 'true' }
      }).not.toBeValidSchema();

      expect({
        a: { enumerable: 1 }
      }).not.toBeValidSchema();

      expect({
        a: { enumerable: 0 }
      }).not.toBeValidSchema();
    });

    it(`allows defaults that validate according to the type`, () => {
      expect({
        a: {
          type: 'string',
          default: 'a'
        }
      }).toBeValidSchema();
    });

    it(`throws if a default doesn't validate according to the type`, () => {
      expect({
        a: {
          type: 'string',
          default: 5
        }
      }).not.toBeValidSchema();
    });

  });

  describe('hasProperty()', () => {
    const schema = new RecordSchema({
      a: null,
      b: undefined,
    });

    it(`returns true if the property is present`, () => {
      expect(schema.hasProperty('a')).toBeTruthy();
      expect(schema.hasProperty('b')).toBeTruthy();
    });

    it(`returns false if the property is not present`, () => {
      expect(schema.hasProperty('c')).toBeFalsy();
    });

  });

  describe('removeInvalidInputKeys()', () => {
    const schema = new RecordSchema({
      a: null,
      b: null,
    });

    it(`removes keys that aren't present on the schema`, () => {
      const input = {
        a: {},
        c: {},
      };
      const trimmed = schema.removeInvalidInputKeys(input);

      expect(Object.keys(trimmed)).toBeSameSet([ 'a' ]);
      expect(trimmed.a).toBe(input.a);
    });

  });

  describe('validateInput()', () => {
    const schema = new RecordSchema({
      a: {
        type: 'string',
        required: true
      },
      b: {
        type: b => b > 5
      },
      c: {}
    });

    it(`throws (with explanation) if the input is invalid`, () => {
      expect(
        () => schema.validateInput('')
      ).toThrowError(/record input must either be nil or a plain object/i);

      expect(
        () => schema.validateInput({})
      ).toThrowError(/"a" is missing/i);

      expect(
        () => schema.validateInput({ a: NaN })
      ).toThrowError(/the value null at "a" is invalid/i);

      expect(
        () => schema.validateInput({ a: '', b: 5 })
      ).toThrowError(/the value 5 at "b" is invalid/i);
    });

    it(`returns true if the input is valid`, () => {
      expect(
        schema.validateInput({
          a: ''
        })
      ).toBe(true);

      expect(
        schema.validateInput({
          a: '',
          c: 'anything'
        })
      ).toBe(true);

      expect(
        schema.validateInput({
          a: '',
          b: 6,
          c: 'anything'
        })
      ).toBe(true);
    });

  });

  describe(`applyDefaults()`, () => {
    const spec = {
      a: {
        default: 'a'
      },
      b: null,
      c: {
        required: true,
        default: 'c',
      }
    };
    const schema = new RecordSchema(spec);

    it(`replaces missing values with their defaults`, () => {
      expect(
        schema.applyDefaults({})
      ).toEqual({ a: spec.a.default, c: spec.c.default });

      expect(
        schema.applyDefaults({ a: '' })
      ).toEqual({ a: '', c: spec.c.default });

      expect(
        schema.applyDefaults({ c: '' })
      ).toEqual({ a: spec.a.default, c: '' });
    });

  });

  describe(`getAccessorsForInput()`, () => {
    const schema = new RecordSchema({
      a: null,
      b: null
    });

    const accessors = schema.getAccessorsForInput({ a: '', b: '', c: '', d: '' });

    it(`only returns accessors for keys present on the schema`, () => {
      expect(Object.keys(accessors)).toBeSameSet([ 'a', 'b' ]);
    });

    it(`returns valid accessors for each schema key`, () => {
      // Object.defineProperties() throws if the descriptors are invalid, so it's
      // sufficient to verify that it doesn't throw when we pass the result of
      // the function call.
      expect(() => Object.defineProperties({}, accessors)).not.toThrow();
    });

    describe(`accessors`, () => {
      const input = {
        a: {},
        b: {}
      };
      const accessors = schema.getAccessorsForInput(input);

      test(`getter returns the input value`, () => {
        expect(accessors.a.get()).toBe(input.a);
        expect(accessors.b.get()).toBe(input.b);
      });

      test(`setter throws`, () => {
        expect(() => accessors.a.set('whatever')).toThrowError(
          /use the "set" function to update the values of an ImmutableRecord/i
        )
      });

      test(`enumerable is true`, () => {
        expect(accessors.a.enumerable).toBe(true);
      });

      test(`configurable is false`, () => {
        expect(accessors.a.configurable).toBe(false);
      });

    });

  });

});
