/**
 * HTTP statuses worth retrying: rate limit, server errors, Anthropic
 * "overloaded". Shared by the image import and the Test Connection ping; kept
 * in its own module so the ping does not pull the (lazily loaded) image
 * import into the main bundle.
 */
export const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504, 529]);
