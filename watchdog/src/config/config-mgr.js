const logger = require('../logger.js');
const configuredLogger = logger('config:mgr');
const { cosmiconfigSync } = require('cosmiconfig');
const schema = require('./schema.json');
const betterAjvErrors = require('better-ajv-errors').default;
const Ajv = require('ajv');
const ajv = new Ajv.default({ JSONPointers: true });
const configLoader = cosmiconfigSync('watchdog');
const { resolve } = require("path");


module.exports =  function getConfig() {
  const result = configLoader.search(resolve(__dirname, '../..'));
  if (!result) {
    configuredLogger.warning('Could not find configuration, using default');
    return { port: 1234 };
  } else {
    const isValid = ajv.validate(schema, result.config);
    if (!isValid) {
      configuredLogger.warning('Invalid configuration was supplied');
      console.log(betterAjvErrors(schema, result.config, ajv.errors));
      process.exit(1);
    }
    configuredLogger.debug('Found configuration', result.config);
    return result.config;
  }
}