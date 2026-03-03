/**
 * Token counting module
 * Handles counting tokens for prompts using tiktoken or fallback heuristics
 */

/**
 * Token count result
 */
export interface TokenCountResult {
  tokens: number;
  method: "tiktoken" | "heuristic";
  accuracy: "high" | "low";
}

/**
 * Count tokens using heuristic (characters / 3.5)
 * Fallback when tiktoken is not available
 *
 * @param {string} text - Text to count tokens for
 * @returns {number} Estimated token count
 */
function countTokensHeuristic(text: string): number {
  // Rough approximation: 1 token ≈ 3.5 characters
  // More refined: count words and estimate
  const words = text.split(/\s+/).length;
  const avgTokensPerWord = 1.3; // Most words are 1-2 tokens
  return Math.ceil(words * avgTokensPerWord);
}

/**
 * Count tokens in a string
 * Attempts to use tiktoken for OpenAI models, falls back to heuristic
 *
 * @param {string} text - Text to count tokens for
 * @param {string} modelId - Model ID (optional, for future tiktoken selection)
 * @returns {TokenCountResult} Token count with metadata
 */
export function countTokens(text: string, modelId?: string): TokenCountResult {
  try {
    // For OpenAI models, we would use tiktoken here
    // For now, we use the heuristic method
    // In a real implementation, we'd try to load @dqbd/tiktoken

    const tokens = countTokensHeuristic(text);
    return {
      tokens,
      method: "heuristic",
      accuracy: "low",
    };
  } catch {
    const tokens = countTokensHeuristic(text);
    return {
      tokens,
      method: "heuristic",
      accuracy: "low",
    };
  }
}

/**
 * Count tokens and provide more precise estimate
 * This version includes a simple character-based improvement
 *
 * @param {string} text - Text to count tokens for
 * @returns {TokenCountResult} Token count
 */
export function countTokensImproved(text: string): TokenCountResult {
  // Improved heuristic that considers:
  // - Actual character count
  // - Special characters and punctuation
  // - Word boundaries

  const cleanText = text.trim();
  const charCount = cleanText.length;
  const wordCount = cleanText.split(/\s+/).filter((w) => w.length > 0).length;
  const specialChars = (cleanText.match(/[^\w\s]/g) || []).length;

  // Refined formula
  const baseTokens = Math.ceil(charCount / 4); // More refined than 3.5
  const wordAdjustment = Math.ceil(wordCount * 0.3); // Additional tokens for word boundaries
  const punctAdjustment = Math.ceil(specialChars * 0.5); // Special chars count as partial tokens

  const estimated = baseTokens + wordAdjustment + punctAdjustment;

  return {
    tokens: Math.max(1, estimated),
    method: "heuristic",
    accuracy: "low",
  };
}

/**
 * Estimate output tokens based on input tokens and model type
 * Uses patterns observed in LLM behavior
 *
 * @param {number} inputTokens - Number of input tokens
 * @param {string} modelType - Type of model (e.g., "openai", "anthropic")
 * @returns {number} Estimated output tokens
 */
export function estimateOutputTokens(inputTokens: number, modelType?: string): number {
  // Default estimation based on input size
  // Most conversational responses are 1.5-2.5x input size

  // Very short inputs: likely to generate longer responses (relatively)
  if (inputTokens < 50) {
    return Math.ceil(inputTokens * 3);
  }

  // Short inputs: 2-3x multiplier
  if (inputTokens < 200) {
    return Math.ceil(inputTokens * 2.5);
  }

  // Medium inputs: 1.5-2x multiplier
  if (inputTokens < 500) {
    return Math.ceil(inputTokens * 2);
  }

  // Long inputs: closer to 1-1.5x
  if (inputTokens < 2000) {
    return Math.ceil(inputTokens * 1.5);
  }

  // Very long inputs: minimal output expected
  return Math.ceil(inputTokens * 0.8);
}

/**
 * Format tokens for display with proper abbreviation
 *
 * @param {number} tokens - Token count
 * @returns {string} Formatted token string
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Validate token count (ensure it's reasonable)
 *
 * @param {number} tokens - Token count to validate
 * @returns {boolean} True if token count is reasonable
 */
export function validateTokenCount(tokens: number): boolean {
  // Reasonable range: 1 to 2 million tokens (for safety)
  return tokens >= 1 && tokens <= 2000000;
}
