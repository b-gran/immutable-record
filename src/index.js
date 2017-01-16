import _ from 'lodash';
import RecordSchema from './RecordSchema';

/**
 * Returns a Record class based on the shape supplied to this function.
 *
 * @param shape
 * @param name
 * @return {Record}
 */
function ImmutableRecord (shape, name) {
  // Initialize a new schema based on the supplied shape
  const schema = new RecordSchema(shape);

  // A store for private variables
  const privates = new WeakMap();

  // Create a class with this specific shape
  function Record (values) {
    // Validate input
    schema.validateInput(values);

    // Clean input & add defaults
    const cleanInput = schema.applyDefaults(
      schema.removeInvalidInputKeys(values)
    );

    // Store private vars
    privates.set(this, cleanInput);

    // Add accessors to self
    Object.defineProperties(this, schema.getAccessorsForInput(cleanInput));
  }

  // Update the record's name
  Object.defineProperty(Record, 'name', {
    // This is the default Function.name configuration
    // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/name
    writable: false,
    enumerable: false,
    configurable: true,
    value: name || 'Record'
  });

  /**
   * Immutably update a property of this record. Specifically, returns a new Record identical
   * to this Record, except whose value at `property` is set to `newValue`.
   *
   * @param {String} property - the property to update
   * @param {*} newValue - the new value of the property
   * @return {Record}
   */
  Record.prototype.set = function (property, newValue) {
    assertValidProperty(schema, property);

    return getRecordConstructor(this)(
      update(
        privates.get(this),
        property,
        newValue
      )
    );
  };

  /**
   * Immutably remove a property from this record. Specifically, returns a new Record identical
   * to this Record, except with no value at `property`.
   *
   * If the Record has a default value, the returned Record will have the default value at the
   * removed property.
   *
   * Attempting to remove a required property will throw.
   *
   * @param {String} property - the property to remove
   * @return {Record}
   */
  Record.prototype.remove = function (property) {
    assertValidProperty(schema, property);

    return getRecordConstructor(this)(
      unsetField(
        privates.get(this),
        property
      )
    );
  };

  function toString () {
    const fields = Object
      .keys(this)
      .map(key => `  ${key}: ${JSON.stringify(this[key])}`)
      .join(',\n');

    return (
      `${Record.name} {\n` +
      fields + ` }`
    );
  }

  Record.prototype.toString = toString;
  Record.prototype.inspect = toString;

  return Record;
}

/**
 * Given a Record instance, returns a function that returns new Records
 * based on the instance's constructor.
 *
 * This function is used for chaining:
 * if a consumer has subclassed Record, we want to make sure our chain
 * functions returns instances of the subclass (and not vanilla Records).
 *
 * The returned function passes all of the arguments to the instance's
 * constructor.
 *
 * @param {Object} recordInstance
 * @return {function(...*): *}
 */
function getRecordConstructor (recordInstance) {
  const Konstructor = Object.getPrototypeOf(recordInstance).constructor;
  return function () {
    return new (Function.prototype.bind.apply(Konstructor, [ null, ...arguments ]));
  }
}

/**
 * Immutably update a single top-level field of an object.
 *
 * Specifically: given an object, a field name, and a value, returns a new
 * object identical to the original object except with the field set to the
 * value.
 *
 * This function operates on a shallow clone of the object.
 *
 * @param {Object} object
 * @param {String} field
 * @param {*} value
 * @return {Object}
 */
function update (object, field, value) {
  if (!_.isObject(object)) {
    return object;
  }

  return _.set(
    _.clone(object),
    field,
    value
  );
}

/**
 * Immutably remove a single top-level field of an object.
 *
 * Specifically: given an object and a field name, returns a new
 * object identical to the original object except with the field removed.
 *
 * This function operates on a shallow clone of the object.
 *
 * @param {Object} object
 * @param {String} field
 * @return {Object}
 */
function unsetField (object, field) {
  if (!_.isObject(object)) {
    return object;
  }

  const shallowClone = _.clone(object);
  _.unset(shallowClone, field);
  return shallowClone;
}

/**
 * Given a Record shape and a property name, returns true if the property is in the shape and
 * throws otherwise.
 *
 * @param {RecordSchema} schema - Record's Schema
 * @param {String} property - the property name
 * @return {boolean}
 */
function assertValidProperty (schema, property) {
  if (!schema.hasProperty(property)) {
    throw new Error(`"${property}" is not a valid field.`)
  }

  return true;
}


export default ImmutableRecord;