const Command = require('plugin').Command;
const Util = require('plugin').Util;

const FS = require('fs');
const GD = require('node-gd');
const Request = require('request');

class Quote extends Command {

	get usage() { return '<message|user>'; }
	get desc() { return 'generate a quote of a message'; }

	*process(msg, suffix) {
		if (!suffix) return this.bot.sendMessage(msg, Util.wrap('No message given'));

		let message;

		// Check if a mention was used.
		if (msg.mentions.length) {
			const user = msg.mentions[0];

			// Try to get the latest message by the user.
			message = msg.channel.messages
				.getAll('author', user)
				.sort((a, b) => b.timestamp - a.timestamp)
				.filter(m => !m.equals(msg))
				[0];

			// If the message is null, return.
			if (!message) return this.bot.sendMessage(msg, Util.wrap('No recent messages found'));
		} else {
			// Get the message.
			message = this.bot.getMessage(suffix);

			// If the message is null, return.
			if (!message) return this.bot.sendMessage(msg, Util.wrap('Unknown message \'' + suffix + '\''));
		}

		// Get the name to display.
		const details = message.server.detailsOfUser(message.author);
		const name = (details && details.nick) || message.author.name;

		// Get the message text.
		let text = message.cleanContent;

		const path = yield new Promise((resolve, reject) => {
			// Start generating an image.
			GD.createTrueColor(600, 70, (err, img) => {
				if (err) return reject(err);

				// Get the avatar.
				const avatarPath = '/tmp/discord-avatar-' + new Date().getTime() + '-' + (Math.random() * 65535) + '.jpg';
				const writeStream = FS.createWriteStream(avatarPath);

				// Catch errors.
				writeStream.on('error', reject);

				// Wait for the stream to finish.
				writeStream.on('finish', () => {

					// Set the background color.
					img.fill(0, 0, 0xffffff);

					// Load the avatar image.
					GD.openJpeg(avatarPath, (err, avatar) => {
						if (err) return reject(err);

						// Overlay the avatar image.
						avatar.copyResized(img, 20, 10, 0, 0, 50, 50, avatar.width, avatar.height);

						// Delete the avatar image.
						FS.unlink(avatarPath);
						avatar.destroy();

						// Load the avatar overlay.
						GD.openPng(__dirname + '/quote-overlay.png', (err, overlay) => {
							if (err) return reject(err);

							// Overlay the circle.
							overlay.copy(img, 20, 10, 0, 0, 50, 50);
							overlay.destroy();

							// Add the name.
							let font = '/usr/share/fonts/TTF/arialbd.ttf';
							let color = img.colorAllocate(100, 100, 100);
							img.stringFT(color, font, 16, 0, 86, 28, name);

							// Figure out dimensions for the text.
							font = '/usr/share/fonts/TTF/arial.ttf';
							color = img.colorAllocate(120, 120, 120);
							let box;
							let width = 24;
							do {
								box = img.stringFTBBox(color, font, 16, 0, 86, 54, this.wordwrap(text, width));
								width ++;
							} while (box[2] < 600 && width < text.length);
							while (box[2] > 590) {
								box = img.stringFTBBox(color, font, 16, 0, 86, 54, this.wordwrap(text, width));
								width --;
							}
							text = this.wordwrap(text, width);

							// Create a new image.
							GD.createTrueColor(600, Math.max(70, box[3] + 10), (err, img2) => {
								if (err) return reject(err);

								// Set the background color.
								img2.fill(0, 0, 0xffffff);

								// Copy the old image onto the new image.
								img.copy(img2, 0, 0, 0, 0, img.width, img.height);
								img.destroy();

								// Add the text.
								let color = img2.colorAllocate(120, 120, 120);
								img2.stringFT(color, font, 16, 0, 86, 54, text);

								// Add a bar for the quote.
								color = GD.trueColor(240, 240, 240);
								img2.filledRectangle(0, 0, 7, img2.height, color);

								// Save the image.
								const path = '/tmp/discord-quote-' + new Date().getTime() + '-' + (Math.random() * 65535) + '.png';
								img2.savePng(path, err => {
									if (err) return reject(err);

									img2.destroy();

									// Resolve with the path.
									resolve(path);
								});
							});
						});
					});
				});

				// Make the request for the avatar.
				Request
					.get(message.author.avatarURL)
					.on('error', reject)
					.pipe(writeStream);
			});
		});

		// Delete the original message.
		this.bot.deleteMessage(msg);

		// Send the file.
		yield this.bot.sendFile(msg, path);

		// Delete the file.
		FS.unlink(path);
	}

	/*
	 * Wordwrap function.
	 *
	 * @param str The string to be wrapped.
	 * @param intWidth The column width.
	 * @param strBreak The break character(s).
	 * @param cut Whether to cut words.
	 */
	wordwrap(str, intWidth, strBreak, cut) {
		var m = ((arguments.length >= 2) ? arguments[1] : 75);
		var b = ((arguments.length >= 3) ? arguments[2] : '\n');
		var c = ((arguments.length >= 4) ? arguments[3] : true);

		var i, j, l, s, r;

		str += '';

		if (m < 1) {
			return str;
		}

		for (i = -1, l = (r = str.split(/\r\n|\n|\r/)).length; ++i < l; r[i] += s) {
			for (s = r[i], r[i] = ''; s.length > m; r[i] += s.slice(0, j) + ((s = s.slice(j)).length ? b : '')) {
				j = c === 2 || (j = s.slice(0, m + 1).match(/\S*(\s)?$/))[1]
					? m
					: j.input.length - j[0].length || c === true && m ||
					j.input.length + (j = s.slice(m).match(/^\S*/))[0].length;
			}
		}

		return r.join('\n').replace(/\n[ ]*/g, '\n');
	}

}

module.exports = Quote;
