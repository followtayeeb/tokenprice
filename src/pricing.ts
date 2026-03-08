/**
 * Pricing data loader module
 * Handles loading and managing LLM pricing data
 */

import { readFileSync } from "fs";
import { writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Pricing data for an LLM model
 */
export interface ModelPricing {
  id: string;
  name: string;
  provider: string;
  inputPrice: number; // USD per million tokens
  outputPrice: number; // USD per million tokens
  contextWindow: number; // tokens
  supportsBatch: boolean;
  description: string;
  releaseDate: string;
}

/**
 * Complete pricing database
 */
export interface PricingDatabase {
  version: string;
  updated: string;
  models: ModelPricing[];
  sources?: Record<string, string>;
}

/**
 * Load pricing data from the embedded JSON file
 * Falls back to inline data if file not found
 *
 * @returns {PricingDatabase} The pricing database
 */
export function loadPricingData(): PricingDatabase {
  try {
    const pricingPath = join(__dirname, "..", "data", "pricing.json");
    const data = readFileSync(pricingPath, "utf-8");
    return JSON.parse(data) as PricingDatabase;
  } catch {
    // Fallback to inline pricing data
    return getDefaultPricingData();
  }
}

/**
 * Get default pricing data (fallback)
 *
 * @returns {PricingDatabase} Default pricing database
 */
function getDefaultPricingData(): PricingDatabase {
  return {
    version: "1.0.0",
    updated: "2026-03-03T00:00:00Z",
    models: [
      {
        id: "claude-opus-4-5-20251101",
        name: "Claude Opus 4.5",
        provider: "Anthropic",
        inputPrice: 5.0,
        outputPrice: 25.0,
        contextWindow: 200000,
        supportsBatch: true,
        description: "Most capable Anthropic model",
        releaseDate: "2025-11-01",
      },
      {
        id: "claude-sonnet-4-5-20250514",
        name: "Claude Sonnet 4.5",
        provider: "Anthropic",
        inputPrice: 3.0,
        outputPrice: 15.0,
        contextWindow: 200000,
        supportsBatch: true,
        description: "Balanced capability and speed",
        releaseDate: "2025-05-14",
      },
      {
        id: "claude-haiku-4-5-20250514",
        name: "Claude Haiku 4.5",
        provider: "Anthropic",
        inputPrice: 1.0,
        outputPrice: 5.0,
        contextWindow: 200000,
        supportsBatch: true,
        description: "Fastest Anthropic model",
        releaseDate: "2025-05-14",
      },
      {
        id: "gpt-4-turbo",
        name: "GPT-4.1",
        provider: "OpenAI",
        inputPrice: 2.0,
        outputPrice: 8.0,
        contextWindow: 128000,
        supportsBatch: true,
        description: "Advanced reasoning",
        releaseDate: "2024-04-09",
      },
      {
        id: "gpt-4o",
        name: "GPT-4o",
        provider: "OpenAI",
        inputPrice: 2.5,
        outputPrice: 10.0,
        contextWindow: 128000,
        supportsBatch: true,
        description: "Multimodal reasoning",
        releaseDate: "2024-05-13",
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o-mini",
        provider: "OpenAI",
        inputPrice: 0.4,
        outputPrice: 1.6,
        contextWindow: 128000,
        supportsBatch: true,
        description: "Compact multimodal",
        releaseDate: "2024-07-18",
      },
      {
        id: "o3",
        name: "o3",
        provider: "OpenAI",
        inputPrice: 10.0,
        outputPrice: 40.0,
        contextWindow: 128000,
        supportsBatch: false,
        description: "Advanced reasoning",
        releaseDate: "2025-12-20",
      },
      {
        id: "o3-mini",
        name: "o3-mini",
        provider: "OpenAI",
        inputPrice: 1.1,
        outputPrice: 4.4,
        contextWindow: 128000,
        supportsBatch: false,
        description: "Compact reasoning",
        releaseDate: "2025-12-20",
      },
      {
        id: "gemini-2-5-pro",
        name: "Gemini 2.5 Pro",
        provider: "Google",
        inputPrice: 1.25,
        outputPrice: 10.0,
        contextWindow: 1000000,
        supportsBatch: true,
        description: "Advanced multimodal",
        releaseDate: "2025-12-19",
      },
      {
        id: "gemini-2-5-flash",
        name: "Gemini 2.5 Flash",
        provider: "Google",
        inputPrice: 0.30,
        outputPrice: 2.5,
        contextWindow: 1000000,
        supportsBatch: true,
        description: "Fast multimodal",
        releaseDate: "2025-04-02",
      },
      {
        id: "deepseek-v3",
        name: "DeepSeek-V3",
        provider: "DeepSeek",
        inputPrice: 0.14,
        outputPrice: 0.28,
        contextWindow: 64000,
        supportsBatch: true,
        description: "High-quality reasoning",
        releaseDate: "2025-12-26",
      },
      {
        id: "deepseek-r1",
        name: "DeepSeek-R1",
        provider: "DeepSeek",
        inputPrice: 0.55,
        outputPrice: 2.19,
        contextWindow: 64000,
        supportsBatch: true,
        description: "Chain-of-thought reasoning",
        releaseDate: "2025-01-20",
      },
      {
        id: "mistral-large-2411",
        name: "Mistral Large",
        provider: "Mistral",
        inputPrice: 2.0,
        outputPrice: 6.0,
        contextWindow: 32000,
        supportsBatch: true,
        description: "Flagship Mistral",
        releaseDate: "2024-11-21",
      },
      {
        id: "mistral-medium",
        name: "Mistral Medium",
        provider: "Mistral",
        inputPrice: 0.4,
        outputPrice: 2.0,
        contextWindow: 32000,
        supportsBatch: false,
        description: "Balanced model",
        releaseDate: "2024-02-16",
      },
      {
        id: "command-r-plus",
        name: "Command R+",
        provider: "Cohere",
        inputPrice: 2.5,
        outputPrice: 10.0,
        contextWindow: 128000,
        supportsBatch: true,
        description: "Advanced reasoning",
        releaseDate: "2024-08-29",
      },
      {
        id: "command-r",
        name: "Command R",
        provider: "Cohere",
        inputPrice: 0.15,
        outputPrice: 0.6,
        contextWindow: 128000,
        supportsBatch: true,
        description: "Production-ready model",
        releaseDate: "2024-03-15",
      },
      {
        id: "llama-3-3-70b",
        name: "Llama-3.3-70B",
        provider: "Groq",
        inputPrice: 0.59,
        outputPrice: 0.79,
        contextWindow: 8000,
        supportsBatch: false,
        description: "Open source via Groq",
        releaseDate: "2025-01-24",
      },
    ],
  };
}

/**
 * Find a model by name or ID (supports partial matching)
 *
 * @param {string} query - Model name or ID to search for
 * @param {PricingDatabase} database - Pricing database
 * @returns {ModelPricing | undefined} Matched model or undefined
 */
export function findModel(
  query: string,
  database: PricingDatabase
): ModelPricing | undefined {
  const lowerQuery = query.toLowerCase().trim();

  // Exact ID match
  const exactMatch = database.models.find((m) => m.id.toLowerCase() === lowerQuery);
  if (exactMatch) return exactMatch;

  // Exact name match
  const nameMatch = database.models.find((m) => m.name.toLowerCase() === lowerQuery);
  if (nameMatch) return nameMatch;

  // Partial ID match (e.g., "claude-opus-4-5" matches "claude-opus-4-5-20251101")
  const partialIdMatch = database.models.find((m) =>
    m.id.toLowerCase().includes(lowerQuery)
  );
  if (partialIdMatch) return partialIdMatch;

  // Partial name match (case-insensitive)
  const partialMatch = database.models.find((m) =>
    m.name.toLowerCase().includes(lowerQuery)
  );
  if (partialMatch) return partialMatch;

  // Provider match (e.g., "claude" -> Anthropic models)
  const providerMatch = database.models.find((m) =>
    m.provider.toLowerCase().includes(lowerQuery)
  );
  if (providerMatch) return providerMatch;

  return undefined;
}

/**
 * Get all models from a provider
 *
 * @param {string} provider - Provider name
 * @param {PricingDatabase} database - Pricing database
 * @returns {ModelPricing[]} Array of models from that provider
 */
export function getModelsFromProvider(
  provider: string,
  database: PricingDatabase
): ModelPricing[] {
  return database.models.filter(
    (m) => m.provider.toLowerCase() === provider.toLowerCase()
  );
}

/**
 * Get all unique providers
 *
 * @param {PricingDatabase} database - Pricing database
 * @returns {string[]} Array of provider names
 */
export function getProviders(database: PricingDatabase): string[] {
  const providers = new Set(database.models.map((m) => m.provider));
  return Array.from(providers).sort();
}

/**
 * Sort models by total cost (input + output)
 *
 * @param {ModelPricing[]} models - Models to sort
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @returns {ModelPricing[]} Models sorted by total cost
 */
export function sortModelsByCost(
  models: ModelPricing[],
  inputTokens: number,
  outputTokens: number
): ModelPricing[] {
  return [...models].sort((a, b) => {
    const costA = (inputTokens * a.inputPrice + outputTokens * a.outputPrice) / 1000000;
    const costB = (inputTokens * b.inputPrice + outputTokens * b.outputPrice) / 1000000;
    return costA - costB;
  });
}

/**
 * Calculate cost for a model
 *
 * @param {ModelPricing} model - Model to calculate cost for
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @returns {object} Cost breakdown
 */
export function calculateCost(
  model: ModelPricing,
  inputTokens: number,
  outputTokens: number
): { input: number; output: number; total: number } {
  const input = (inputTokens * model.inputPrice) / 1000000;
  const output = (outputTokens * model.outputPrice) / 1000000;
  return {
    input,
    output,
    total: input + output,
  };
}

/**
 * Fetch latest pricing data from GitHub and write to data/pricing.json
 *
 * @param {boolean} useColor - Whether to use colored output
 */
export async function fetchLatestPricing(useColor: boolean): Promise<void> {
  const url =
    "https://raw.githubusercontent.com/followtayeeb/tokenprice/main/data/pricing.json";
  const dataPath = join(__dirname, "..", "data", "pricing.json");

  const green = useColor ? chalk.green : (s: string) => s;
  const yellow = useColor ? chalk.yellow : (s: string) => s;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(
        yellow("\u26a0") +
          ` Could not fetch latest pricing: HTTP ${response.status}. Using cached data.`
      );
      return;
    }

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.warn(
        yellow("\u26a0") +
          " Could not fetch latest pricing: invalid JSON response. Using cached data."
      );
      return;
    }

    const data = parsed as Record<string, unknown>;
    if (!Array.isArray(data.models)) {
      console.warn(
        yellow("\u26a0") +
          " Could not fetch latest pricing: missing models array. Using cached data."
      );
      return;
    }

    await writeFile(dataPath, JSON.stringify(data, null, 2), "utf-8");

    const modelCount = (data.models as unknown[]).length;
    const updated = typeof data.updated === "string" ? data.updated : "unknown";
    console.log(
      green("\u2713") +
        ` Pricing updated: ${modelCount} models loaded (as of ${updated})`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      yellow("\u26a0") +
        ` Could not fetch latest pricing: ${message}. Using cached data.`
    );
  }
}
