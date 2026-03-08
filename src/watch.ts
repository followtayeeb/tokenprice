/**
 * Log file watcher module
 * Watches API usage log files and tracks real-time LLM costs
 */

import { existsSync, statSync, watchFile, unwatchFile } from "fs";
import { createInterface } from "readline";
import { createReadStream } from "fs";
import chalk from "chalk";
import { loadPricingData, findModel, calculateCost } from "./pricing.js";
import type { PricingDatabase } from "./pricing.js";

/**
 * Options for the watch command
 */
export interface WatchOptions {
  logPath: string;
  useColor: boolean;
}

/**
 * A parsed log entry from a usage log line
 */
export interface ParsedLogEntry {
  timestamp?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Accumulated stats for a single model
 */
interface ModelStats {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
}

/**
 * Parse a single log line into a structured entry.
 * Supports key=value format and JSON formats.
 *
 * @param {string} line - Raw log line
 * @returns {ParsedLogEntry | null} Parsed entry or null if line doesn't match
 */
export function parseLogLine(line: string): ParsedLogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Try JSON format first
  if (trimmed.startsWith("{")) {
    return parseJsonLine(trimmed);
  }

  // Try key=value format
  return parseKeyValueLine(trimmed);
}

/**
 * Parse a JSON-formatted log line
 */
function parseJsonLine(line: string): ParsedLogEntry | null {
  try {
    const obj = JSON.parse(line) as Record<string, unknown>;

    const model = typeof obj.model === "string" ? obj.model : undefined;
    if (!model) return null;

    const timestamp = typeof obj.timestamp === "string" ? obj.timestamp : undefined;

    // Format: {"model":"...","usage":{"input_tokens":...,"output_tokens":...}}
    if (obj.usage && typeof obj.usage === "object" && obj.usage !== null) {
      const usage = obj.usage as Record<string, unknown>;
      const inputTokens = typeof usage.input_tokens === "number" ? usage.input_tokens : undefined;
      const outputTokens = typeof usage.output_tokens === "number" ? usage.output_tokens : undefined;
      if (inputTokens !== undefined && outputTokens !== undefined) {
        return { timestamp, model, inputTokens, outputTokens };
      }
    }

    // Format: {"model":"...","input_tokens":...,"output_tokens":...}
    const inputTokens = typeof obj.input_tokens === "number" ? obj.input_tokens : undefined;
    const outputTokens = typeof obj.output_tokens === "number" ? obj.output_tokens : undefined;
    if (inputTokens !== undefined && outputTokens !== undefined) {
      return { timestamp, model, inputTokens, outputTokens };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a key=value formatted log line
 * Example: 2024-01-15T10:23:45Z model=gpt-4o input_tokens=1250 output_tokens=380
 */
function parseKeyValueLine(line: string): ParsedLogEntry | null {
  const modelMatch = /\bmodel=(\S+)/.exec(line);
  const inputMatch = /\binput_tokens=(\d+)/.exec(line);
  const outputMatch = /\boutput_tokens=(\d+)/.exec(line);

  if (!modelMatch || !inputMatch || !outputMatch) return null;

  const model = modelMatch[1];
  const inputTokens = parseInt(inputMatch[1], 10);
  const outputTokens = parseInt(outputMatch[1], 10);

  // Try to extract an ISO timestamp at the start
  const timestampMatch = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)/.exec(line);
  const timestamp = timestampMatch ? timestampMatch[1] : undefined;

  return { timestamp, model, inputTokens, outputTokens };
}

/**
 * Format a number with comma separators
 */
function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Format a dollar cost value
 */
function formatCost(value: number): string {
  if (value < 0.001) {
    return `$${value.toFixed(6)}`;
  }
  return `$${value.toFixed(3)}`;
}

/**
 * Print the summary table of accumulated stats
 */
function printSummary(
  statsMap: Map<string, ModelStats>,
  useColor: boolean
): void {
  const separator = "\u2500".repeat(72);

  console.log(useColor ? chalk.cyan(separator) : separator);

  const header = `${"Model".padEnd(22)}${"Calls".padStart(8)}${"Input Tokens".padStart(16)}${"Output Tokens".padStart(17)}${"Total Cost".padStart(14)}`;
  console.log(useColor ? chalk.bold.cyan(header) : header);

  let totalCalls = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalCost = 0;

  for (const [modelName, stats] of statsMap) {
    totalCalls += stats.calls;
    totalInput += stats.inputTokens;
    totalOutput += stats.outputTokens;
    totalCost += stats.totalCost;

    const row = `${modelName.padEnd(22)}${formatNumber(stats.calls).padStart(8)}${formatNumber(stats.inputTokens).padStart(16)}${formatNumber(stats.outputTokens).padStart(17)}${formatCost(stats.totalCost).padStart(14)}`;
    console.log(useColor ? chalk.white(row) : row);
  }

  console.log(useColor ? chalk.cyan(separator) : separator);

  const totalRow = `${"TOTAL".padEnd(22)}${formatNumber(totalCalls).padStart(8)}${formatNumber(totalInput).padStart(16)}${formatNumber(totalOutput).padStart(17)}${formatCost(totalCost).padStart(14)}`;
  console.log(useColor ? chalk.bold.green(totalRow) : totalRow);
}

/**
 * Process a parsed log entry: compute cost and update stats
 */
function processEntry(
  entry: ParsedLogEntry,
  database: PricingDatabase,
  statsMap: Map<string, ModelStats>,
  useColor: boolean,
  printLine: boolean
): void {
  const model = findModel(entry.model, database);
  const displayName = model ? model.name : entry.model;

  let cost = 0;
  if (model) {
    const costBreakdown = calculateCost(model, entry.inputTokens, entry.outputTokens);
    cost = costBreakdown.total;
  }

  // Update stats
  const existing = statsMap.get(displayName);
  if (existing) {
    existing.calls += 1;
    existing.inputTokens += entry.inputTokens;
    existing.outputTokens += entry.outputTokens;
    existing.totalCost += cost;
  } else {
    statsMap.set(displayName, {
      calls: 1,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      totalCost: cost,
    });
  }

  if (printLine) {
    const ts = entry.timestamp ? `[${entry.timestamp}] ` : "";
    const line = `${ts}${displayName} | in: ${formatNumber(entry.inputTokens)} | out: ${formatNumber(entry.outputTokens)} | cost: ${formatCost(cost)}`;
    console.log(useColor ? chalk.white(line) : line);
  }
}

/**
 * Watch an API usage log file and track real-time costs
 *
 * @param {WatchOptions} options - Watch configuration
 */
export async function runWatch(options: WatchOptions): Promise<void> {
  const { logPath, useColor } = options;

  if (!existsSync(logPath)) {
    const msg = `File not found: ${logPath}`;
    console.error(useColor ? chalk.red.bold(`Error: ${msg}`) : `Error: ${msg}`);
    process.exit(1);
  }

  const database = loadPricingData();
  const statsMap = new Map<string, ModelStats>();

  const watchingMsg = `Watching: ${logPath}`;
  console.log(useColor ? chalk.bold.cyan(watchingMsg) : watchingMsg);

  // Parse existing file content
  await new Promise<void>((resolve) => {
    const rl = createInterface({
      input: createReadStream(logPath, { encoding: "utf-8" }),
      crlfDelay: Infinity,
    });

    rl.on("line", (line: string) => {
      const entry = parseLogLine(line);
      if (entry) {
        processEntry(entry, database, statsMap, useColor, false);
      }
    });

    rl.on("close", () => {
      resolve();
    });
  });

  // Print initial summary if there were entries
  if (statsMap.size > 0) {
    printSummary(statsMap, useColor);
    console.log("");
    const liveMsg = "Live updates:";
    console.log(useColor ? chalk.bold.cyan(liveMsg) : liveMsg);
  }

  // Track file position for tailing
  let fileSize = statSync(logPath).size;

  // Watch for new lines (unwatchFile by path in cleanup, no need to store StatWatcher)
  watchFile(logPath, { interval: 500 }, (curr) => {
    const newSize = curr.size;
    if (newSize <= fileSize) {
      fileSize = newSize;
      return;
    }

    // Read only the new bytes
    const stream = createReadStream(logPath, {
      encoding: "utf-8",
      start: fileSize,
      end: newSize - 1,
    });

    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    rl.on("line", (line: string) => {
      const entry = parseLogLine(line);
      if (entry) {
        processEntry(entry, database, statsMap, useColor, true);
      }
    });

    fileSize = newSize;
  });

  // Handle Ctrl+C
  const cleanup = (): void => {
    unwatchFile(logPath);
    console.log("");
    const finalMsg = "Final Summary:";
    console.log(useColor ? chalk.bold.cyan(finalMsg) : finalMsg);
    printSummary(statsMap, useColor);
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Keep process alive
  await new Promise<void>(() => {
    // This promise intentionally never resolves — the watcher runs until SIGINT/SIGTERM
  });
}
