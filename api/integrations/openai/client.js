/**
 * ============================|| Responses API Client ||============================
 *
 * Provides a lazily-initialized instance of the official OpenAI SDK. Using the SDK keeps us
 * aligned with the latest Responses API surface area (streaming, tool support, error types)
 * without hand-rolling HTTP plumbing in each service layer.
 */

import OpenAI from 'openai';
import ApiError from '../../http/errors/ApiError.js';

let cachedInstance = null;

export const getResponsesClient = () => {
    if (cachedInstance) {
        return cachedInstance;
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        throw new ApiError(500, 'Missing OpenAI API key. Set OPENAI_API_KEY in the environment.');
    }

    // Cache the configured client so multiple calls within a request reuse the same instance.
    // SDK v5.23.2 automatically picks up `OPENAI_API_KEY` and supports project routing if we
    // need it later. Leaving the object literal explicit avoids surprises when migrating.
    cachedInstance = new OpenAI({
        apiKey,
    });

    return cachedInstance;
};

export default getResponsesClient;
