import { createLogger } from '@gratheon/log-lib';
import config from '../config';

// Create logger with log level from config
// MySQL is not configured since event-stream-filter doesn't need database persistence
const { logger } = createLogger({
    logLevel: config.logLevel as 'debug' | 'info' | 'warn' | 'error'
});

export { logger };

