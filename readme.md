## Mongoloid
I was forced to write this module because every other module that claimed to implement REST for Mongoose was inadaquate in one way or another. With other modules I either couldn't specify a path at which my resources should be made available or I was asked to render my data with a view. I simply wanted a RESTful interface to MongoDB through Mongoose for use with Backbone.js, which is exactly what I have created.

### Requirements

	* Async
	* MongoDB
	* Mongoose

### Basics
There are two components to Mongoloid:

#### Managers
Managers create a new `handler` for each Mongoose model added.

Managers pass `res`, `req` and `info` (in that order) to the proper `handler` for processing. Managers won't respond to requests that are not addressed to their __path__.

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

If an `error` is passed as the first argument to the callback then the chain of execution is terminated and no subsequent callbacks are fired. The order of execution is `handler.pre`, `handler.<method>`, `handler.post` where `<method>` is one of `get`, `post`, `put`, `delete`.

A JSON response is returned once `handler.method` is called. If there is an `ObjectId` in `info` then a single object is returned. If there is no `ObjectId` then an array (which may be empty) is returned.

#### Middleware
Middleware (or callbacks) may be added one of two ways:

The first way is through the `manager`'s helper functions `pre` and `post`. Middleware added in this manner is added to each `handler` the manager owns at that point in time.

Middleware can also be added directly to a `handler` through it's `pre` and `post` functions. 

You can access the `pre` and `post` arrays for a handler directly through it's `calls` object: i.e. `<manager>.handlers.<handler>.calls.<pre or post>`.

### Usage
Make sure you have __async__, __mongodb__ and __mongoose__ installed.

You can then initialize Mongoloid as follows:
```js
var mongoloid = require('mongoloid');
var manager = new mongoloid.Manager({ path: '/api/rest' });
```

`Manager` instances have a `route` function:
```js
...
app.configure(function() {
	...
	app.use(manager.router());
	...
});
...
```

Now we need to add some models to our `manager`:
```js
	var mongoose = require('mongoose');
	var db = mongoose.createConnection('localhost', 'mydb');

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

We can then add our models to our `manager`:
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
	manager.documents.pre(function(data, callback) {
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
	manager.people.post(function(data, callback) {
		console.log(data.info.collection); // prints 'people'
		try {
			// spam, spam, spam, eggs, bacon and spam
			callback(null, data); // continues callback chain
		} catch(err) {
			callback(err, data); // terminates callback chain
		}
	});
```

You may also have multiple managers listening on different paths:
```js
	...

	var rest = mongoloid.Manager({ path: '/rest/' });
	var crud = mongoloid.Manager({ ptah: 'crud' });

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

	* Creating, Updating and Deleting of collections.
