import ImmutableRecord from '../src/index';

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