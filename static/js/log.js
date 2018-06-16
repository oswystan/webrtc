
const LOG_VERBOSE   = 5;
const LOG_DEBUG     = 4;
const LOG_INFO      = 3;
const LOG_WARN      = 2;
const LOG_ERROR     = 1;
const LOG_NO_LOG    = 0;

const LOG_CUR_LEVEL = LOG_VERBOSE;

const logv = console.log.bind(console);
const logd = console.log.bind(console);
const logi = console.info.bind(console);
const logw = console.warn.bind(console);
const loge = console.error.bind(console);
