const LEVEL_CONFIG = {
    info: { label: 'INFO', emoji: 'ℹ️', method: 'info' },
    warn: { label: 'WARN', emoji: '⚠️', method: 'warn' },
    error: { label: 'ERROR', emoji: '⛔', method: 'error' },
    debug: { label: 'DEBUG', emoji: '🐛', method: 'debug' },
};

const formatTimestamp = () => new Date().toISOString();

const mergeContext = (baseContext = {}, context = {}) => ({
    ...baseContext,
    ...context,
});

const hasContext = (context = {}) => context && Object.keys(context).length > 0;

const logWithConfig = (config, message, context, emojiOverride) => {
    const icon = emojiOverride || config.emoji;
    const timestamp = formatTimestamp();
    const prefix = `${icon}  ${config.label} ${timestamp}`;
    const formattedMessage = `${prefix} - ${message}`;

    if (hasContext(context)) {
        console[config.method](formattedMessage, context);
    } else {
        console[config.method](formattedMessage);
    }
};

export const createLogger = (scope = '', baseContext = {}) => {
    const scopedContext = baseContext;

    const log = (level, message, context = {}, emojiOverride) => {
        const config = LEVEL_CONFIG[level];

        if (!config) {
            throw new Error(`Unsupported log level: ${level}`);
        }

        const mergedContext = mergeContext(scopedContext, context);
        const scopedMessage = scope ? `[${scope}] ${message}` : message;

        logWithConfig(config, scopedMessage, mergedContext, emojiOverride);
    };

    return {
        info: (message, context = {}, emoji) => log('info', message, context, emoji),
        warn: (message, context = {}, emoji) => log('warn', message, context, emoji),
        error: (message, context = {}, emoji) => log('error', message, context, emoji),
        debug: (message, context = {}, emoji) => log('debug', message, context, emoji),
        child: (additionalContext = {}) =>
            createLogger(scope, mergeContext(scopedContext, additionalContext)),
    };
};
