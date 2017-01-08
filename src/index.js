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

    return new Record(
      update(
        privates.get(this),
        property,
        newValue
      )
    )
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

    // TODO: better way to do this?
    return new Record(
      _.omit(
        privates.get(this),
        [ property ]
      )
    )
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
 * Immutably update a single top-level field of a plain object.
 *
 * Specifically: given a plain object, a field name, and a value, returns a new object identical
 * to the original object except with the field set to the value.
 *
 * @param {Object} object
 * @param {String} field
 * @param {*} value
 * @return {Object}
 */
function update (object, field, value) {
  if (!_.isPlainObject(object)) {
    return object
  }

  return _.set(
    // TODO: slow for large objects, maybe rethink this?
    _.cloneDeep(object),
    field,
    value
  )
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