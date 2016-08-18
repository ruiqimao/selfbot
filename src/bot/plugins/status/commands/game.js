const Command = require('plugin').Command;
const Util = require('plugin').Util;

class Game extends Command {

	get usage() { return '[set] [game]'; }
	get desc() { return 'manage the current playing game'; }

	*process(msg, suffix) {

		// Get the command.
		const command = suffix.split(/[ \n]/)[0].toLowerCase();
		switch (command) {
			case 'set': {
				// Set the game.
				const game = suffix.substring(command.length).trim();
				this.client.setPlayingGame(game);
				return this.bot.sendMessage(msg, Util.wrap('Game set'));
			}
			case 'clear': {
				// Clear the current playing game.
				this.client.setPlayingGame(null);
				return this.bot.sendMessage(msg, Util.wrap('Game cleared'));
			}
			default: {
				// Show the current playing game.
				const game = this.client.user.game;
				if (game) {
					return this.bot.sendMessage(msg, Util.wrap(game.name));
				} else {
					return this.bot.sendMessage(msg, Util.wrap('<No game set>'));
				}
			}
		}

	}

}

module.exports = Game;
