const Command = require('plugin').Command;
const Util = require('plugin').Util;

class Purge extends Command {

	get usage() { return '<number>'; }
	get desc() { return 'delete your last <number> messages'; }

	*process(msg, suffix) {
		// Get the number of messages.
		let number = parseInt(suffix);
		if (isNaN(number) || number < 1) {
			return this.bot.sendMessage(msg, Util.wrap('Invalid number'));
		}

		// Get the messages to delete and delete them.
		number ++;
		while (number > 0) {
			let messages =
				(yield this.bot.getChannelLogs(msg, 100))
					.filter(message => message.author.equals(msg.author));
			const num = Math.min(number, messages.length);
			messages = messages.slice(0, num);
			if (num > 0) {
				// Delete the messages one by one.
				for (const message of messages) {
					yield this.bot.deleteMessage(message);
				}
				number -= num;
			} else {
				break;
			}
		}
	}

}

module.exports = Purge;
