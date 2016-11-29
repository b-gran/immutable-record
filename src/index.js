import _ from 'lodash';

/**
 * Returns a Record class based on the shape supplied to this function.
 *
 * @param shape
 * @param name
 * @return {Record}
 * @constructor
 */
function ImmutableRecord (shape, name) {
  if (!shapeHasFields(shape)) {
    throw new Error('shape must be a plain object with at least one field.')
  }

  // A store for private variables
  const privates = new WeakMap();

  // Clone shape so the caller can't modify it later on.
  const ownShape = _.cloneDeep(shape);
  const validKeys = Object.keys(ownShape);

  // Initialize this accessors function so we can add accessors to records
  const accessors = getAccessorsForShape(ownShape);

  // Create a class with this specific shape
  function Record (values) {
    // Remove any invalid keys
    const prunedValues = _.pick(values, validKeys);

    // Store private vars
    privates.set(this, prunedValues);

    // Add accessors to self
    Object.defineProperties(this, accessors(prunedValues));
  }

  /**
   * Immutably update a property of this record.
   *
   * @param {String} property
   * @param {*} newValue
   * @return {Record}
   */
  Record.prototype.set = function (property, newValue) {
    if (!(property in ownShape)) {
      throw new Error(`"${property}" is not a valid field.`)
    }

    return new Record(
      update(
        privates.get(this),
        property,
        newValue
      )
    )
  };

  return Record;
}

/**
 * Given a record shape, returns a function that accepts record values and returns accessors
 * for the record properties that are present on the shape.
 *
 * @param {Object} recordShape - shape of the record
 * @return {function(Object): Object}
 */
function getAccessorsForShape (recordShape) {
  return recordValues => {
    return _.reduce(
      Object.keys(recordShape),
      (properties, fieldName) => {
        // Create a getter for this specific fieldName & value.
        // The setter for this property will throw.
        const getter = {
          [fieldName]: createAccessorWithValue(recordValues[fieldName])
        };

        // Add it to the properties object.
        return _.assign(properties, getter)
      },
      {}
    )
  }
}

/**
 * Given some value, return an accessor for that value.
 *
 * The accessors have the following properties:
 *    1. getter simply returns the record value
 *    2. setter always throws
 *    3. the accessor is enumerable
 *
 * @param {ValueType} value - the value to provide accessors for
 * @return {{get: (function(): ValueType), set: (function(*)), enumerable: boolean}}
 *
 * @template ValueType
 */
function createAccessorWithValue (value) {
  return {
    get: () => value,

    // Throw on set
    set: x => {
      throw new Error('Use the "set" function to update the values of an ImmutableRecord.')
    },

    enumerable: true,
  }
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
    _.cloneDeep(object),
    field,
    value
  )
}

/**
 * Returns true if the input object is a valid "shape" object -- one that defines the shape of an
 * ImmutableRecord.
 *
 * A shape object:
 *   * is a plain object
 *   * has one or more keys
 *   * no restrictions placed on values
 *
 * @param {*} object
 * @return {boolean}
 */
function shapeHasFields (object) {
  return _.isPlainObject(object) && Object.keys(object).length > 0;
}

export default ImmutableRecord;