/**
 * Structured logging utility
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

let currentLogLevel = LOG_LEVELS.INFO;

/**
 * Set the logging level
 * @param {string} level - One of: 'debug', 'info', 'warn', 'error'
 */
export function setLogLevel(level) {
  const levelMap = {
    debug: LOG_LEVELS.DEBUG,
    info: LOG_LEVELS.INFO,
    warn: LOG_LEVELS.WARN,
    error: LOG_LEVELS.ERROR,
  };
  currentLogLevel = levelMap[level.toLowerCase()] ?? LOG_LEVELS.INFO;
}

/**
 * Log a debug message
 */
export function debug(...args) {
  if (currentLogLevel <= LOG_LEVELS.DEBUG) {
    console.debug("[DEBUG]", ...args);
  }
}

/**
 * Log an info message
 */
export function info(...args) {
  if (currentLogLevel <= LOG_LEVELS.INFO) {
    console.log(...args);
  }
}

/**
 * Log a warning message
 */
export function warn(...args) {
  if (currentLogLevel <= LOG_LEVELS.WARN) {
    console.warn("[WARN]", ...args);
  }
}

/**
 * Log an error message
 */
export function error(...args) {
  if (currentLogLevel <= LOG_LEVELS.ERROR) {
    console.error("[ERROR]", ...args);
  }
}
