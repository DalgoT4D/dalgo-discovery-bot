import { createAnthropic } from '@ai-sdk/anthropic';

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
});

// User-specified model identifier. The @ai-sdk/anthropic type accepts
// `string & {}`, so non-enumerated IDs pass typecheck.
export const MODEL = 'claude-sonnet-4-6';
