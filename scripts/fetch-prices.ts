#!/usr/bin/env node
/**
 * Fetch live pricing from provider sources, diff against data/pricing.json,
 * and optionally write the updated file.
 *
 * Usage:
 *   npx tsx scripts/fetch-prices.ts          # dry-run, prints diff to stdout
 *   npx tsx scripts/fetch-prices.ts --write  # writes updated data/pricing.json
 */

import { readFile, writeFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Types -----------------------------------------------------------------

interface ModelPricing {
  id: string;
  name: string;
  provider: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
  supportsBatch: boolean;
  description: string;
  releaseDate: string;
}

interface PricingDatabase {
  version: string;
  updated: string;
  models: ModelPricing[];
  sources?: Record<string, string>;
  notes?: string;
  lastUpdatedBy?: string;
}

interface LiteLLMEntry {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  max_tokens?: number;
  max_input_tokens?: number;
  supports_parallel_function_calling?: boolean;
  litellm_provider?: string;
}

type LiteLLMPrices = Record<string, LiteLLMEntry>;

interface FetchedPrice {
  modelId: string;
  inputPrice: number;
  outputPrice: number;
  source: string;
}

interface PriceDiff {
  modelId: string;
  modelName: string;
  provider: string;
  oldInputPrice: number;
  newInputPrice: number;
  oldOutputPrice: number;
  newOutputPrice: number;
  inputPctChange: number;
  outputPctChange: number;
}

interface FetchResult {
  prices: FetchedPrice[];
  error?: string;
}

// --- LiteLLM aggregate source ----------------------------------------------

const LITELLM_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

/**
 * Map our internal model IDs to their LiteLLM counterparts.
 * LiteLLM prices are per-token; we multiply by 1M to get per-million.
 */
const LITELLM_ID_MAP: Record<string, string> = {
  "claude-opus-4-5-20251101": "claude-opus-4-5-20251101",
  "claude-sonnet-4-5-20250514": "claude-sonnet-4-5-20250514",
  "claude-haiku-4-5-20250514": "claude-haiku-4-5-20250514",
  "gpt-4-turbo": "gpt-4-turbo",
  "gpt-4o": "gpt-4o",
  "gpt-4o-mini": "gpt-4o-mini",
  "o3": "o3",
  "o3-mini": "o3-mini",
  "gemini-2-5-pro": "gemini/gemini-2.5-pro-preview-03-25",
  "gemini-2-5-flash": "gemini/gemini-2.5-flash-preview-04-17",
  "deepseek-v3": "deepseek/deepseek-chat",
  "deepseek-r1": "deepseek/deepseek-reasoner",
  "mistral-large-2411": "mistral/mistral-large-latest",
  "mistral-medium": "mistral/mistral-medium",
  "command-r-plus": "cohere/command-r-plus",
  "command-r": "cohere/command-r",
  "llama-3-3-70b": "groq/llama-3.3-70b-versatile",
};

async function fetchLiteLLMPrices(): Promise<LiteLLMPrices> {
  const res = await fetch(LITELLM_URL);
  if (!res.ok) throw new Error(`LiteLLM fetch failed: HTTP ${res.status}`);
  return res.json() as Promise<LiteLLMPrices>;
}

// --- Per-provider fetchers --------------------------------------------------

async function fetchAnthropicPrices(litellm: LiteLLMPrices): Promise<FetchResult> {
  const prices: FetchedPrice[] = [];
  const anthropicIds = Object.entries(LITELLM_ID_MAP).filter(([id]) =>
    id.startsWith("claude-")
  );
  for (const [modelId, litellmKey] of anthropicIds) {
    const entry = litellm[litellmKey];
    if (entry?.input_cost_per_token && entry?.output_cost_per_token) {
      prices.push({
        modelId,
        inputPrice: roundPrice(entry.input_cost_per_token * 1_000_000),
        outputPrice: roundPrice(entry.output_cost_per_token * 1_000_000),
        source: LITELLM_URL,
      });
    }
  }
  return { prices };
}

async function fetchOpenAIPrices(litellm: LiteLLMPrices): Promise<FetchResult> {
  const prices: FetchedPrice[] = [];
  const openaiIds = Object.entries(LITELLM_ID_MAP).filter(([id]) =>
    id.startsWith("gpt-") || id === "o3" || id === "o3-mini"
  );
  for (const [modelId, litellmKey] of openaiIds) {
    const entry = litellm[litellmKey];
    if (entry?.input_cost_per_token && entry?.output_cost_per_token) {
      prices.push({
        modelId,
        inputPrice: roundPrice(entry.input_cost_per_token * 1_000_000),
        outputPrice: roundPrice(entry.output_cost_per_token * 1_000_000),
        source: LITELLM_URL,
      });
    }
  }
  return { prices };
}

async function fetchGooglePrices(litellm: LiteLLMPrices): Promise<FetchResult> {
  const prices: FetchedPrice[] = [];
  const googleIds = Object.entries(LITELLM_ID_MAP).filter(([id]) =>
    id.startsWith("gemini-")
  );
  for (const [modelId, litellmKey] of googleIds) {
    const entry = litellm[litellmKey];
    if (entry?.input_cost_per_token && entry?.output_cost_per_token) {
      prices.push({
        modelId,
        inputPrice: roundPrice(entry.input_cost_per_token * 1_000_000),
        outputPrice: roundPrice(entry.output_cost_per_token * 1_000_000),
        source: LITELLM_URL,
      });
    }
  }
  return { prices };
}

async function fetchDeepSeekPrices(litellm: LiteLLMPrices): Promise<FetchResult> {
  const prices: FetchedPrice[] = [];
  const deepseekIds = Object.entries(LITELLM_ID_MAP).filter(([id]) =>
    id.startsWith("deepseek-")
  );
  for (const [modelId, litellmKey] of deepseekIds) {
    const entry = litellm[litellmKey];
    if (entry?.input_cost_per_token && entry?.output_cost_per_token) {
      prices.push({
        modelId,
        inputPrice: roundPrice(entry.input_cost_per_token * 1_000_000),
        outputPrice: roundPrice(entry.output_cost_per_token * 1_000_000),
        source: LITELLM_URL,
      });
    }
  }
  return { prices };
}

// --- Helpers ----------------------------------------------------------------

function roundPrice(value: number): number {
  // Keep up to 4 significant decimal places; avoid float noise
  return parseFloat(value.toPrecision(4));
}

function pctChange(oldVal: number, newVal: number): number {
  if (oldVal === 0) return 0;
  return ((newVal - oldVal) / oldVal) * 100;
}

function formatPct(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

// --- Main -------------------------------------------------------------------

async function main(): Promise<void> {
  const shouldWrite = process.argv.includes("--write");

  const pricingPath = join(__dirname, "..", "data", "pricing.json");
  const rawCurrent = await readFile(pricingPath, "utf-8");
  const currentData = JSON.parse(rawCurrent) as PricingDatabase;

  console.log("Fetching live pricing data from provider sources...\n");

  let litellm: LiteLLMPrices;
  try {
    litellm = await fetchLiteLLMPrices();
    console.log(`Loaded LiteLLM aggregate (${Object.keys(litellm).length} entries)\n`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to fetch LiteLLM pricing: ${msg}`);
    process.exit(1);
  }

  // Run all per-provider fetchers concurrently
  const [anthropic, openai, google, deepseek] = await Promise.all([
    fetchAnthropicPrices(litellm),
    fetchOpenAIPrices(litellm),
    fetchGooglePrices(litellm),
    fetchDeepSeekPrices(litellm),
  ]);

  const allFetched = new Map<string, FetchedPrice>();
  for (const result of [anthropic, openai, google, deepseek]) {
    if (result.error) console.warn(`Warning: ${result.error}`);
    for (const p of result.prices) {
      allFetched.set(p.modelId, p);
    }
  }

  console.log(`Fetched prices for ${allFetched.size} models\n`);

  // Build diff
  const diffs: PriceDiff[] = [];
  let changedCount = 0;
  let unchangedCount = 0;
  let notFoundCount = 0;

  for (const model of currentData.models) {
    const fetched = allFetched.get(model.id);
    if (!fetched) {
      notFoundCount++;
      continue;
    }

    const inputChanged = fetched.inputPrice !== model.inputPrice;
    const outputChanged = fetched.outputPrice !== model.outputPrice;

    if (inputChanged || outputChanged) {
      changedCount++;
      diffs.push({
        modelId: model.id,
        modelName: model.name,
        provider: model.provider,
        oldInputPrice: model.inputPrice,
        newInputPrice: inputChanged ? fetched.inputPrice : model.inputPrice,
        oldOutputPrice: model.outputPrice,
        newOutputPrice: outputChanged ? fetched.outputPrice : model.outputPrice,
        inputPctChange: pctChange(model.inputPrice, fetched.inputPrice),
        outputPctChange: pctChange(model.outputPrice, fetched.outputPrice),
      });
    } else {
      unchangedCount++;
    }
  }

  // Print diff table to stdout
  if (diffs.length === 0) {
    console.log("No price changes detected. All prices are up to date.");
  } else {
    console.log(`Price changes detected (${changedCount} models):\n`);

    const colWidths = [28, 12, 14, 14, 10, 14, 14, 10];
    const header = [
      "Model".padEnd(colWidths[0]),
      "Provider".padEnd(colWidths[1]),
      "Old Input".padEnd(colWidths[2]),
      "New Input".padEnd(colWidths[3]),
      "Chg%".padEnd(colWidths[4]),
      "Old Output".padEnd(colWidths[5]),
      "New Output".padEnd(colWidths[6]),
      "Chg%".padEnd(colWidths[7]),
    ].join(" | ");

    const separator = colWidths.map((w) => "-".repeat(w)).join("-+-");
    console.log(header);
    console.log(separator);

    for (const d of diffs) {
      const row = [
        d.modelName.padEnd(colWidths[0]),
        d.provider.padEnd(colWidths[1]),
        `$${d.oldInputPrice}/M`.padEnd(colWidths[2]),
        `$${d.newInputPrice}/M`.padEnd(colWidths[3]),
        formatPct(d.inputPctChange).padEnd(colWidths[4]),
        `$${d.oldOutputPrice}/M`.padEnd(colWidths[5]),
        `$${d.newOutputPrice}/M`.padEnd(colWidths[6]),
        formatPct(d.outputPctChange).padEnd(colWidths[7]),
      ].join(" | ");
      console.log(row);
    }
  }

  console.log(`\nSummary: ${changedCount} changed, ${unchangedCount} unchanged, ${notFoundCount} not in live source`);

  if (!shouldWrite) {
    console.log("\nDry run — pass --write to update data/pricing.json");
    return;
  }

  if (diffs.length === 0) {
    console.log("\nNothing to write.");
    return;
  }

  // Apply updates
  const fetchedMap = allFetched;
  const updatedModels = currentData.models.map((model) => {
    const fetched = fetchedMap.get(model.id);
    if (!fetched) return model;
    return {
      ...model,
      inputPrice: fetched.inputPrice,
      outputPrice: fetched.outputPrice,
    };
  });

  const updatedData: PricingDatabase = {
    ...currentData,
    updated: new Date().toISOString(),
    lastUpdatedBy: "GitHub Actions",
    models: updatedModels,
  };

  await writeFile(pricingPath, JSON.stringify(updatedData, null, 2) + "\n", "utf-8");
  console.log(`\nWrote updated pricing to data/pricing.json`);

  // Emit a structured diff for PR body generation (JSON to stdout file)
  const diffJsonPath = join(__dirname, "..", ".github", "pricing-diff.json");
  await writeFile(diffJsonPath, JSON.stringify(diffs, null, 2), "utf-8");
  console.log(`Wrote diff JSON to .github/pricing-diff.json (used by workflow)`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${msg}`);
  process.exit(1);
});
