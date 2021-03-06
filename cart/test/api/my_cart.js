'use strict';

var should = require('should');
var request = require('supertest');
var _ = require('lodash');
var async = require('async');

var helpers = require('../helpers');
var models = helpers.models;
var Cart = models.Cart;
var User = models.User;
var ActivityLog = models.ActivityLog;
var intents = helpers.common.intents;

var server = require('../app')(helpers.config);

describe('API', function() {

  describe('my cart', function() {

    this.timeout(10000);
    var user;
    var notMyCart;
    var myCart;

    before(function(done) {
      async.parallel([
        ActivityLog.deleteAll.bind(ActivityLog),
        Cart.deleteAll.bind(Cart),
        function(cb) {
          User.delete('testuser', cb);
        }
      ],
        function(cb) {
          async.parallel([
            function(cb) {
              User.create({ username: 'testuser' }, function(err, reply) {
                if (err) { return cb(err); }
                user = reply;
                cb();
              });
            },
            function(cb) {
              Cart.create({ foo: 'bar' }, function(err, cart) {
                if (err) { return done(err); }
                notMyCart = cart;
                cb();
              });
            }
          ], done);
        }
      );
    });

    after(function(done) {
      async.parallel([
        ActivityLog.deleteAll.bind(ActivityLog),
        Cart.deleteAll.bind(Cart),
        function(cb) {
          User.delete('testuser', cb)
        }
      ], done);
    });

    it('can create', function(done) {
      var attrs = { foo: 'bobo' };
      request(server)
        .post('/my/carts')
        .send(attrs)
        .end(function(err, res) {
          if (err) { return done(err); }
          res.status.should.eql(200);
          myCart = res.body;
          myCart.uuid.should.not.be.null;
          myCart.foo.should.equal('bobo');
          done();
        });
    });

    it('can intercept and abort create', function(done) {
      var attrs = { foo: 'bobo' };
      intents.before('create', 'cart', function(intent, done) {
        intent.subject.username.should.equal('testuser');
        intent.op.should.equal('create');
        intent.target.type.should.equal('cart');
        intent.target.get('foo').should.equal(attrs.foo);
        var err = new Error('no way, forget it');
        err.statusCode = 401;
        done(err);
      });
      request(server)
        .post('/my/carts')
        .send(attrs)
        .end(function(err, res) {
          intents.clearAll();
          if (err) { return done(err); }
          res.status.should.eql(401);
          done();
        });
    });

    it('can list all', function(done) {
      request(server)
        .get('/my/carts')
        .end(function(err, res) {
          if (err) { return done(err); }
          res.status.should.eql(200);
          var entities = res.body;
          entities.should.be.an.Array;
          entities.length.should.equal(1);
          var cart = entities[0];
          cart.uuid.should.equal(myCart.uuid);
          done();
        });
    });

    it('can get my cart', function(done) {
      request(server)
        .get('/my/carts/' + myCart.uuid)
        .end(function(err, res) {
          if (err) { return done(err); }
          res.status.should.eql(200);
          var cart = res.body;
          cart.uuid.should.equal(myCart.uuid);
          done();
        });
    });

    it('cannot get not my cart', function(done) {
      request(server)
        .get('/my/carts/' + notMyCart.uuid)
        .end(function(err, res) {
          if (err) { return done(err); }
          res.status.should.eql(404);
          done();
        });
    });

    it('can update my cart', function(done) {
      should.exist(myCart);
      var body = { bar: 'babs' };
      request(server)
        .put('/my/carts/' + myCart.uuid)
        .send(body)
        .end(function(err, res) {
          if (err) { return done(err); }
          res.status.should.eql(200);
          var cart = res.body;
          cart.uuid.should.equal(myCart.uuid);
          cart.bar.should.equal('babs');
          done();
        });
    });

    it('can intercept and abort updating my cart', function(done) {
      should.exist(myCart);
      var body = { bar: 'babs' };
      intents.before('update', 'cart', function(intent, done) {
        intent.subject.username.should.equal('testuser');
        intent.op.should.equal('update');
        intent.target.uuid.should.equal(myCart.uuid);
        should.deepEqual(intent.data, body);
        var err = new Error('no way, forget it');
        err.statusCode = 501;
        done(err);
      });
      request(server)
        .put('/my/carts/' + myCart.uuid)
        .send(body)
        .end(function(err, res) {
          intents.clearAll();
          if (err) { return done(err); }
          res.status.should.eql(501);
          done();
        });
    });

    it('cannot update not my cart', function(done) {
      should.exist(notMyCart);
      var body = { bar: 'babs' };
      request(server)
        .put('/my/carts/' + notMyCart.uuid)
        .send(body)
        .end(function(err, res) {
          res.status.should.eql(404);
          done();
        });
    });

    it('can intercept and abort closing my cart', function(done) {
      should.exist(myCart);
      intents.before('delete', 'cart', function(intent, done) {
        intent.subject.username.should.equal('testuser');
        intent.op.should.equal('delete');
        intent.target.uuid.should.equal(myCart.uuid);
        var err = new Error('no way, forget it');
        err.statusCode = 301;
        done(err);
      });
      request(server)
        .del('/my/carts/' + myCart.uuid)
        .end(function(err, res) {
          intents.clearAll();
          if (err) { return done(err); }
          res.status.should.eql(301);
          done();
        });
    });

    it('can close my cart', function(done) {
      should.exist(myCart);
      request(server)
        .del('/my/carts/' + myCart.uuid)
        .end(function(err, res) {
          res.status.should.eql(200);

          // should no longer be visible
          request(server)
            .get('/my/carts/' + myCart.uuid)
            .end(function(err, res) {
              intents.clearAll();
              if (err) { return done(err); }
              res.status.should.eql(404);
              done();
            });
        });
    });

  });
});
