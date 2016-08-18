const Plugin = require('plugin').Plugin;
const Util = require('plugin').Util;

class Chat extends Plugin {

	*init() {
		this.addCommand('tag', require('./commands/tag'));
		this.addCommand('code', require('./commands/code'));
		this.addCommand('purge', require('./commands/purge'));
		this.addCommand('quote', require('./commands/quote'));
	}

}

module.exports = Chat;
