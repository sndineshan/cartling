'use strict';

const UserSchema = require('./schemas/user');

class User {
  constructor (args = {}) {
    this.schema = UserSchema;
    this.model = new UserSchema.model(args);
  }

  reapGuests(age, cb) {
    schema.reapGuests(age, cb);
  }
}
