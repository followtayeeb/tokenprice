/**
 * Provider cost breakdown module
 * Groups models by provider and shows per-provider cost analysis
 */

import chalk from "chalk";
import {
  loadPricingData,
  calculateCost,
  getProviders,
  getModelsFromProvider,
  sortModelsByCost,
  type ModelPricing,
} from "./pricing.js";
import { countTokensImproved, estimateOutputTokens } from "./tokenizer.js";

/**
 * Options for the breakdown command
 */
export interface BreakdownOptions {
  prompt?: string;
  inputTokens?: number;
  outputTokens?: number;
  outputFormat: "text" | "json" | "csv";
  useColor: boolean;
}

interface ModelCostEntry {
  name: string;
  totalCost: number;
  inputCost: number;
  outputCost: number;
}

interface ProviderEntry {
  provider: string;
  cheapestModel: string;
  cheapestCost: number;
  models: ModelCostEntry[];
}

interface BreakdownResult {
  inputTokens: number;
  outputTokens: number;
  providers: ProviderEntry[];
  overallCheapest: {
    model: string;
    provider: string;
    totalCost: number;
  };
}

/**
 * Format a dollar value with appropriate precision
 */
function formatDollar(value: number): string {
  if (value < 0.01) {
    return value.toFixed(4);
  }
  return value.toFixed(2);
}

/**
 * Build the breakdown result from pricing data
 */
function buildBreakdown(inputTokens: number, outputTokens: number): BreakdownResult {
  const db = loadPricingData();
  const providerNames = getProviders(db);

  let overallCheapestModel = "";
  let overallCheapestProvider = "";
  let overallCheapestCost = Infinity;

  const providers: ProviderEntry[] = providerNames.map((providerName) => {
    const models = getModelsFromProvider(providerName, db);
    const sorted = sortModelsByCost(models, inputTokens, outputTokens);

    const modelEntries: ModelCostEntry[] = sorted.map((m: ModelPricing) => {
      const cost = calculateCost(m, inputTokens, outputTokens);
      return {
        name: m.name,
        totalCost: cost.total,
        inputCost: cost.input,
        outputCost: cost.output,
      };
    });

    const cheapest = modelEntries[0];

    if (cheapest.totalCost < overallCheapestCost) {
      overallCheapestCost = cheapest.totalCost;
      overallCheapestModel = cheapest.name;
      overallCheapestProvider = providerName;
    }

    return {
      provider: providerName,
      cheapestModel: cheapest.name,
      cheapestCost: cheapest.totalCost,
      models: modelEntries,
    };
  });

  return {
    inputTokens,
    outputTokens,
    providers,
    overallCheapest: {
      model: overallCheapestModel,
      provider: overallCheapestProvider,
      totalCost: overallCheapestCost,
    },
  };
}

/**
 * Render breakdown as styled text
 */
function renderText(result: BreakdownResult, useColor: boolean): string {
  const lines: string[] = [];
  const header = `Provider Breakdown  (${result.inputTokens.toLocaleString()} input + ${result.outputTokens.toLocaleString()} output tokens)`;
  const separator = "\u2550".repeat(54);

  lines.push("");
  lines.push(useColor ? chalk.bold.cyan(header) : header);
  lines.push(useColor ? chalk.cyan(separator) : separator);
  lines.push("");

  for (const provider of result.providers) {
    const providerLabel = useColor ? chalk.bold.white(provider.provider) : provider.provider;
    const cheapestNote = `Cheapest: ${provider.cheapestModel} ($${formatDollar(provider.cheapestCost)})`;
    const formattedNote = useColor ? chalk.gray(cheapestNote) : cheapestNote;
    lines.push(`${providerLabel}  ${formattedNote}`);

    for (const model of provider.models) {
      const isCheapest = model.name === provider.cheapestModel;
      const costStr = `$${formatDollar(model.totalCost)}`;
      const paddedName = model.name.padEnd(22);

      if (isCheapest && useColor) {
        lines.push(`  ${chalk.green(paddedName)} ${chalk.green.bold(costStr)}`);
      } else {
        lines.push(`  ${paddedName} ${costStr}`);
      }
    }

    lines.push("");
  }

  lines.push(useColor ? chalk.cyan(separator) : separator);

  const overallLine = `Overall cheapest: ${result.overallCheapest.model} (${result.overallCheapest.provider})  $${formatDollar(result.overallCheapest.totalCost)}`;
  lines.push(useColor ? chalk.green.bold(overallLine) : overallLine);
  lines.push("");

  return lines.join("\n");
}

/**
 * Render breakdown as CSV
 */
function renderCSV(result: BreakdownResult): string {
  const rows: string[] = ["provider,model,inputCost,outputCost,totalCost"];

  for (const provider of result.providers) {
    for (const model of provider.models) {
      rows.push(
        `"${provider.provider}","${model.name}",${model.inputCost.toFixed(8)},${model.outputCost.toFixed(8)},${model.totalCost.toFixed(8)}`
      );
    }
  }

  return rows.join("\n");
}

/**
 * Show cost breakdown grouped by provider
 *
 * @param {BreakdownOptions} options - Breakdown options
 */
export function runBreakdown(options: BreakdownOptions): void {
  let inputTokens = options.inputTokens ?? 1000;
  let outputTokens = options.outputTokens ?? 500;

  if (options.prompt) {
    const counted = countTokensImproved(options.prompt);
    inputTokens = counted.tokens;
    outputTokens = options.outputTokens ?? estimateOutputTokens(inputTokens);
  }

  const result = buildBreakdown(inputTokens, outputTokens);

  switch (options.outputFormat) {
    case "json":
      console.log(JSON.stringify(result, null, 2));
      break;
    case "csv":
      console.log(renderCSV(result));
      break;
    default:
      console.log(renderText(result, options.useColor));
      break;
  }
}
