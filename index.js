var url = require('url');
var querystring = require('querystring');
var async = require('async');
var mongodb = require('mongodb');
var mongoose = require('mongoose');


function split_path(path) {
   var popfirst = poplast = false;
   var first = 0;
   var last = path.length - 1;

   if(path.charAt(first) == '/')
      popfirst = true;

   if(path.charAt(last) == '/')
      poplast = true;
   
   return path.substr(popfirst ? 1 : 0, poplast ? last - 1 : last).split('/');
}

function Handler(model) {
   this.model = model;
   this.calls = {
      pre: [],
      post: [],
   };
}


Handler.prototype = {
   process: function(req, res, info) {
      if(!/get|post|put|delete/.test(info.method))
         throw new Error('HTTP method not supported: ' + info.method);

      var self = this;
      function start(callback) {
         callback(null, { req: req, res: res, info: info, self: self });
      }
      
      var method = this.methods[info.method];
      var calls = Array(start).concat(this.calls.pre, method, this.calls.post);
      async.waterfall(calls, function(err, data) {
         if(err) {
            console.log('mongoloid.Handler.process: ' + err);
            data.res.header('Content-Type', 'application/json');
            data.res.json({ error: err.message });
         }
      });
   },

   _use: function(state, callback) {
      console.log(state, callback);
      switch(state) {
         case 'pre':
            this.calls.pre.push(callback);
            break;
         case 'post':
            this.calls.post.push(callback);
            break;
         default:
            throw new Error('Invalid state: ' + state);
      }
   },
   
   pre: function(callback) { this._use('pre', callback); },
   post: function(callback) { this._use('post', callback); },

   // XXX If these methods reside directly in the Handler prototype they 
   // aren't accessible with 'this[<method>]' but nested in the 'methods'
   // object they're accessible through this.methods[<method>]. Why?
   methods: {
      get: function(data, callback) {
         var lookup = { };
         if(data.info.id)
            lookup._id = data.info.id;

         data.self.model.find(lookup, null, null, function(err, objs) {
            if(!err) {
               data.res.header('Content-Type', 'application/json');
               data.res.json(data.info.id ? objs.pop() : objs, 200);
               callback(null, data);
            } else {
               callback(err, data);
            }
         });
      },

      post: function(data, callback) {
         data.self.model(data.req.body).save(function(err, affected) {
            if(!err) {
               data.res.header('Content-Type', 'application/json');
               data.res.json({ ok: affected }, 201);
            } else {
               callback(err, data);
            }
         });
      },

      put: function(data, callback) {
         var info = data.req.body;
         delete info._id;
         console.log(info);
         data.self.model.update({ _id: data.info.id }, info, 
            function(err, affected) {
            if(!err) {
               data.res.header('Content-Type', 'application/json');
               data.res.json({ ok: affected }, 201);
            } else {
               callback(err, data);
            }
         });
      },

      delete: function(data, callback) {
         data.self.model.findById(data.info.id, function(err, obj) {
            if(!err) {
               obj.remove();
               data.res.header('Content-Type', 'application/json');
               data.res.json({ ok: 1 }, 201);
            } else {
               callback(err, data);
            }
         });
      }
   }
}


function Manager(options) {
   this.options = options;
   this.options.path = split_path(options.path) || '';
   this.handlers = {};
}

Manager.prototype = {
   _router: function(req, res, next) {
      var info = null;
      if(info = this.parse_request(req)) {
         if(info.collection in this.handlers) {
            try {
               this.handlers[info.collection].process(req, res, info);
            } catch(err) {
               console.log('mongoloid.Manager: ' + err);
            }
         }
         else {
            res.header('Content-Type', 'application/json');
            res.json({ error: 'Collection not found.' }, 500);
         }
      } else {
         next();
      }
   },

   router: function() {
      var self = this;
      return function(req, res, next) {
         Manager.prototype._router.call(self, req, res, next); 
      }
   },

   parse_request: function(req) {
      var parsed = url.parse(req.url);
      var path = split_path(parsed.pathname);

      if(this.options.path && this.verify_path(path))
         path = path.slice(this.options.path.length);
      else
         return null;

      var GET = querystring.parse(parsed.query);
      var query = {
         limit: GET.limit < 0 ? null : 100,
         skip: GET.skip || 0,
         options: GET.query || null,
      };
      
      return { collection: path[0], 
               id: path[1], 
               query: query,
               method: req.method.toLowerCase() };
   },

   verify_path: function(path) {
      function array_cmp(a, b) { return !(a>b || a<b); }

      var path = path.slice(0, this.options.path.length);
      if(array_cmp(this.options.path, path))
         return true
      return false
   },

   add: function(name, model) {
      this.handlers[name] = new Handler(model);
   },

   remove: function(name) {
      delete this.handlers[name];
   },

   _use: function(state, callback) {
      for(handler in this.handlers)
         this.handlers[handler][state](callback);
   },

   pre: function(callback) { this._use('pre', callback); },
   post: function(callback) { this._use('post', callback); },
}

exports.Manager = Manager;
