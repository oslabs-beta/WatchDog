const logger = require('../logger.js');
const configuredLogger = logger('commands:start');

module.exports = function start(config) {
//   eval('npm run test'); 
    configuredLogger.highlight('  Starting the app  ');
    configuredLogger.debug('Received configuration', config);
}