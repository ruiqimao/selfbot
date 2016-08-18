const Plugin = require('plugin').Plugin;
const Util = require('plugin').Util;

class Status extends Plugin {

	*init() {
		this.addCommand('game', require('./commands/game'));
	}

}

module.exports = Status;
