// Set the production flag and error printing function.
global.IS_PRODUCTION = (process.env.NODE_ENV && process.env.NODE_ENV.toLowerCase() === 'production');

// Add the lib folder as a path for imports.
require('app-module-path').addPath(__dirname + '/lib');

// Start!
require('./src').main();
