const Log = require('../models/Log');

const logToDB = async (level, message, meta) => {
  try {
    const logEntry = new Log({
      level,
      message,
      meta,
    });
    await logEntry.save();
  } catch (error) {
    console.error('Failed to save log to database:', error);
  }
};

const logger = {
  info: (message, meta) => logToDB('info', message, meta),
  warn: (message, meta) => logToDB('warn', message, meta),
  error: (message, meta) => logToDB('error', message, meta),
  debug: (message, meta) => logToDB('debug', message, meta),
};

module.exports = logger; 