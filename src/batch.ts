/**
 * Batch processing module
 * Processes multiple prompts from JSONL or CSV files
 */

import { createReadStream } from "fs";
import { access } from "fs/promises";
import { createInterface } from "readline";
import chalk from "chalk";
import Table from "cli-table3";
import {
  loadPricingData,
  findModel,
  calculateCost,
  sortModelsByCost,
  type ModelPricing,
  type PricingDatabase,
} from "./pricing.js";
import { countTokensImproved, estimateOutputTokens } from "./tokenizer.js";

/**
 * Options for batch processing
 */
export interface BatchOptions {
  filePath: string;
  modelId?: string;
  compare?: boolean;
  outputFormat: "text" | "json" | "csv";
  useColor: boolean;
}

/**
 * A single prompt entry parsed from the input file
 */
interface PromptEntry {
  id: string;
  prompt: string;
}

/**
 * Cost result for a single model on a single prompt
 */
interface ModelCostResult {
  model: string;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

/**
 * Result for a single prompt
 */
interface PromptResult {
  id: string;
  prompt: string;
  inputTokens: number;
  outputTokens: number;
  costs: ModelCostResult[];
}

/**
 * Aggregate statistics across all prompts
 */
interface AggregateStats {
  totalPrompts: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  costsByModel: Map<string, number>;
}

/**
 * Detect file format from extension
 *
 * @param {string} filePath - Path to the file
 * @returns {"jsonl" | "csv"} Detected format
 */
function detectFormat(filePath: string): "jsonl" | "csv" {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  return "jsonl";
}

/**
 * Parse a JSONL line into a PromptEntry
 *
 * @param {string} line - Raw line from the file
 * @param {number} lineNumber - Line number for error reporting
 * @returns {PromptEntry | null} Parsed entry or null if malformed
 */
function parseJsonlLine(line: string, lineNumber: number): PromptEntry | null {
  const trimmed = line.trim();
  if (trimmed === "") return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null) {
      process.stderr.write(`Warning: Line ${lineNumber}: expected JSON object, skipping\n`);
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    if (typeof obj["prompt"] !== "string" || obj["prompt"].trim() === "") {
      process.stderr.write(`Warning: Line ${lineNumber}: missing or empty "prompt" field, skipping\n`);
      return null;
    }
    const id = typeof obj["id"] === "string" ? obj["id"] : `prompt-${lineNumber}`;
    return { id, prompt: obj["prompt"] };
  } catch {
    process.stderr.write(`Warning: Line ${lineNumber}: invalid JSON, skipping\n`);
    return null;
  }
}

/**
 * Parse a CSV line into a PromptEntry.
 * First column is prompt, optional second column is id.
 * Handles quoted fields with commas.
 *
 * @param {string} line - Raw CSV line
 * @param {number} lineNumber - Line number for error reporting
 * @param {boolean} isHeader - Whether this might be a header row
 * @returns {PromptEntry | null} Parsed entry or null if malformed/header
 */
function parseCsvLine(line: string, lineNumber: number, isHeader: boolean): PromptEntry | null {
  const trimmed = line.trim();
  if (trimmed === "") return null;

  // Skip header row if it looks like one
  if (isHeader) {
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("prompt") || lower.startsWith('"prompt')) {
      return null;
    }
  }

  const fields = parseCsvFields(trimmed);
  if (fields.length === 0 || fields[0].trim() === "") {
    process.stderr.write(`Warning: Line ${lineNumber}: empty prompt field, skipping\n`);
    return null;
  }

  const prompt = fields[0];
  const id = fields.length > 1 && fields[1].trim() !== "" ? fields[1] : `prompt-${lineNumber}`;
  return { id, prompt };
}

/**
 * Simple CSV field parser that handles quoted fields
 *
 * @param {string} line - CSV line to parse
 * @returns {string[]} Parsed fields
 */
function parseCsvFields(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Process a single prompt and compute costs for the given models
 *
 * @param {PromptEntry} entry - The prompt entry
 * @param {ModelPricing[]} models - Models to compute costs for
 * @returns {PromptResult} Cost results for the prompt
 */
function processPrompt(entry: PromptEntry, models: ModelPricing[]): PromptResult {
  const tokenResult = countTokensImproved(entry.prompt);
  const inputTokens = tokenResult.tokens;
  const outputTokens = estimateOutputTokens(inputTokens);

  const costs: ModelCostResult[] = models.map((model) => {
    const cost = calculateCost(model, inputTokens, outputTokens);
    return {
      model: model.name,
      inputCost: cost.input,
      outputCost: cost.output,
      totalCost: cost.total,
    };
  });

  return {
    id: entry.id,
    prompt: entry.prompt,
    inputTokens,
    outputTokens,
    costs,
  };
}

/**
 * Print a prompt result as text
 *
 * @param {PromptResult} result - The result to print
 * @param {boolean} useColor - Whether to use terminal colors
 */
function printTextResult(result: PromptResult, useColor: boolean): void {
  const truncated = result.prompt.length > 80 ? result.prompt.slice(0, 77) + "..." : result.prompt;
  const header = `[${result.id}] ${truncated}`;
  console.log(useColor ? chalk.bold.cyan(header) : header);
  console.log(`  Input tokens: ${result.inputTokens} | Output estimate: ~${result.outputTokens}`);

  const table = new Table({
    head: [
      useColor ? chalk.bold("Model") : "Model",
      useColor ? chalk.bold("Input") : "Input",
      useColor ? chalk.bold("Output") : "Output",
      useColor ? chalk.bold("Total") : "Total",
    ],
    colWidths: [28, 14, 14, 14],
    style: { head: [], border: useColor ? ["cyan"] : ["grey"] },
  });

  // Find cheapest
  let cheapestIdx = 0;
  let cheapestTotal = Infinity;
  result.costs.forEach((c, idx) => {
    if (c.totalCost < cheapestTotal) {
      cheapestTotal = c.totalCost;
      cheapestIdx = idx;
    }
  });

  result.costs.forEach((c, idx) => {
    const isCheapest = idx === cheapestIdx;
    const fmt = (v: number): string => {
      if (v < 0.0001) return v.toExponential(1);
      return v.toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
    };

    const row = [
      isCheapest && useColor ? chalk.green.bold(c.model) : c.model,
      useColor ? chalk.yellow(`$${fmt(c.inputCost)}`) : `$${fmt(c.inputCost)}`,
      useColor ? chalk.yellow(`$${fmt(c.outputCost)}`) : `$${fmt(c.outputCost)}`,
      isCheapest && useColor ? chalk.green.bold(`$${fmt(c.totalCost)}`) : `$${fmt(c.totalCost)}`,
    ];
    table.push(row);
  });

  console.log(table.toString());
  console.log("");
}

/**
 * Print a prompt result as JSON (one JSON object per line, streamed)
 *
 * @param {PromptResult} result - The result to print
 */
function printJsonResult(result: PromptResult): void {
  const output = {
    id: result.id,
    prompt: result.prompt.length > 80 ? result.prompt.slice(0, 80) : result.prompt,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costs: result.costs.map((c) => ({ model: c.model, totalCost: c.totalCost })),
  };
  console.log(JSON.stringify(output));
}

/**
 * Print a prompt result as CSV rows
 *
 * @param {PromptResult} result - The result to print
 */
function printCsvResult(result: PromptResult): void {
  for (const c of result.costs) {
    const escapedPrompt = result.prompt.replace(/"/g, '""');
    const truncated = escapedPrompt.length > 80 ? escapedPrompt.slice(0, 80) : escapedPrompt;
    console.log(
      `"${result.id}","${truncated}","${c.model}",${c.inputCost.toFixed(8)},${c.outputCost.toFixed(8)},${c.totalCost.toFixed(8)}`
    );
  }
}

/**
 * Print aggregate summary in text format
 *
 * @param {AggregateStats} stats - Aggregate statistics
 * @param {boolean} useColor - Whether to use terminal colors
 */
function printTextSummary(stats: AggregateStats, useColor: boolean): void {
  const divider = "=".repeat(60);
  console.log(useColor ? chalk.cyan(divider) : divider);
  console.log(useColor ? chalk.bold.cyan("Batch Summary") : "Batch Summary");
  console.log(useColor ? chalk.cyan(divider) : divider);
  console.log(`  Total prompts: ${stats.totalPrompts}`);
  console.log(`  Total input tokens: ${stats.totalInputTokens}`);
  console.log(`  Total output tokens (est.): ${stats.totalOutputTokens}`);
  console.log("");

  const fmt = (v: number): string => {
    if (v < 0.0001) return v.toExponential(1);
    return v.toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
  };

  const table = new Table({
    head: [
      useColor ? chalk.bold("Model") : "Model",
      useColor ? chalk.bold("Total Cost") : "Total Cost",
      useColor ? chalk.bold("Avg Cost") : "Avg Cost",
    ],
    colWidths: [28, 16, 16],
    style: { head: [], border: useColor ? ["cyan"] : ["grey"] },
  });

  // Sort models by total cost ascending
  const sorted = Array.from(stats.costsByModel.entries()).sort((a, b) => a[1] - b[1]);

  sorted.forEach(([model, total], idx) => {
    const avg = stats.totalPrompts > 0 ? total / stats.totalPrompts : 0;
    const isCheapest = idx === 0;
    table.push([
      isCheapest && useColor ? chalk.green.bold(model) : model,
      isCheapest && useColor ? chalk.green.bold(`$${fmt(total)}`) : `$${fmt(total)}`,
      isCheapest && useColor ? chalk.green.bold(`$${fmt(avg)}`) : `$${fmt(avg)}`,
    ]);
  });

  console.log(table.toString());
  console.log("");
}

/**
 * Run batch processing on a JSONL or CSV file
 *
 * @param {BatchOptions} options - Batch processing options
 */
export async function runBatch(options: BatchOptions): Promise<void> {
  // Verify file exists
  try {
    await access(options.filePath);
  } catch {
    const msg = `File not found: ${options.filePath}`;
    console.error(options.useColor ? chalk.red.bold(`Error: ${msg}`) : `Error: ${msg}`);
    process.exitCode = 1;
    return;
  }

  const db: PricingDatabase = loadPricingData();

  // Determine which models to use
  let models: ModelPricing[];
  if (options.modelId && !options.compare) {
    const model = findModel(options.modelId, db);
    if (!model) {
      const msg = `Model not found: ${options.modelId}`;
      console.error(options.useColor ? chalk.red.bold(`Error: ${msg}`) : `Error: ${msg}`);
      process.exitCode = 1;
      return;
    }
    models = [model];
  } else {
    models = db.models;
  }

  const format = detectFormat(options.filePath);
  const stats: AggregateStats = {
    totalPrompts: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    costsByModel: new Map(),
  };

  // Print CSV header if CSV output
  if (options.outputFormat === "csv") {
    console.log("id,prompt,model,inputCost,outputCost,totalCost");
  }

  // Stream line by line
  const fileStream = createReadStream(options.filePath, { encoding: "utf-8" });
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineNumber = 0;
  let isFirstLine = true;

  for await (const line of rl) {
    lineNumber++;

    let entry: PromptEntry | null;
    if (format === "jsonl") {
      entry = parseJsonlLine(line, lineNumber);
    } else {
      entry = parseCsvLine(line, lineNumber, isFirstLine);
    }
    isFirstLine = false;

    if (entry === null) continue;

    // Sort models by cost for this prompt if comparing
    const tokenResult = countTokensImproved(entry.prompt);
    const inputTokens = tokenResult.tokens;
    const outputTokens = estimateOutputTokens(inputTokens);

    let sortedModels: ModelPricing[];
    if (options.compare || models.length > 1) {
      sortedModels = sortModelsByCost(models, inputTokens, outputTokens);
    } else {
      sortedModels = models;
    }

    const result = processPrompt(entry, sortedModels);
    stats.totalPrompts++;
    stats.totalInputTokens += result.inputTokens;
    stats.totalOutputTokens += result.outputTokens;

    for (const c of result.costs) {
      const prev = stats.costsByModel.get(c.model) ?? 0;
      stats.costsByModel.set(c.model, prev + c.totalCost);
    }

    // Stream output
    switch (options.outputFormat) {
      case "text":
        printTextResult(result, options.useColor);
        break;
      case "json":
        printJsonResult(result);
        break;
      case "csv":
        printCsvResult(result);
        break;
    }
  }

  if (stats.totalPrompts === 0) {
    const msg = "No valid prompts found in file";
    console.error(options.useColor ? chalk.yellow.bold(`Warning: ${msg}`) : `Warning: ${msg}`);
    return;
  }

  // Print aggregate summary for text output
  if (options.outputFormat === "text") {
    printTextSummary(stats, options.useColor);
  }
}
