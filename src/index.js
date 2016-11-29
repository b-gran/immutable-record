import _ from 'lodash';
import FieldValue from './FieldValue';

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

  // Convert each of the value definitions to FieldValue:s.
  // Note: this will throw if any of the definitions are invalid.
  const fieldValues = _.mapValues(
    shape,
    valueDefinition => new FieldValue(valueDefinition)
  );

  // A store for private variables
  const privates = new WeakMap();

  // Initialize accessors function so we can add accessors to records
  const accessors = getAccessorsForShape(fieldValues);

  // Initialize defaults function so we can clean input.
  const defaults = useRecordDefaults(fieldValues);

  // Create a class with this specific shape
  function Record (values) {
    // Clean input & add defaults
    const cleanInput = defaults(values);

    // Store private vars
    privates.set(this, cleanInput);

    // Add accessors to self
    Object.defineProperties(this, accessors(cleanInput));
  }

  /**
   * Immutably update a property of this record. Specifically, returns a new Record identical
   * to this Record, except whose value at `property` is set to `newValue`.
   *
   * @param {String} property - the property to update
   * @param {*} newValue - the new value of the property
   * @return {Record}
   */
  Record.prototype.set = function (property, newValue) {
    if (!(property in fieldValues)) {
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
 * Given the shape of a Record, returns a function that takes an input object and replaces
 * any fields that aren't present on the input with the Record's defaults.
 *
 * Also removes any fields from the input that aren't present on the shape.
 *
 * @param {{}.<FieldValue>} fieldValues - the shape of the Record
 * @return {function({}): {}}
 */
function useRecordDefaults (fieldValues) {
  // Store the defaults and keys in a closure
  const recordDefaults = getDefaults(fieldValues);
  const validKeys = Object.keys(fieldValues);

  return recordValues => {
    // Remove any invalid keys
    const prunedValues = _.pick(recordValues, validKeys);

    // Add defaults when a value is missing from the input
    return _.defaults(
      prunedValues,
      recordDefaults
    );
  };
}

/**
 * Given the shape of a record, return an object containing only the default values specified
 * for the record.
 *
 * If the record has no defaults specified, {} will be returned.
 *
 * @param {{}.<FieldValue>} fieldValues - shape of the Record
 * @return {{}.<*>}
 */
function getDefaults (fieldValues) {
  return _.mapValues(
    // Only want fields that have a default value
    _.pickBy(
      fieldValues,
      fieldValue => fieldValue.hasDefault()
    ),

    // Select the default value
    fieldValue => fieldValue.default
  )
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
        // The property should only be enumerable if it's present on the underlying record value.
        const isEnumerable = fieldName in recordValues;

        // Create a getter for this specific fieldName & value.
        // The setter for this property will throw.
        const getter = {
          [fieldName]: createAccessorWithValue(recordValues[fieldName], isEnumerable)
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
 *
 * @param {ValueType} value - the value to provide accessors for
 * @param {Boolean} isEnumerable - whether or not the property is enumerable
 * @return {{get: (function(): ValueType), set: (function(*)), enumerable: boolean}}
 *
 * @template ValueType
 */
function createAccessorWithValue (value, isEnumerable = true) {
  return {
    get: () => value,

    // Throw on set
    set: x => {
      throw new Error('Use the "set" function to update the values of an ImmutableRecord.')
    },

    enumerable: isEnumerable,
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