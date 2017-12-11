
const LOG_VERBOSE   = 5;
const LOG_DEBUG     = 4;
const LOG_INFO      = 3;
const LOG_WARN      = 2;
const LOG_ERROR     = 1;
const LOG_NO_LOG    = 0;

const LOG_CUR_LEVEL = LOG_VERBOSE;

const logv = (...args) => LOG_CUR_LEVEL >= LOG_VERBOSE && console.log.apply(null, ["[V]", ...args]);
const logd = (...args) => LOG_CUR_LEVEL >= LOG_DEBUG && console.log.apply(null, ["[D]", ...args]);
const logi = (...args) => LOG_CUR_LEVEL >= LOG_INFO  && console.info.apply(null, ["[I]", ...args]);
const logw = (...args) => LOG_CUR_LEVEL >= LOG_WARN  && console.warn.apply(null, ["[W]", ...args]);
const loge = (...args) => LOG_CUR_LEVEL >= LOG_ERROR && console.error.apply(null, ["[E]", ...args]);
