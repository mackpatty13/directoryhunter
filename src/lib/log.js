function ts() {
  return new Date().toISOString();
}

function format(level, msg, data) {
  const base = `[${ts()}] ${level.toUpperCase()} ${msg}`;
  if (data === undefined) return base;
  try {
    return `${base} ${JSON.stringify(data)}`;
  } catch {
    return `${base} [unserializable data]`;
  }
}

export const log = {
  info(msg, data) {
    console.log(format('info', msg, data));
  },
  warn(msg, data) {
    console.warn(format('warn', msg, data));
  },
  error(msg, data) {
    console.error(format('error', msg, data));
  },
  debug(msg, data) {
    if (process.env.LOG_DEBUG === 'true') {
      console.log(format('debug', msg, data));
    }
  }
};
