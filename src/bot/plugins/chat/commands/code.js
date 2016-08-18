const Command = require('plugin').Command;
const Util = require('plugin').Util;

class Code extends Command {

	get usage() { return '<langage> text'; }
	get desc() { return 'convert text into a code block'; }

	*process(msg, suffix) {
		// Get the language.
		let language = suffix.split(/[ \n]/)[0].trim();
		if (language.length == 0) {
			return this.bot.sendMessage(msg, Util.wrap('no language specified'));
		}
		if (language === 'none') language = ''; // Blank language for no language.

		// Get the code portion.
		let code = suffix.substring(language.length).trim();

		// Insert zero width spaces in the code if noob-proof.
		if (language.startsWith('-')) {
			language = language.substring(1);
			code = code.replace(/[\.]/g, String.fromCharCode(8203) + '.');
		}

		// Edit the original message.
		return this.bot.updateMessage(msg, Util.wrap(language, code));
	}

}

module.exports = Code;
