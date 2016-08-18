const Command = require('plugin').Command;
const Util = require('plugin').Util;

class Tag extends Command {

	get usage() { return '[set|remove|list] [name]'; }
	get desc() { return 'manage or show tags'; }

	*init() {
		// Create a new model for tags.
		this.Tag = this.bot.createModel('tag');
	}

	*process(msg, suffix) {
		// Get the command.
		const command = suffix.split(/[ \n]/)[0].toLowerCase();
		switch (command) {

			// Act accordingly.
			case 'set': {
				suffix = suffix.substring(command.length).trim();
				const tag = suffix.split(/[ \n]/)[0].trim();
				const content = suffix.substring(tag.length).trim();
				yield this.setTag(tag, content, msg);
				return;
			}
			case 'global': {
				yield this.makeGlobal(suffix.substring(command.length).trim(), msg);
				return;
			}
			case 'remove': {
				yield this.removeTag(suffix.substring(command.length).trim(), msg);
				return;
			}
			case 'list': {
				yield this.listTags(msg);
				return;
			}
			default: {
				yield this.showTag(suffix, msg);
				return;
			}

		}
	}

	/*
	 * Gets a tag entry in the database.
	 *
	 * @param name The name of the tag.
	 * @param server The server ID.
	 */
	*getTag(name, server) {
		// Try to find the tag.
		const entries = yield this.Tag.find({
			'tag': name,
			$or: [
				{ 'server': server },
				{ 'server': '' }
			]
		});

		// Return the tag if found.
		if (entries.length > 0) return entries[0];

		// Otherwise return a new tag.
		return new this.Tag({
			'tag': name,
			'server': server
		});
	}

	/*
	 * Sets a tag.
	 *
	 * @param tag The tag.
	 * @param content The content.
	 * @param msg The message that triggered the command.
	 */
	*setTag(tag, content, msg) {
		// Check if the tag or content is empty.
		if (!tag || !content) return this.bot.sendMessage(msg, Util.wrap('Invalid tag'));

		// Get the tag entry.
		const entry = yield this.getTag(tag, msg.server.id);

		// Set the content and save.
		entry.set('content', content);
		yield entry.save();

		this.bot.sendMessage(msg, Util.wrap('Tag \'' + tag + '\' saved'));
	}

	/*
	 * Makes a tag global.
	 *
	 * @param tag The tag.
	 * @param msg The message that triggered the command.
	 */
	*makeGlobal(tag, msg) {
		// Get the tag.
		const entry = yield this.getTag(tag, msg.server.id);

		// If the tag doesn't exist, return.
		if (!entry.get('content')) return this.bot.sendMessage(msg, Util.wrap('No such tag \'' + tag + '\''));

		// Remove all local tags with the name.
		yield this.Tag.remove({
			'tag': tag,
			'server': { $ne: entry.get('server') }
		});

		// Set the tag to global and save.
		entry.set('server', '');
		yield entry.save();

		this.bot.sendMessage(msg, Util.wrap('Global tag \'' + tag + '\' set'));
	}

	/*
	 * Removes a tag.
	 *
	 * @param tag The tag.
	 * @param msg The message that triggered the command.
	 */
	*removeTag(tag, msg) {
		// Try to find the tag.
		const entry = yield this.getTag(tag, msg.server.id);

		// If there is no tag, return.
		if (!entry.get('content')) return this.bot.sendMessage(msg, Util.wrap('No such tag \'' + tag + '\''));

		// Remove the entry.
		yield entry.remove();

		this.bot.sendMessage(msg, Util.wrap('Tag \'' + tag + '\' removed'));
	}

	/*
	 * List tags.
	 *
	 * @param msg The message that triggered the command.
	 */
	*listTags(msg) {
		// Find all tags.
		const entries = yield this.Tag.sort('tag', 1).find({
			$or: [
				{ 'server': msg.server.id },
				{ 'server': '' }
			]
		});

		// Create the list of tags.
		const tags = entries.map(entry => entry.get('tag') + (entry.get('server') ? '' : ' *'));

		// Send the list of tags.
		this.bot.sendMessage(msg, Util.wrap(tags.join('\n')));
	}

	/*
	 * Show a tag.
	 *
	 * @param tag The tag.
	 * @param msg The message that triggered the command.
	 */
	*showTag(tag, msg) {
		// Get the tag.
		const entry = yield this.getTag(tag, msg.server.id);

		// If there is no tag, return.
		if (!entry.get('content')) return this.bot.sendMessage(msg, Util.wrap('No such tag \'' + tag + '\''));

		// Delete the original message.
		this.bot.deleteMessage(msg);

		// Return the tag.
		this.bot.sendMessage(msg, entry.get('content'));
	}

}

module.exports = Tag;
