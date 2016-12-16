/*
 * Every record is defined by a shape, which is a mapping from field names (Strings) to
 * FieldValue:s.
 *
 * For each field name, the corresponding FieldValue describes the properties of the value.
 *
 * Here's an example:
 *
 *    Let's say we want a Record that has a property called "foo" of type String, and we want to
 *    ensure that every instance of this Record _must_ have the "foo" property.
 *
 *    Here's how we would construct that record
 *
 *      const FooRecord = ImmutableRecord({
 *          // The name of the field is "foo"
 *          foo:
 *              {
 *                  ////// This is the FieldValue definition //////
 *
 *                  // The field's type must be string
 *                  type: 'string',
 *
 *                  // This field ("foo") _must_ be present on any instances of the Record
 *                  required: true
 *              }
 *      });
 */

import _ from 'lodash';

class FieldValue {
  constructor (definition) {
    // Throw if the definition for this value is invalid.
    Definition.checkValidDefinition(definition);

    // Store the definition, substituting in defaults if they're not specified.
    this.__definition = _.defaults(
      definition || {},
      FieldValue.Defaults
    );
  }

  get required () {
    return this.__definition.required;
  }

  get enumerable () {
    return this.__definition.enumerable;
  }

  get default () {
    return this.__definition.default;
  }

  /**
   * Returns true if a default is explicitly set for the FieldValue.
   * It's possible to have a default value of "undefined", so use this function to determine
   * whether or not a default value is specified.
   *
   * @return {boolean}
   */
  hasDefault () {
    return 'default' in this.__definition;
  }

  /**
   * Given some potential value, returns true if it's valid according to our definition.
   *
   * @param {*} value - the value to check
   * @return {boolean}
   */
  isValid (value) {
    const { type } = this.__definition;

    // Just checks validity against the definition's type.
    function matchesType () {
      switch (typeof type) {
        // If the definition has no type, every value is valid.
        case 'undefined':
          return true;

        // If type is a string, we just make sure 'typeof value' matches the type.
        case 'string':
          return typeof value === type;

        // If type is a function (it's a validator function), we pass in value and
        // return the result (coerced to a boolean).
        case 'function':
          return !!type(value);
      }
    }

    if (_.isUndefined(value)) {
      return !this.required
    }

    // The value is required, but it wasn't provided.
    if (this.required && _.isUndefined(value)) {
      return false;
    }

    const notRequiredAndNotDefined = !this.required && _.isUndefined(value);

    return ( notRequiredAndNotDefined || matchesType() );
  }
}

// Default properties
FieldValue.Defaults = {
  // Can be anything
  type: undefined,

  // Not required
  required: false,

  // Is enumerable
  enumerable: true,

  // Has no default.
  // We explicitly don't provide a default value for the "default' property so that
  // ('default' in FieldValue.Defaults) returns false
  // default: undefined,
};

// TODO: This structure is bad & ugly. Do something better!
const Definition = {
  ALLOWED_KEYS: [
    'type', 'required', 'enumerable', 'default'
  ],

  TYPE_STRINGS: [
    'object', 'string', 'number', 'symbol', 'boolean', 'function', 'undefined'
  ],

  /**
   * Given a definition, returns true if it is valid and throws (with explanation) otherwise.
   *
   * @param {*} definition - the definition to test for validity.
   * @return {boolean}
   */
  checkValidDefinition: function (definition) {
    // null and {} correspond to the "don't care" definition: the value can be anything & has no
    // default.
    if (Definition.isDontCare(definition)) {
      return true;
    }

    if (!_.isPlainObject(definition)) {
      throw new Error(`A FieldValue definition must be either null or a plain object, but got ${Object.prototype.toString.call(definition)}`);
    }

    // Does the definition use any keys that aren't specifically allowed?
    const disallowedKeys = _.difference(
      Object.keys(definition),
      Definition.ALLOWED_KEYS
    );

    // If it uses disallowed keys, throw.
    if (disallowedKeys.length > 0) {
      throw new Error(
        `This definition uses the following disallowed keys: [ ${disallowedKeys.join(', ')} ]`
      );
    }

    // Make sure each of the allowed keys is valid.
    return Definition.ALLOWED_KEYS.reduce(
      (definitionIsValid, keyName) => {
        const propertyValue = definition[keyName];
        const keyIsValid = (
          _.isUndefined(propertyValue) ||
          Definition.validators[keyName](propertyValue)
        );

        return definitionIsValid && keyIsValid;
      },
      true
    )
  },

  /**
   * Returns true if the supplied definition is the "don't care" definition.
   * @return {boolean}
   */
  isDontCare: function (definition) {
    return definition === null || definition === {};
  },

  // This object must have a field for each entry in the ALLOWED_KEYS array.
  validators: {

    // Validate the "type" property of a FieldValue definition.
    // A type property is valid if it is a string corresponding to a primitive type, or if
    // it is a "validator" function with arity 1.
    type: typeDefinition => {
      if (Definition.validators._isTypeString(typeDefinition)) {
        return null;
      }

      if (Definition.validators._isValidatorFunction(typeDefinition)) {
        return null;
      }

      throw new Error('"type" must be either a type string or a validator function.')
    },

    _isTypeString: typeDefinition => {
      return (
        _.isString(typeDefinition) &&
        _.includes(Definition.TYPE_STRINGS, typeDefinition.toLowerCase())
      )
    },

    _isValidatorFunction: typeDefinition => {
      return (
        _.isFunction(typeDefinition) && typeDefinition.length === 1
      )
    },

    // Validate the "required" property of a FieldValue definition.
    // The required property must be a boolean.
    required: requiredDefinition => {
      if (_.isBoolean(requiredDefinition)) {
        return null;
      }

      throw new Error('"required" must be a boolean.');
    },

    // Validate the "enumerable" property of a FieldValue definition.
    // The enumerable property must be a boolean.
    enumerable: enumerableDefinition => {
      if (_.isBoolean(enumerableDefinition)) {
        return null;
      }

      throw new Error('"enumerable" must be a boolean.');
    },

    // Validate the "default" property of a FieldValue definition.
    // The default property can be anything.
    default: () => true,
  },
};

export default FieldValue;
