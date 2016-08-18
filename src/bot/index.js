const Client = require('discord.js').Client;
const EventEmitter = require('events');

const Mongorito = require('mongorito');
const Model = require('mongorito').Model;

const co = require('co');
const decache = require('decache');

class Bot extends EventEmitter {

	/*
	 * Creates the bot.
	 *
	 * @param authorization The authorization data.
	 */
	constructor(authorization) {
		super();

		// Assign the member variables.
		this.authorization = authorization;
		this.config = require('./config');
		this.client = null;
		this.db = null;
		this.plugins = [];
		this.queue = [];

		// Set functions to queueify.
		const queueify = [
			'sendMessage',
			'sendTTSMessage',
			'sendFile',
			'reply',
			'replyTTS',
			'awaitResponse',
			'updateMessage',
			'deleteMessage',
			'deleteMessages',
			'getChannelLogs',
			'pinMessage',
			'unpinMessage',
			'getPinnedMessages'
		];

		// Queueify functions.
		for (const func of queueify) {
			this[func] = function() {
				return this.pushQueue({
					func: this.client[func].bind(this.client),
					args: arguments
				});
			}.bind(this);
		}
	}

	/*
	 * Start the bot.
	 */
	start() {
		// Attempt to connect to the database if one is specified.
		if (this.authorization.mongo_uri && this.db === null) {
			Mongorito.connect(this.authorization.mongo_uri).then(db => {
				this.db = db;

				// Try starting again.
				this.start();
			}).catch(this.error);

			return;
		}

		// Create a new client.
		this.client = new Client({
			forceFetchUsers: true,
			rateLimitAsError: true
		});

		// Catch all errors.
		this.client.on('error', err => this.emit('error', err));

		// Catch disconnect.
		this.client.on('disconnected', () => this.emit('end'));

		// Wait for ready.
		this.client.on('ready', () => {
			this.emit('connect');

			// Steal the resolver.
			this.resolver = this.client.internal.resolver;

			// Load everything.
			this.reload()
				.then(() => {
					this.emit('ready')
				})
				.catch(this.error);
		});

		// Catch messages.
		this.client.on('message', this.handleMessage.bind(this));

		// Login.
		if (this.authorization.token) {
			// Token takes precedence.
			this.client.loginWithToken(this.authorization.token)
				.catch(err => this.emit('error', err));
		} else {
			// Otherwise try email and password.
			this.client.login(this.authorization.email, this.authorization.password)
				.catch(err => this.emit('error', err));
		}
	}

	/*
	 * Stop the bot.
	 */
	stop() {
		// Unload all the plugins.
		this.unload()
			.then(() => {
				// Disconnect from the database.
				if (this.db) this.db.close();

				// Exit (can't log out a userbot).
				process.exit(0);
			})
			.catch(this.error);
	}

	/*
	 * Emit an error.
	 *
	 * @param err The error to emit.
	 */
	error(err) {
		// Emit the error.
		this.emit('error', err);
	}

	/*
	 * Load a/all plugin(s).
	 *
	 * @param name The name of the plugin to unload. Unload all if not defined.
	 *
	 * @return A Promise.
	 */
	load(name) {
		return co(function*() {
			// If the name is undefined, load all the plugins.
			if (name === undefined) {
				// Load all plugins in the config.
				for (const plugin of this.config.PLUGINS) {
					yield this.load(plugin).catch(this.error);
				}
			} else {
				// Make sure the plugin isn't already loaded.
				if (this.plugins.find(element => element.name === name)) {
					throw new Error(`Plugin "${ name }" is already loaded.`);
				}

				// Load the plugin.
				const Plugin = require('./plugins/' + name);
				const plugin = new Plugin(this);
				this.plugins.push({
					name: name,
					plugin: plugin
				});
				yield plugin.load();
				console.log(`Loaded plugin "${ name }".`);
			}
		}.bind(this));
	}

	/*
	 * Unload a/all plugin(s).
	 *
	 * @param name The name of the plugin to unload. Unload all if not defined.
	 *
	 * @return A Promise.
	 */
	unload(name) {
		return co(function*() {
			// If the name is undefined, unload all the plugins.
			if (name === undefined) {
				const plugins = this.plugins.slice();
				for (const plugin of plugins) {
					yield this.unload(plugin.name).catch(this.error);
				}
			} else {
				// Unload the plugin.
				const index = this.plugins.findIndex(element => element.name === name);
				const plugin = this.plugins[index];
				if (plugin === undefined) throw new Error(`No plugin with name "${ name }".`);
				yield plugin.plugin.unload();
				this.plugins.splice(index, 1);
				decache('./plugins/' + name);
				console.log(`Unloaded plugin "${ name }".`);
			}
		}.bind(this));
	}

	/*
	 * Reload everything.
	 *
	 * @return A Promise.
	 */
	reload() {
		return co(function*() {
			// Unload all the plugins.
			yield this.unload();

			// Reload the config.
			decache('./config');
			this.config = require('./config');

			// Load all the plugins.
			yield this.load();
		}.bind(this));
	}

	/*
	 * Handle a message.
	 */
	handleMessage(msg) {
		co(function*() {
			// Selfbot: ignore all messages other than from itself.
			if (!msg.author.equals(this.client.user)) return;

			// Trim and ensure the contents of the message start with the prefix.
			const contents = msg.content.trim();
			if (!contents.startsWith(this.config.PREFIX)) return;

			// Get the parts of the command.
			const commandBase = contents.split(/[ \n]/)[0];
			const commandName = commandBase.substring(this.config.PREFIX.length).trim();
			const commandSuffix = contents.substring(commandBase.length).trim();

			// Check if the command is actually a command.
			const command = this.commands.find(element => element.name === commandName);
			if (command !== undefined) {
				// Run the command.
				yield command.command.run(msg, commandSuffix);
			}
		}.bind(this))
			.catch(this.error);
	}

	/*
	 * Get the list of commands.
	 */
	get commands() {
		return this.plugins.reduce(
			(p, c) => p.concat(c.plugin.commands),
			[]);
	}

	/*
	 * Pushes to the queue.
	 *
	 * @param request The request to add to the queue.
	 *
	 * @return A Promise that resolves when the request is completed.
	 */
	pushQueue(request) {
		return new Promise((resolve, reject) => {
			// Add callbacks to the request.
			request.resolve = val => {
				resolve(val);
			};
			request.reject = err => {
				reject(err);
			};

			// Set a function that adds to a given queue.
			const addToQueue = id => {
				// Check if the queue exists.
				if (!this.queue[id]) this.queue[id] = [];

				// Get the queue.
				const queue = this.queue[id];

				// Add the request to the queue.
				queue.push(request);

				// If the item is the only item in the queue, execute it.
				if (queue.length == 1) {
					this.executeQueue(queue);
				}
			};

			// Check if the first argument resolves to a channel.
			this.resolver.resolveChannel(request.args[0]).then(channel => {
				// Push to that channel's specific queue.
				addToQueue(channel.id);
			}).catch(() => {
				// Otherwise push to the global queue.
				addToQueue('');
			});
		});
	}

	/*
	 * Executes an entire queue.
	 *
	 * @param queue The queue to execute.
	 *
	 * @return A Promise that resolves after the request goes through.
	 */
	executeQueue(queue) {
		return new Promise((resolve, reject) => {
			// If the queue is empty, return.
			if (queue.length == 0) return;

			// Get the first item.
			const request = queue[0];

			// Execute it.
			request.func.apply(this, request.args)
				.then(result => {
					request.resolve(result);

					// Remove the request from the queue.
					queue.shift();

					// Move onto the next one.
					this.executeQueue(queue).then(resolve).catch(reject);
				})
				.catch(err => {
					if (err.status === 429) {
						// Intercept rate limit errors.
						const retry = err.response.header['retry-after'];
						setTimeout(() => {
							// Try again.
							this.executeQueue(queue).then(resolve).catch(reject);
						}, retry);
					} else {
						// Throw everything else.
						request.reject(err);
						this.error(err);

						// Remove the request from the queue.
						queue.shift();

						// Move onto the next one.
						this.executeQueue(queue).then(resolve).catch(reject);
					}
				});
		});
	}

	/*
	 * Get a cached message.
	 *
	 * @param id The message id.
	 *
	 * @return A Message if it exists, null otherwise.
	 */
	getMessage(id) {
		// Iterate through all the channels.
		for (const channel of this.client.channels) {
			// Get the message if it exists.
			if (channel.messages) {
				const message = channel.messages.get(id);
				if (message) return message;
			}
		}
		return null;
	}

	/*
	 * Create a database model.
	 *
	 * @param collection The collection name.
	 *
	 * @return A Mongorito model.
	 */
	createModel(collection) {
		// Make sure a database connection is established.
		if (this.db) {
			const db = this.db;

			// Return the model.
			return class extends Model {
				db() { return db; }
				collection() { return collection; }

				/*
				 * Grab the entry for a specific server.
				 *
				 * @param id The id of the server.
				 * @param def The default value.
				 *
				 * @return A Promise that resolves to the entry.
				 */
				static forServer(id, def) {
					return co(function*() {
						const entries = yield this.limit(1).find({
							'server': id
						});
						if (entries.length == 0) {
							return new this({
								'server': id,
								'val': def
							});
						} else {
							return entries[0];
						}
					}.bind(this));
				}

				set val(value) { this.set('val', value); }
				get val() { return this.get('val'); }
			}
		} else {
			throw new Error('No database connection.');
		}
	}

}

module.exports = Bot;
