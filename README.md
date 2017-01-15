## `immutable-record` -- plain, immutable Javascript objects with validation

`immutable-recrd` is a small JavaScript library inspired by Facebook's ImmutableJS
that allows you to create immutable `Records`. `Records` behave very much like
Objects (even `Object.keys()`), but they are immutable and have automatic type
validation.

### What does it look like?

```
// ImmutableRecord() returns a Record class
import ImmutableRecord from 'immutable-record'
const Record = ImmutableRecord({
  foo: { default: 5 },
  optional: { type: 'number' }
  someField: {
    type: value => 'foo' in value,
    equired: true
  },
})

// You just pass ordinary objects to the Record constructor
const object = new Record({
  someField: { foo: 'bar' }
  // You don't have to provide optional fields
})

// Object.keys() works as if the Record was a normal Object
Object.keys(object) // [ 'foo', 'someField' ]

// Records are immutable, so Record#set() returns a new Record
const another = object.set('optional', 8)
another.optional // 8

// Validation happens automatically
object.remove('someField')
// Error: "someField" is missing from the record {"foo":5}

```

### Why pick `immutable-record` ?

Compared to ImmutableJS, the key feature is __automatic validation.__ With 
`immutable-record`, you can specify a type of each field and it will be 
automatically checked. Additionally:

* `Object.keys()` works just how you would expect
* You can mark fields as `required`
* You can create optional fields that may not be present on a record, but will 
validate when set.

## Documentation

### Installing

```
# immutable-record is available on npm
npm install --save immutable-record
```

### Importing

```
import ImmutableRecord from 'immutable-record'

// If you're not using ES6 modules
const ImmutableRecord = require('immutable-record')
```

### Creating Records

The ImmutableRecord() function takes an object whose values describe the 
validation that is applied to the fields.

```
const Record = ImmutableRecord({
  optional: { type: 'string' },
  required: { required: true },
  validation: {
    type: value => value > 5,
    default: 6
})
```

You can also pass a second parameter to the ImmutableRecord() function
which specifies a custom name for the Record class.

```
const Foo = ImmutableRecord({
    foo: { type: 'string' }
}, 'Foo')
Foo.name === 'Foo' // true
console.log(Foo) // [Function: Foo]
```

There are three validation options available for each field:
> > `type`, `required`, and `default`

#### The `type` option

1. A primitive string (AKA one of the values returned by typeof). The possible 
values at the time of writing are:
> > 'object', 'string', 'number', 'symbol', 'boolean',
function', 'undefined'

2. A validation function that takes a single argument (the field's value) and 
returns a boolean.

```
const Record = ImmutableRecord({
  // Strings (typeof x === 'string') are valid
  string: { type: 'string' },

  // Arrays of length 4 or greater are valid
  array: {
    type: value => (
      Array.isArray(value) &&
      value.length > 3
    )
  }
})
```

#### The `default` option

If a field has a default and a Record is created without the field explicitly set,
the default value is used automatically.

```
const Record = ImmutableRecord({
  withDefault: { default: 5 }
})

// The default is automatically used if the field isn't set
const object = new Record({})
object.withDefault // 5

// undefined is a legal field value, so the default won't be used
const noDefault = new Record({
  withDefault: undefined
})
noDefault.withDefault // undefined
```

#### The `required` option

Fields marked as "required" must be present on the Record for it to validate.

```
const Record = ImmutableRecord({
  required: { required: true },
  optional: { required: false }
})

// No problems here
const object = new Record({
  required: 1
})
'optional' in object // false

// This doesn't work
const bad = new Record({
  optional: 1
})
// Error: "required" is missing from the record {"optional":1}
```

If a field is required and it also has a default, the Record will still validate
even if the field isn't set.

```
const Record = ImmutableRecord({
  field: {
    required: true,
    default: 5
  }
})

// No problems here
const object = new Record({})
object.field // 5
```

#### Fields with no options

You can also leave the options out to get optional, untyped fields.

```
const Record = ImmutableRecord({
  optionalUntyped: {},

  // setting the field equal to null works too
  alsoWorks: null
})
```

### Using Records

Records mostly work just like normal Objects, except they're immutable.

```
const ABCRecord = ImmutableRecord({
  a: {}, b: {}, c: {}
})

const object = new ABCRecord({ a: 1, c: 3 })
object.a // 1
object.c // 3
object.b // undefined
'b' in object // false

// Object.keys() also works how you would expect
Object.keys(object) // [ 'a', 'c' ]
```

When you try to set or delete a Record's value directly, the Record will throw.

```
const object = new ABCRecord({ a: 1, c: 3 })

object.b = 2
// Error: Use the "set" function to update the values of an ImmutableRecord.

delete object.a
// TypeError: Cannot delete property 'a' of [object Object]
```

#### `Record#set()`

Use the `set()` function to update Record values. `set()` returns a new Record instance.

```
const object = new ABCRecord({ a: 1, c: 3 })

const withB = object.set('b', 2)
withB instanceof ABCRecord // true
withB.b // 2

// The original record is unmodified
object.b // undefined
```

#### `Record#remove()`

Use the `remove()` function to remove Record values. `remove()` returns a new Record instance.

```
const object = new ABCRecord({ a: 1, b: 2, c: 3 })

const withoutB = object.remove('b')
withoutB instanceof ABCRecord // true
withoutB.b // undefined
```

#### A point about validation

Records are validated when they are constructed, so all of your fields will be validated
when you use `set()` and `remove()`.
