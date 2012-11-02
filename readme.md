## Mongoloid
I wrote __Mongoloid__ because every other module that claimed to implement __REST__ for __Mongoose__ was inadaquate in one way or another. With other modules I either couldn't specify a path at which my resources should be made available or I was asked to render my data with a view. I simply wanted a __RESTful__ interface to __MongoDB__ through __Mongoose__ for use with __Backbone.js__.

### Requirements

	* Async
	* MongoDB
	* Mongoose

### Basics
There are three components to __Mongoloid__:

#### Managers
Managers create a new `handler` for each __Mongoose__ model added.

Managers pass `res`, `req` and `info` (in that order) to the proper `handler` for processing. Managers won't respond to requests that are not addressed to their `path`.

`info` objects contain parsed information pertaining to a request:

	* collection : the name of the collection.
	* id : an ObjectId (if available) or null.
	* query :
		- limit : the number of objects to be returned. if negative, there is no limit.
		- skip : the number of objects from the begining to skip.
		- options : extra options parsed from GET variables to be passed to the Mongoose query.
		- method : the HTTP method.

Please note that the `query` options (i.e. `limit`, `skip`, `etc...`) are not implemented at this time.

#### Handlers
Handlers contain a chain of callbacks which are passed to `async.waterfall`. Callbacks should have a signiature of `function(data, callback)` and are expected to call `callback(<null or error>, data)` upon completion.

`data` objects contain:

	* req : a request object.
	* res : a response object.
	* info : an info object as discussed earlier.
	* self : the handler's context.

If an `error` is passed as the first argument to the callback then the chain of execution is terminated and no subsequent callbacks are fired. The order of execution is `handler.pre`, `handler.<method>`, `handler.post` where `<method>` is one of `get`, `post`, `put` or `delete`.

A JSON response is returned once `handler.method` is called. If there is an `ObjectId` in `info` then a single object is returned. If there is no `ObjectId` then an array (which may be empty) is returned.

Handlers contain a reference to the __Mongoose__ `model` for which they were created. The `model` is accessible in a callback through the `data.self.model` attriubete.

#### Middleware
Middleware (or callbacks) may be added one of two ways:

You can add middleware with the use of a `manager`'s helper function: `pre` or `post`. Middleware added in this manner is added to each `handler` the manager owns at that point in time.

Middleware can also be added directly to a `handler` through it's `pre` and `post` functions. 

You can access the `pre` and `post` arrays for a handler directly through it's `calls` object: i.e. `<manager>.handlers.<handler>.calls.<pre or post>`.

### Usage
You must have __Async__, __MongoDB__ and __Mongoose__ installed.

You can then initialize Mongoloid as follows:
```js
var mongoloid = require('mongoloid');
var manager = new mongoloid.Manager({ path: '/api/rest' });
```
Note that leading and trailing slashes in `path` are ignored.

`Manager` instances have a `router` function:
```js
...
app.configure(function() {
	...
	app.use(manager.router());
	...
});
...
```

Now we need to create some __Mongoose__ models:
```js
	var mongoose = require('mongoose');
	var db = mongoose.createConnection('localhost', 'db');

	var Document = db.model('document', new mongoose.Schema({
		title: String,
		data: String,
		value: Number,
	}));

	var Person = db.model('person', new mongoose.Schema({
		name: String,
		age: Number,
	}));
```

We can then add our models to a `manager`:
```js
	manager.add('documents', Document);
	manager.add('people', Person);
```
Now your `documents` and `people` are accessible in JSON format. To retrieve the `people` collection send a GET request to `[path]/people/`, to retrieve a specific document send a request to `[path]/documents/[some object id]`.

Finally, lets add some middleware:
```js
	// fires before JSON results have been returned to client
	// applies to both 'documents' and 'people'
	manager.pre(function(data, callback) {
		console.log(data.info); // print our info object
		try {
			// do some stuff
			callback(null, data); // continues callback chain
		} catch(err) {
			callback(err, data); // terminates callback chain
		}
	});

	// fires before JSON results have been returned to client
	// but after the previous callback has finished execution
	// applies only to 'documents'
	manager.handlers.documents.pre(function(data, callback) {
		console.log(data.info.res); // prints our response object
		try {
			// spam, spam, spam, eggs and spam
			callback(null, data); // continues callback chain
		} catch(err) {
			callback(err, data); // terminates callback chain
		}
	});

	// fires after JSON result has been returned to client
	// only applies to 'people'
	manager.handlers.people.post(function(data, callback) {
		console.log(data.info.collection); // prints 'people'
		try {
			// spam, spam, spam, eggs, bacon and spam
			callback(null, data); // continues callback chain
		} catch(err) {
			callback(err, data); // terminates callback chain
		}
	});
```

You may have multiple managers listening on different paths:
```js
	...

	var rest = mongoloid.Manager({ path: '/rest/' });
	var crud = mongoloid.Manager({ ptah: '/api/crud/' });

	...
	app.configure(function() {
		...
		app.use(rest.router());
		app.use(crud.router());
		...
	});
	...
```

### Missing Features (at this time)

	* Creation, Deletion and Updating of collections.
