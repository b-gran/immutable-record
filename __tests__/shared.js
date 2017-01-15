import _ from 'lodash';

expect.extend({

  toBeSameSet (receivedSet, expectedSet) {
    const same = sameSet(receivedSet, expectedSet);

    return {
      pass: same,
      message: (
        `Expected the (actual) set ${stringify(receivedSet)} to ${not(same)}have the ` +
        `same elements as ${stringify(expectedSet)}`
      )
    }
  },

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

/**
 * Just calls Object.prototype.toString with the argument.
 * @param {*} obj
 * @return {String}
 */
export function objectToString (obj) {
  return Object.prototype.toString.call(obj);
}

/**
 * Returns a string representation of an object. First tries to JSON.stringify, then
 * falls back to Object.prototype.toString.
 * @param {*} obj
 * @return {String}
 */
export function stringify (obj) {
  try {
    return JSON.stringify(obj);
  } catch (err) {
    return objectToString(obj);
  }
}

/**
 * For use with jest expect extensions: simplifies error messages for the chainable "not".
 * @param {*} passed
 * @return {String}
 */
export function not (passed) {
  return passed ? 'not ' : '';
}

/**
 * Throws if the argument isn't an Array.
 * @param {*} array
 * @return {null}
 */
function expectArray (array) {
  if (!Array.isArray(array)) {
    throw new Error(
      `Expected array to be an Array, but got ${objectToString(array)}`
    );
  }

  return null;
}

/**
 * Given two arrays, returns true if they are the same when treated as sets.
 * Specifically, returns true if the two arrays contain the same elements without
 * respect to ordering after duplicates are removed.
 *
 * Using _.isEqual for equality, so e.g.
 *
 *    sameSet(
 *      [ {a:'a'}, {a:'a'} ],
 *      [ {a:'a'} ]
 *    ) === true
 *
 * @param {Array} source
 * @param {Array} dest
 * @return {boolean}
 */
function sameSet (source, dest) {
  expectArray(source);
  expectArray(dest);

  const sourceUniq = _.uniqWith(source, _.isEqual);
  const destUniq = _.uniqWith(dest, _.isEqual);

  if (sourceUniq.length !== destUniq.length) {
    return false;
  }

  // Add the source elements to a Set.
  const elements = new Set();
  sourceUniq.forEach(el => elements.add(el));

  // Make sure every dest element is present in the set.
  return _.every(
    destUniq,
    el => {
      // If this succeeds, we're done.
      if (elements.has(el)) {
        elements.delete(el);
        return true;
      }

      // The values might be objects though, so we still need to check
      // the remaining elements with a deep equality check.
      for (let other of elements) {
        if (_.isEqual(other, el)) {
          elements.delete(other);
          return true;
        }
      }

      return false;
    }
  )
}

// So jest won't complain when it tries to run this file.
describe.skip('', () => it.skip(``, null));
