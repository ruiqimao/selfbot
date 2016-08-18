const Plugin = require('plugin').Plugin;

class Eval extends Plugin {

	*init() {
		this.addCommand('eval', require('./commands/eval'));
	}

}

module.exports = Eval;
