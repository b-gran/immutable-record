import _ from 'lodash';
import FieldValue from './FieldValue';

/**
 * Returns a Record class based on the shape supplied to this function.
 *
 * @param shape
 * @param name
 * @return {Record}
 */
function ImmutableRecord (shape, name) {
  if (!shapeHasFields(shape)) {
    throw new Error('shape must be a plain object with at least one field.')
  }

  // Convert each of the value definitions to FieldValue:s.
  // Note: this will throw if any of the definitions are invalid.
  const recordShape = _.mapValues(
    shape,
    valueDefinition => new FieldValue(valueDefinition)
  );

  // A store for private variables
  const privates = new WeakMap();

  // TODO: create a RecordShape class to encapsulate all of this functionality

  // Initialize accessors function so we can add accessors to records
  const accessors = bindAccessors(recordShape);

  // Initialize defaults function so we can clean input.
  const defaults = bindRecordDefaults(recordShape);

  // Initialize input validation function.
  const validateInput = bindValidateInput(recordShape);

  // Create a class with this specific shape
  function Record (values) {
    // Clean input & add defaults
    const cleanInput = defaults(values);

    // Validate
    validateInput(cleanInput);

    // Store private vars
    privates.set(this, cleanInput);

    // Add accessors to self
    Object.defineProperties(this, accessors(cleanInput));
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
    assertValidProperty(recordShape, property);

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
    assertValidProperty(recordShape, property);

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
 * Given the shape of a Record, returns a function that takes an input object and replaces
 * any fields that aren't present on the input with the Record's defaults.
 *
 * Also removes any fields from the input that aren't present on the shape.
 *
 * @param {{}.<FieldValue>} recordShape - the shape of the Record
 * @return {function({}): {}}
 */
function bindRecordDefaults (recordShape) {
  // Store the defaults and keys in a closure
  const recordDefaults = getDefaults(recordShape);
  const validKeys = Object.keys(recordShape);

  return recordInput => {
    // Remove any invalid keys
    const prunedValues = _.pick(recordInput, validKeys);

    // Add defaults when a value is missing from the input
    return _.defaults(
      prunedValues,
      recordDefaults
    );
  };
}

/**
 * Given a record shape, returns a function that accepts record values and returns accessors
 * for the record properties that are present on the shape.
 *
 * @param {Object} recordShape - shape of the record
 * @return {function(Object): Object}
 */
function bindAccessors (recordShape) {
  return recordInput => {
    return _.reduce(
      Object.keys(recordShape),
      (properties, fieldName) => {
        // Only create an accessor for the property if it's present on the input.
        if (!(fieldName in recordInput)) {
          return properties;
        }

        // Create a getter for this specific fieldName & value.
        // The setter for this property will throw.
        const getter = {
          [fieldName]: createAccessorWithValue(recordInput[fieldName], true)
        };

        // Add it to the properties object.
        return _.assign(properties, getter);
      },
      {}
    )
  }
}

/**
 * Given a record shape, returns a function that accepts record values and throws if the record
 * values don't validate according to the shape.
 *
 * @param {Object} recordShape - shape of the record
 * @return {function(Object): void}
 */
function bindValidateInput (recordShape) {
  // TODO: could be inefficient
  return recordInput => {
    Object.keys(recordShape).forEach(
      fieldName => {
        const fieldValue = recordShape[fieldName];
        const inputValue = recordInput[fieldName];

        // Check for required fields
        if (fieldValue.required && !(fieldName in recordInput)) {
          // TODO: this warns with the cleaned up input, so you may not get useful info
          throw new Error(
            `"${fieldName}" is missing from the record ${JSON.stringify(recordInput)}.`
          );
        }

        // Check for correct fields
        if (!fieldValue.isValid(inputValue)) {
          throw new Error(
            `The value at "${fieldName}" is invalid.`
          );
        }

        // Otherwise succeed
      }
    )
  }
}

/**
 * Given the shape of a record, return an object containing only the default values specified
 * for the record.
 *
 * If the record has no defaults specified, {} will be returned.
 *
 * @param {{}.<FieldValue>} recordShape - shape of the Record
 * @return {{}.<*>}
 */
function getDefaults (recordShape) {
  return _.mapValues(
    // Only want fields that have a default value
    _.pickBy(
      recordShape,
      fieldValue => fieldValue.hasDefault()
    ),

    // Select the default value
    fieldValue => fieldValue.default
  )
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

    // Always throw on attempted set operations.
    // This function has arity of one to comply with interpreter rules about setters,
    // even though it won't ever use the argument.
    set: x => {
      throw new Error('Use the "set" function to update the values of an ImmutableRecord.')
    },

    enumerable: isEnumerable,
    configurable: false
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
    // TODO: slow for large objects, maybe rethink this?
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
  // TODO: should be handled by RecordShape
  return _.isPlainObject(object) && Object.keys(object).length > 0;
}

/**
 * Given a Record shape and a property name, returns true if the property is in the shape and
 * throws otherwise.
 *
 * @param {{}.<FieldValue>} recordShape - the shape of the Record
 * @param {String} property - the property name
 * @return {boolean}
 */
function assertValidProperty (recordShape, property) {
  if (!(property in recordShape)) {
    throw new Error(`"${property}" is not a valid field.`)
  }

  return true;
}


export default ImmutableRecord;