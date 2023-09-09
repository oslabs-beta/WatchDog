const debug = require('debug');

module.exports = function createLogger(name) {
  return {
    log: (...args) => console.log(...args),
    warning: (...args) => console.log(...args),
    highlight: (...args) => console.log(...args),
    debug: debug(name)
  };
}