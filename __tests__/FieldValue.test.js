import FieldValue from '../src/FieldValue';

describe('FieldValue', () => {
  /*
   * Other tests depend on FieldValue.Defaults .
   */
  it(`exposes default definition values as a static class property`, () => {
    expect(FieldValue.Defaults).toBeDefined();
  });

  describe('constructor', () => {
    it('creates a FieldValue with defaults if the definition is null or the empty object', () => {
      expect(new FieldValue(null).__definition).toEqual(FieldValue.Defaults);
      expect(new FieldValue({}).__definition).toEqual(FieldValue.Defaults);
    });

    /**
     * Given a FieldValue definition, expect construction of a FieldValue with that
     * definition to throw.
     *
     * @param {Object} definition
     */
    function expectInvalidDefinition (definition) {
      expect(() => new FieldValue(definition)).toThrow();
    }

    it(`throws if the FieldValue definition is non-null and not a plain object`, () => {
      expectInvalidDefinition(undefined);
      expectInvalidDefinition(5);
      expectInvalidDefinition('');
    });

    it(`throws if the FieldValue definition contains any non-allowed keys`, () => {
      expectInvalidDefinition({ invalid: null });
      expectInvalidDefinition({ foo: null, bar: null });
      expectInvalidDefinition({ type: 'string', 'Type': 'bad' });
    });

    /*
     * type must be either
     *  1. a type string
     *  2. a validator function (arity 1)
     */
    it(`throws if "type" is invalid`, () => {
      // Not a _valid_ type string.
      expectInvalidDefinition({ type: 'nottypestring' });

      // Not a string.
      expectInvalidDefinition({ type: {} });

      // Function has arity > 1.
      expectInvalidDefinition({ type: function tooLong (a, b) {} });

      // Function has arity < 1
      expectInvalidDefinition({ type: function tooShort () {} });
    });

    it(`throws if "required" is not a boolean`, () => {
      expectInvalidDefinition({ required: 'true' });
      expectInvalidDefinition({ required: 1 });
      expectInvalidDefinition({ required: 0 });
    });

    it(`throws if "enumerable" is not a boolean`, () => {
      expectInvalidDefinition({ enumerable: 'true' });
      expectInvalidDefinition({ enumerable: 1 });
      expectInvalidDefinition({ enumerable: 0 });
    });
  });

  describe('hasDefault()', () => {
    /**
     * Given a FieldValue definition, expects the FieldValue with that definition to have
     * a default.
     *
     * @param {Object} definition
     */
    function expectDefault (definition) {
      expect(
        (new FieldValue(definition)).hasDefault()
      ).toEqual(true);
    }

    it(`returns true if the FieldValue has a default`, () => {
      expectDefault({ default: 'foo' });

      // undefined is a legal default value
      expectDefault({ default: undefined });
    });

    it(`returns false if the FieldValue has no default`, () => {
      expect(
        (new FieldValue({})).hasDefault()
      ).toEqual(false);
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
