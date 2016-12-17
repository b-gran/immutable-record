import FieldValue from '../src/FieldValue';

function stringify (obj) {
  try {
    return JSON.stringify(obj);
  } catch (err) {
    return Object.prototype.toString.call(obj);
  }
}

describe('FieldValue', () => {

  /*
   * Check for the presence of a static class property called "Defaults".
   * Other tests depend on FieldValue.Defaults .
   */
  it(`exposes default definition values as a static class property`, () => {
    expect(FieldValue.Defaults).toBeDefined();
  });

  describe('constructor', () => {

    /*
     * Note: this test directly accesses the internal of FieldValue representation.
     */
    it('creates a FieldValue with defaults if the definition is null or the empty object', () => {
      expect(new FieldValue(null).__definition).toEqual(FieldValue.Defaults);
      expect(new FieldValue({}).__definition).toEqual(FieldValue.Defaults);
    });

    expect.extend({

      /**
       * Given a FieldValue definition, expect construction of a FieldValue with that
       * definition to throw.
       *
       * @param {Object} receivedDefinition
       */
      toBeInvalidDefinition (receivedDefinition) {
        try {
          // The constructor should fail.
          new FieldValue(receivedDefinition);

          // If it succeeds, fail the test.
          return {
            pass: false,
            message: `Expected (new FieldValue(${stringify(receivedDefinition)})) to throw.`
          };
        } catch (error) {
          return {
            pass: true
          };
        }
      }
    });

    it(`throws if the FieldValue definition is non-null and not a plain object`, () => {
      expect(undefined).toBeInvalidDefinition();
      expect(5).toBeInvalidDefinition();
      expect('').toBeInvalidDefinition();
    });

    it(`throws if the FieldValue definition contains any non-allowed keys`, () => {
      expect({ invalid: null }).toBeInvalidDefinition();
      expect({ foo: null, bar: null }).toBeInvalidDefinition();
      expect({ type: 'string', 'Type': 'bad' }).toBeInvalidDefinition();
    });

    /*
     * type must be either
     *  1. a type string
     *  2. a validator function (arity 1)
     */
    it(`throws if "type" is invalid`, () => {
      // Not a _valid_ type string.
      expect({ type: 'nottypestring' }).toBeInvalidDefinition();

      // Not a string.
      expect({ type: {} }).toBeInvalidDefinition();

      // Function has arity > 1.
      expect({ type: function tooLong (a, b) {} }).toBeInvalidDefinition();

      // Function has arity < 1
      expect({ type: function tooShort () {} }).toBeInvalidDefinition();
    });

    it(`throws if "required" is not a boolean`, () => {
      expect({ required: 'true' }).toBeInvalidDefinition();
      expect({ required: 1 }).toBeInvalidDefinition();
      expect({ required: 0 }).toBeInvalidDefinition();
    });

    it(`throws if "enumerable" is not a boolean`, () => {
      expect({ enumerable: 'true' }).toBeInvalidDefinition();
      expect({ enumerable: 1 }).toBeInvalidDefinition();
      expect({ enumerable: 0 }).toBeInvalidDefinition();
    });
  });

  describe('hasDefault()', () => {
    expect.extend({

      /**
       * Given a FieldValue definition, expects the FieldValue with that definition to have
       * a default value.
       *
       * @param {Object} receivedDefinition
       */
      toHaveDefaultInDefinition (receivedDefinition) {
        try {
          const fieldValueHasDefault = (
            new FieldValue(receivedDefinition)
          ).hasDefault();

          return {
            pass: fieldValueHasDefault,
            message: (
              `Expected (new FieldValue(${stringify(receivedDefinition)})) ` +
              `to ${fieldValueHasDefault ? 'not ' : ''}have a default value.`
            )
          }
        } catch (err) {
          return {
            pass: false,
            message: `Expected (new FieldValue(${stringify(receivedDefinition)})) to be a valid definition.`
          }
        }
      }
    });

    it(`returns true if the FieldValue has a default`, () => {
      expect({ default: 'foo' }).toHaveDefaultInDefinition();

      // undefined is a legal default value
      expect({ default: undefined }).toHaveDefaultInDefinition();
    });

    it(`returns false if the FieldValue has no default`, () => {
      expect({}).not.toHaveDefaultInDefinition();
    });
  });

  /*
   * Three type definitions are supported by FieldValue:
   *    1. type strings (i.e. 'string', 'number', 'function', ...)
   *    2. undefined -- any value is allowed
   *    3. validator function (arity 1)
   *
   * The required parameter should cause the FieldValue to only validate
   * __defined__ values that _also_ match the FieldValue's type.
   */
  describe('isValid(value)', () => {
    const stringType = new FieldValue({
      // Only strings are valid.
      type: 'string',
    });

    const undefinedType = new FieldValue({
      // Any value is valid.
      type: undefined
    });

    const validatorFunc = new FieldValue({
      // Valid if this predicate returns true.
      type: value => value > 3
    });

    it(`returns true when the value matches the type`, () => {
      expect(stringType.isValid('foo')).toBeTruthy();
      expect(stringType.isValid('')).toBeTruthy();

      expect(undefinedType.isValid('foo')).toBeTruthy();
      expect(undefinedType.isValid(5)).toBeTruthy();
      expect(undefinedType.isValid({})).toBeTruthy();
      expect(undefinedType.isValid(undefined)).toBeTruthy();

      expect(validatorFunc.isValid(4)).toBeTruthy();
      expect(validatorFunc.isValid('4')).toBeTruthy();
    });

    it(`returns false when the value doesn't match the type`, () => {
      expect(stringType.isValid(5)).toBeFalsy();
      expect(stringType.isValid(null)).toBeFalsy();

      expect(validatorFunc.isValid(3)).toBeFalsy();
      expect(validatorFunc.isValid('3')).toBeFalsy();
    });

    it(`returns true when no value is provided (field not required)`, () => {
      expect(stringType.isValid(undefined)).toBeTruthy();
      expect(validatorFunc.isValid(undefined)).toBeTruthy();
      expect(undefinedType.isValid(undefined)).toBeTruthy();
    });

    it(`returns false when no value is provided (field required)`, () => {
      const types = [
        'string',         // type string
        undefined,        // undefined
        value => true     // validator function
      ];

      types.forEach(type => {
        const fieldValue = new FieldValue({
          type: type,
          required: true
        });

        expect(fieldValue.isValid(undefined)).toBeFalsy();
      });
    });
  });
});
