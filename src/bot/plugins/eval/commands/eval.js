const Command = require('plugin').Command;
const Util = require('plugin').Util;

// Unused imports for use in eval.
const co = require('co');
const request = require('request');

class Eval extends Command {

	get usage() { return '<expression>'; }
	get desc() { return 'evaluate a JavaScript expression'; }

	*process(msg, suffix) {
		// Reformat the input message.
		if (suffix) yield this.bot.updateMessage(msg, this.config.PREFIX + this.name + Util.wrap('javascript', suffix));

		// Define the output and a print function.
		let output = '';
		let didPrint = false;
		const print = text => {
			didPrint = true;
			output += text + '\n';
		};

		// Define a shorthand promise function.
		const promise = func => {
			return new Promise(func);
		};

		let result;
		const startTime = new Date();
		try {
			// Evaluate the suffix.
			result = eval(suffix);
		} catch (e) {
			// Something went wrong, so return the message.
			return this.bot.sendMessage(msg, Util.wrap('xl', '=== ERROR ===\n' + e.message));
		}

		// Check if the result is a Promise.
		if (result instanceof Promise) {
			let response = yield this.bot.sendMessage(msg, Util.wrap('Waiting for output...'));
			let previousOutput = ''; // Previous output.
			const timer = setInterval(() => {
				// If there is an update to the output.
				if (previousOutput !== output) {
					// Update the output.
					this.bot.updateMessage(response, Util.wrap('xl', output + '=== RUNNING ==='));
					previousOutput = output;
				}
			}, 1000);

			// Force the Promise to resolve in 20 seconds.
			let timedOut = false;
			const timeoutPromise = promise((resolve, reject) => {
				setTimeout(() => {
					reject(new Error('Promise timed out (20s)'));
				}, 20000);
			});

			// Wait for the promise to finish or time out.
			Promise.race([result, timeoutPromise]).then(result => {
				// Get the time taken to finish in seconds.
				const elapsed = (new Date() - startTime) / 1000;

				// Print the result or output.
				result += '\n';
				if (didPrint) result = output;
				this.bot.updateMessage(response, Util.wrap('xl', result + '=== FINISHED IN ' + elapsed + ' SECONDS ==='));

				// Clear the timer.
				clearInterval(timer);
			}).catch(err => {
				// Print the error.
				this.bot.updateMessage(response, Util.wrap('xl', '=== ERROR ===\n' + err.message));

				// Clear the timer.
				clearInterval(timer);
			});
		} else {
			// Return the result or output.
			if (didPrint) result = output;
			this.bot.sendMessage(msg, Util.wrap('xl', result));
		}
	}

}

module.exports = Eval;
