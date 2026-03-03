/**
 * Token counting module
 * Handles counting tokens for prompts using tiktoken or chars/4 fallback
 */

import { get_encoding } from "@dqbd/tiktoken";
import type { Tiktoken } from "@dqbd/tiktoken";

/**
 * Token count result
 */
export interface TokenCountResult {
  tokens: number;
  method: "tiktoken" | "heuristic";
  accuracy: "high" | "low";
}

// Attempt to load tiktoken encoder at module init (cl100k_base covers GPT-4, GPT-3.5, embeddings)
let _encoder: Tiktoken | null = null;
try {
  _encoder = get_encoding("cl100k_base");
} catch {
  // tiktoken unavailable — will fall back to chars/4 heuristic
}

/**
 * Returns true for model IDs that belong to OpenAI
 */
function isOpenAIModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return (
    lower.startsWith("gpt-") ||
    lower.startsWith("o1") ||
    lower.startsWith("o3") ||
    lower.startsWith("text-embedding")
  );
}

/**
 * Count tokens using tiktoken (cl100k_base encoding)
 */
function countWithTiktoken(text: string): number {
  if (_encoder === null) throw new Error("tiktoken encoder not available");
  return _encoder.encode(text).length;
}

/**
 * Count tokens using the chars/4 heuristic
 *
 * @param {string} text - Text to count tokens for
 * @returns {number} Estimated token count
 */
function countWithHeuristic(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Count tokens in a string.
 * Uses tiktoken for OpenAI models, chars/4 fallback for all others.
 *
 * @param {string} text - Text to count tokens for
 * @param {string} modelId - Model ID to select counting method
 * @returns {TokenCountResult} Token count with metadata
 */
export function countTokens(text: string, modelId: string): TokenCountResult {
  if (_encoder !== null && isOpenAIModel(modelId)) {
    try {
      return { tokens: countWithTiktoken(text), method: "tiktoken", accuracy: "high" };
    } catch {
      // fall through to heuristic
    }
  }
  return { tokens: countWithHeuristic(text), method: "heuristic", accuracy: "low" };
}

/**
 * Count tokens with the best available method.
 * Uses tiktoken (cl100k_base) if available, otherwise chars/4 heuristic.
 * Suitable when the model is unknown or not yet selected.
 *
 * @param {string} text - Text to count tokens for
 * @returns {TokenCountResult} Token count with metadata
 */
export function countTokensImproved(text: string): TokenCountResult {
  if (_encoder !== null) {
    try {
      return { tokens: countWithTiktoken(text), method: "tiktoken", accuracy: "high" };
    } catch {
      // fall through to heuristic
    }
  }
  return { tokens: countWithHeuristic(text), method: "heuristic", accuracy: "low" };
}

/**
 * Estimate output tokens based on input tokens.
 * Uses patterns observed in LLM conversational behaviour.
 *
 * @param {number} inputTokens - Number of input tokens
 * @returns {number} Estimated output tokens
 */
export function estimateOutputTokens(inputTokens: number): number {
  if (inputTokens < 50) return Math.ceil(inputTokens * 3);
  if (inputTokens < 200) return Math.ceil(inputTokens * 2.5);
  if (inputTokens < 500) return Math.ceil(inputTokens * 2);
  if (inputTokens < 2000) return Math.ceil(inputTokens * 1.5);
  return Math.ceil(inputTokens * 0.8);
}

/**
 * Format tokens for display with proper abbreviation
 *
 * @param {number} tokens - Token count
 * @returns {string} Formatted token string
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

/**
 * Validate token count (ensure it's within a reasonable range)
 *
 * @param {number} tokens - Token count to validate
 * @returns {boolean} True if the token count is reasonable
 */
export function validateTokenCount(tokens: number): boolean {
  return tokens >= 1 && tokens <= 2000000;
}
