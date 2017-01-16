import _ from 'lodash';

/**
 * Possible string results of the typeof operator.
 * @type {String[]}
 */
const TYPE_STRINGS = [
  'object', 'string', 'number', 'symbol', 'boolean', 'function', 'undefined'
];

const privates = new WeakMap();

class RecordSchema {
  constructor (schema) {
    // Throw if the schema is invalid
    validateRecordSchema(schema);

    privates.set(this, Object.freeze(schema));
  }

  /**
   * Given a property name, returns true if the property name is specified
   * in the schema.
   *
   * @param {String} propertyName
   * @return {boolean}
   */
  hasProperty (propertyName) {
    return propertyName in privates.get(this);
  }

  /**
   * Given a potential input for a Record, removes any keys from the input
   * that aren't present on the schema.
   *
   * @param {Object} input
   * @return {Object}
   */
  removeInvalidInputKeys (input) {
    const schema = privates.get(this);

    return _.pick(
      input,
      Object.keys(schema)
    );
  }

  /**
   * Given a potential input for a Record, validates the input.
   * Specifically, tests each key/value of the input and throws if one of the pairs
   * is invalid according to the Schema.
   *
   * @param {Object} input
   * @return {boolean}
   */
  validateInput (input) {
    const schema = privates.get(this);

    if (!_.isNil(input) && !_.isPlainObject(input)) {
      throw new Error(`Record input must either be nil or a plain object.`);
    }

    return _.every(
      _.keys(schema),
      key => validateInputValue(key, schema, input)
    );
  }

  /**
   * Given a potential input for a Record, replaces any not-present values with
   * the value specified by the Schema. Does nothing to defined values.
   *
   * @param {Object} input
   * @return {Object}
   */
  applyDefaults (input) {
    const schema = privates.get(this);

    // Since the defaults don't change over the lifetime of the schema,
    // we compute the defaults only once and then cache them.
    if (!this.__schemaDefaults) {
      this.__schemaDefaults = _.mapValues(
        _.pickBy(
          schema,
          schemaValue => _.has(schemaValue, 'default')
        ),
        _.property('default')
      )
    }

    return _.defaults(input, this.__schemaDefaults);
  }

  /**
   * Given a Record input, returns an accessor object (suitable for use
   * with Object.defineProperties) for the input values.
   *
   * @param {Object} input
   * @return {{}<RecordAccessor>}
   */
  getAccessorsForInput (input) {
    const schema = privates.get(this);

    return _.mapValues(
      _.pick(
        input,
        Object.keys(schema)
      ),
      (value, key) => RecordAccessor(value)
    );
  }
}

/**
 * Given a key name, a schema, and some a potential input for a Record, tests the value
 * at the key in the input for validity according to the schema.
 *
 * Specifically, throws if the value isn't valid according to the schema.
 *
 * @param {String} key
 * @param {RecordSchema} schema
 * @param {Object} recordInput
 * @return {boolean}
 */
function validateInputValue (key, schema, recordInput) {
  // We treat nil input (which is potentially valid) as an empty object.
  recordInput = _.isNil(recordInput) ? {} : recordInput;

  const schemaValue = schema[key];

  // Check for required fields (that also don't have a default)
  if (!(key in recordInput)) {
    if (isFieldRequired(key, schema)) {
      throw new Error(
        `"${key}" is missing from the record ${JSON.stringify(recordInput)}.`
      );
    }

    // Key is optional & not supplied
    return true;
  }

  // If the type is unspecified, we're done.
  if (!('type' in schemaValue)) {
    return true;
  }

  // Check the type
  const inputValue = recordInput[key];
  if (!isValidForType(schemaValue.type, inputValue)) {
    throw new Error(
      `The value ${JSON.stringify(inputValue)} at "${key}" is invalid.`
    );
  }

  return true;
}

/**
 * Given a key (field name) and a schema, returns true if the key must be specified on
 * Record input.
 *
 * A key doesn't need to be specified if either:
 *    required is falsey
 *    a default value is provided
 *
 * @param {String} key
 * @param {RecordSchema} schema
 * @return {Boolean}
 */
function isFieldRequired (key, schema) {
  const schemaValue = schema[key];

  return (
    schemaValue.required &&
    !('default' in schemaValue)
  );
}

/**
 * Returns true if a given object is a valid RecordSchema.
 * Throws a RecordSchemaValidationError if the schema is invalid.
 *
 * @param {*} recordSchema
 * @return {boolean}
 */
function validateRecordSchema (recordSchema) {
  if (!_.isPlainObject(recordSchema)) {
    throw new RecordSchemaValidationError('A RecordSchema must be a plain object.')
  }

  if (isEmptyObject(recordSchema)) {
    throw new RecordSchemaValidationError(`A RecordSchema must be a plain object with more than 0 enumerable keys.`)
  }

  // Every value must be individually valid
  return _.every(
    recordSchema,
    isRecordSchemaValue
  );
}

/**
 * A RecordAccessor:
 *   has a getter that returns the input value
 *   has a setter that throws
 *   may or may not be enumerable
 *   is not configurable
 *
 * RecordAccessors are intended for use with Object.defineProperty()
 *
 * @property {function} get
 * @property {function} set
 * @property {boolean} enumerable
 * @property {boolean} configurable
 *
 * @param {ValueType} value - the value to provide accessors for
 * @param {Boolean} isEnumerable - whether or not the property is enumerable
 * @return {{get: (function(): ValueType), set: (function(*)), enumerable: boolean}}
 * @template ValueType
 */
function RecordAccessor (value, isEnumerable = true) {
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
 * Returns true if an object is "empty". Any empty object either:
 *
 *    1. is plain and has 0 enumerable keys.
 *    2. is null or undefined
 *
 * @param {*} object - the value to test
 * @return {boolean}
 */
function isEmptyObject (object) {
  return (
    _.overEvery(
      _.isPlainObject,
      _.isEmpty
    )(object) ||
    _.isNil(object)
  );
}

/**
 * RecordSchemas are plain objects whose values are also plain objects that must conform to
 * a specific format. The RecordSchema values may only contain the following enumerable keys:
 *
 *    'type': either
 *        1. A TYPE_STRING
 *        2. A function of arity 1
 *
 *    'default' any value
 *
 *    'required': a Boolean
 *
 * Additionally, if a type and default are both specified then the default value must validate
 * according to the type.
 *
 * @param {*} recordSchemaValue
 * @return {boolean}
 */
function isRecordSchemaValue (recordSchemaValue) {
  if (isEmptyObject(recordSchemaValue)) {
    return true;
  }

  // Any enumerable key other than 'type', 'default', or 'required' is invalid
  if (doesSchemaValueContainInvalidKeys(recordSchemaValue)) {
    throw new RecordSchemaValidationError(`${JSON.stringify(recordSchemaValue)} contains an invalid key.`);
  }

  // Test type, default, and required for individual correctness.
  // Each value can be undefined.
  const individuallyCorrectValues = conformsExistingKeys({
    'type': function (typeValue) {
      if (isTypeString(typeValue) || isValidatorFunction(typeValue)) {
        return true;
      }

      throw new RecordSchemaValidationError(`"type" is invalid.`);
    },

    'default': function (defaultValue) {
      return true;
    },

    'required': function (requiredValue) {
      if (_.isBoolean(requiredValue)) {
        return true;
      }

      throw new RecordSchemaValidationError(`"required" is invalid.`)
    }
  })(recordSchemaValue);

  if (!individuallyCorrectValues) {
    // Shouldn't get here -- the key validators should just throw themselves.
    throw new RecordSchemaValidationError(`${JSON.stringify(recordSchemaValue)} contains an invalid value.`);
  }

  // If it doesn't have a type AND a default, we're done.
  if (!('type' in recordSchemaValue) || !('default' in recordSchemaValue)) {
    return true;
  }

  // If type and default are both specified, make sure the default validates
  // according to the type.
  if (!isValidForType(recordSchemaValue.type, recordSchemaValue.default)) {
    throw new RecordSchemaValidationError(`The default value is not valid according to the type.`);
  }

  return true;
}

/**
 * Just like lodash's _.conforms, but only tests the predicates in source
 * if the object actually has the key.
 *
 * @param {Object} source
 * @return {function(Object): Boolean}
 */
function conformsExistingKeys (source) {
  if (!_.isPlainObject(source)) {
    throw new Error(`source must be a plain object.`);
  }

  return object => {
    const specForObject = _.pick(source, Object.keys(object));
    return _.conforms(specForObject)(object);
  };
}

/**
 * Given a Schema value, returns true if the value contains enumerable keys other than
 *
 *    type, default, and required
 *
 * @param {Object} schemaValue
 * @return {boolean}
 */
function doesSchemaValueContainInvalidKeys (schemaValue) {
  return (
    _.difference(
      _.keys(schemaValue),
      [ 'type', 'default', 'required' ]
    ).length > 0
  );
}

/**
 * Given a type and some potential value, returns true if the value is a valid
 * instance of the type.
 *
 * @param {String|Function|undefined} type - type of the value
 * @param {*} value - the value to check
 * @return {boolean}
 */
function isValidForType (type, value) {
  switch (typeof type) {
    // If the definition has no type, every value is valid.
    //
    // Note: a RecordSchema is not allowed to have a type equal to undefined.
    // This function still has a case for undefined because this function
    // can't distinguish between a type of undefined and a key actually
    // not be being present.
    case 'undefined':
      return true;

    // If type is a string, we just make sure 'typeof value' matches the type.
    case 'string':
      return typeof value === type;

    // If type is a function (it's a validator function), we pass in value and
    // return the result (coerced to a boolean).
    case 'function':
      return !!type(value);

    default:
      throw new Error(`The type ${type} is not a valid type definition.`);
  }
}

function isTypeString (typeString) {
  return (
    _.isString(typeString) &&
    _.includes(TYPE_STRINGS, typeString.toLowerCase())
  )
}

function isValidatorFunction (validatorFunction) {
  return (
    _.isFunction(validatorFunction) && validatorFunction.length === 1
  )
}

function RecordSchemaValidationError (message) {
  Error.call(this, message);
  this.name = 'RecordSchemaValidationError';
  this.message = message;
}

export default RecordSchema;
