/**
 * CI/CD budget guard module
 * Fails if estimated cost exceeds a specified threshold
 */

import { readFile } from "fs/promises";
import chalk from "chalk";
import { loadPricingData, findModel, calculateCost } from "./pricing.js";
import { countTokens, estimateOutputTokens } from "./tokenizer.js";

/**
 * Options for the guard command
 */
export interface GuardOptions {
  promptPath?: string;
  prompt?: string;
  modelId: string;
  maxCost: number;
  outputFormat: "text" | "json";
  useColor: boolean;
}

/**
 * JSON output shape for the guard command
 */
interface GuardResult {
  status: "pass" | "fail";
  model: string;
  estimatedCost: number;
  maxCost: number;
  inputTokens: number;
  outputTokens: number;
  overBudgetBy?: number;
}

/**
 * Format a cost value for display
 */
function formatCost(value: number): string {
  if (value < 0.01) {
    return value.toFixed(4);
  }
  return value.toFixed(2);
}

/**
 * Run the CI/CD budget guard check
 *
 * @param {GuardOptions} options - Guard options
 */
export async function runGuard(options: GuardOptions): Promise<void> {
  // Resolve prompt text
  let promptText: string | undefined;

  if (options.promptPath) {
    try {
      promptText = await readFile(options.promptPath, "utf-8");
    } catch {
      const msg = `Could not read file: ${options.promptPath}`;
      if (options.outputFormat === "json") {
        console.log(JSON.stringify({ error: msg }));
      } else {
        console.error(options.useColor ? chalk.red(msg) : msg);
      }
      process.exit(1);
    }
  } else if (options.prompt) {
    promptText = options.prompt;
  }

  if (!promptText) {
    const msg = "No prompt provided. Pass a prompt string or use --file.";
    if (options.outputFormat === "json") {
      console.log(JSON.stringify({ error: msg }));
    } else {
      console.error(options.useColor ? chalk.red(msg) : msg);
    }
    process.exit(1);
  }

  // Find model
  const db = loadPricingData();
  const model = findModel(options.modelId, db);

  if (!model) {
    const msg = `Model not found: ${options.modelId}`;
    if (options.outputFormat === "json") {
      console.log(JSON.stringify({ error: msg }));
    } else {
      console.error(options.useColor ? chalk.red(msg) : msg);
    }
    process.exit(1);
  }

  // Count tokens and estimate cost
  const tokenResult = countTokens(promptText, model.id);
  const inputTokens = tokenResult.tokens;
  const outputTokens = estimateOutputTokens(inputTokens);
  const cost = calculateCost(model, inputTokens, outputTokens);

  const passed = cost.total <= options.maxCost;

  if (options.outputFormat === "json") {
    const result: GuardResult = {
      status: passed ? "pass" : "fail",
      model: model.name,
      estimatedCost: cost.total,
      maxCost: options.maxCost,
      inputTokens,
      outputTokens,
    };
    if (!passed) {
      result.overBudgetBy = cost.total - options.maxCost;
    }
    console.log(JSON.stringify(result, null, 2));
    process.exit(passed ? 0 : 1);
  }

  // Text output
  const costStr = `$${formatCost(cost.total)}`;
  const limitStr = `$${formatCost(options.maxCost)}`;

  if (passed) {
    const msg = `✓ PASS  ${model.name}  ${costStr} / ${limitStr} limit`;
    console.log(options.useColor ? chalk.green(msg) : msg);
    process.exit(0);
  } else {
    const overBy = cost.total - options.maxCost;
    const overStr = `$${formatCost(overBy)}`;
    const msg = `✗ FAIL  ${model.name}  ${costStr} / ${limitStr} limit  (+${overStr} over budget)`;
    console.log(options.useColor ? chalk.red(msg) : msg);
    process.exit(1);
  }
}
