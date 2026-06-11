import { createLogger } from '@gratheon/log-lib';
import config from '../config';

type LogMetadata = Record<string, unknown>;

// Create logger with log level from config
// MySQL is not configured since event-stream-filter doesn't need database persistence
const { logger } = createLogger({
    logLevel: config.logLevel as 'debug' | 'info' | 'warn' | 'error'
});

const serializeError = (error: Error): LogMetadata => ({
    name: error.name,
    message: error.message,
    stack: error.stack ?? '',
});

const isMetadataRecord = (value: unknown): value is LogMetadata => (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Error)
);

const serializeErrorValues = (metadata: unknown): unknown => {
    if (metadata instanceof Error) {
        return serializeError(metadata);
    }

    if (!isMetadataRecord(metadata)) {
        return metadata;
    }

    const serialized: LogMetadata = {};
    for (const [key, value] of Object.entries(metadata)) {
        serialized[key] = value instanceof Error ? serializeError(value) : value;
    }

    return serialized;
};

const originalError = logger.error.bind(logger) as (message: unknown, metadata?: unknown) => unknown;

(logger as { error: (message: unknown, metadata?: unknown) => unknown }).error = (message, metadata) => {
    if (message instanceof Error) {
        const metadataRecord = isMetadataRecord(metadata)
            ? serializeErrorValues(metadata) as LogMetadata
            : metadata === undefined
                ? {}
                : { metadata: serializeErrorValues(metadata) };

        // Error properties are non-enumerable, so JSON-based log formatters print them as `{}`.
        // Normalize Error instances into explicit metadata before passing them to the shared logger.
        return originalError(message.message, {
            ...metadataRecord,
            ...serializeError(message),
        });
    }

    return originalError(message, serializeErrorValues(metadata));
};

export { logger };

