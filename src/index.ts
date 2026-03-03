#!/usr/bin/env node

/**
 * tokenprice - Know before you send. Compare LLM costs in your terminal.
 * Main CLI entry point
 */

import { Command } from "commander";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import chalk from "chalk";
import {
  loadPricingData,
  findModel,
  sortModelsByCost,
  calculateCost,
} from "./pricing.js";
import {
  countTokensImproved,
  estimateOutputTokens,
  formatTokens,
} from "./tokenizer.js";
import {
  createComparisonTable,
  formatSingleModelCost,
  formatTokenSummary,
  formatCheapestIndicator,
  formatAsJSON,
  formatAsCSV,
  formatError,
  formatWarning,
} from "./formatter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Determine if color output should be used
 */
function shouldUseColor(): boolean {
  const noColor =
    process.env.NO_COLOR !== undefined || process.env.NO_COLOR === "1";
  const forceColor =
    process.env.FORCE_COLOR !== undefined || process.env.FORCE_COLOR === "1";

  if (forceColor) return true;
  if (noColor) return false;
  return process.stdout.isTTY === true;
}

/**
 * Main CLI application
 */
async function main(): Promise<void> {
  const useColor = shouldUseColor();
  const program = new Command();

  // Load pricing data
  const pricingData = loadPricingData();

  // Read package.json for version
  let version = "0.1.0";
  try {
    const pkgPath = `${__dirname}/../package.json`;
    const pkgData = JSON.parse(readFileSync(pkgPath, "utf-8"));
    version = pkgData.version;
  } catch {
    // Use default version
  }

  program
    .name("tokenprice")
    .description(
      "Know before you send. Compare LLM costs in your terminal."
    )
    .version(version, "-v, --version", "Display version")
    .usage("[options] [prompt]");

  /**
   * Main estimate command
   */
  program
    .argument("[prompt...]", "Prompt text to estimate costs for")
    .option(
      "-m, --model <model>",
      "Model to estimate cost for (default: all models with --compare)"
    )
    .option(
      "-c, --compare",
      "Compare costs across all available models"
    )
    .option(
      "-f, --file <path>",
      "Read prompt from file instead of command line"
    )
    .option(
      "--show-tokens",
      "Show detailed token breakdown"
    )
    .option(
      "-o, --output <format>",
      "Output format (text, json, csv)",
      "text"
    )
    .option(
      "--no-color",
      "Disable colored output (respects NO_COLOR env var)"
    )
    .action(async (prompts, options) => {
      try {
        let prompt = "";

        // Get prompt from various sources
        if (options.file) {
          prompt = readFileSync(options.file, "utf-8").trim();
        } else if (prompts && prompts.length > 0) {
          prompt = prompts.join(" ");
        } else if (!process.stdin.isTTY) {
          // Read from stdin
          prompt = await readStdin();
        } else {
          console.error(
            formatError("No prompt provided. Use --help for usage.", useColor)
          );
          process.exit(1);
        }

        if (!prompt) {
          console.error(
            formatError("Prompt cannot be empty.", useColor)
          );
          process.exit(1);
        }

        // Count tokens
        const tokenResult = countTokensImproved(prompt);
        const inputTokens = tokenResult.tokens;
        const outputTokens = estimateOutputTokens(inputTokens);

        // Get models to display
        let models = pricingData.models;

        if (options.model) {
          const model = findModel(options.model, pricingData);
          if (!model) {
            console.error(
              formatError(
                `Model not found: ${options.model}. Use --compare to see all models.`,
                useColor
              )
            );
            process.exit(1);
          }
          models = [model];
        } else if (options.compare) {
          // Sort by cost for comparison
          models = sortModelsByCost(models, inputTokens, outputTokens);
        } else if (!options.model) {
          // Default to Claude Sonnet if no model specified and not comparing
          const defaultModel = findModel("claude-sonnet", pricingData);
          if (defaultModel) {
            models = [defaultModel];
          }
        }

        // Output based on format
        if (options.output === "json") {
          const result = {
            prompt: prompt.substring(0, 100) + (prompt.length > 100 ? "..." : ""),
            inputTokens,
            outputTokensEstimated: outputTokens,
            totalTokensEstimated: inputTokens + outputTokens,
            models: models.map((m) => {
              const cost = calculateCost(m, inputTokens, outputTokens);
              return {
                id: m.id,
                name: m.name,
                provider: m.provider,
                inputCost: parseFloat(cost.input.toFixed(8)),
                outputCost: parseFloat(cost.output.toFixed(8)),
                totalCost: parseFloat(cost.total.toFixed(8)),
                supportsBatch: m.supportsBatch,
              };
            }),
          };
          console.log(formatAsJSON(result));
        } else if (options.output === "csv") {
          console.log(formatAsCSV(models, inputTokens, outputTokens));
        } else {
          // Text output
          console.log("");

          if (options.compare || models.length > 1) {
            // Show comparison table
            const table = createComparisonTable(
              models,
              inputTokens,
              outputTokens,
              {
                useColor: useColor && !options.noColor,
                showBatch: true,
                showContext: false,
              }
            );
            console.log(table);
          } else if (models.length === 1) {
            // Show single model details
            const output = formatSingleModelCost(
              models[0],
              inputTokens,
              outputTokens,
              useColor && !options.noColor
            );
            console.log(output);
          }

          // Show token summary
          console.log(
            formatTokenSummary(
              inputTokens,
              outputTokens,
              useColor && !options.noColor
            )
          );

          // Find and show cheapest
          const costs = models.map((m) => calculateCost(m, inputTokens, outputTokens));
          const cheapestIdx = costs.reduce((minIdx, cost, idx) =>
            cost.total < costs[minIdx].total ? idx : minIdx
          );

          console.log(
            formatCheapestIndicator(
              models[cheapestIdx],
              costs[cheapestIdx].total,
              useColor && !options.noColor
            )
          );

          if (useColor && !options.noColor) {
            console.log(
              chalk.gray("✓ = Batch API support")
            );
          } else {
            console.log("✓ = Batch API support");
          }
          console.log("");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatError(message, useColor));
        process.exit(1);
      }
    });

  /**
   * Count tokens command
   */
  program
    .command("count <text...>")
    .description("Count tokens in text")
    .option("-m, --model <model>", "Model for tokenization (optional)")
    .option("-o, --output <format>", "Output format (text, json)", "text")
    .action((textParts, options) => {
      try {
        const text = textParts.join(" ");
        const result = countTokensImproved(text);

        if (options.output === "json") {
          console.log(
            formatAsJSON({
              text: text.substring(0, 100),
              tokens: result.tokens,
              method: result.method,
              accuracy: result.accuracy,
            })
          );
        } else {
          console.log(`${result.tokens} tokens`);
          if (result.accuracy === "low") {
            console.log(
              formatWarning(
                "Accuracy: low (using heuristic)",
                useColor
              )
            );
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatError(message, useColor));
        process.exit(1);
      }
    });

  /**
   * List models command
   */
  program
    .command("list")
    .description("List all available models")
    .option(
      "-p, --provider <provider>",
      "Filter by provider"
    )
    .option("-o, --output <format>", "Output format (text, json)", "text")
    .action((options) => {
      try {
        let models = pricingData.models;

        if (options.provider) {
          models = models.filter(
            (m) =>
              m.provider.toLowerCase() ===
              options.provider.toLowerCase()
          );
        }

        if (options.output === "json") {
          console.log(formatAsJSON(models));
        } else {
          console.log("");
          console.log(
            useColor
              ? chalk.bold.cyan("Available Models:")
              : "Available Models:"
          );
          console.log("");

          const byProvider: { [key: string]: typeof models } = {};
          models.forEach((m) => {
            if (!byProvider[m.provider]) {
              byProvider[m.provider] = [];
            }
            byProvider[m.provider].push(m);
          });

          Object.entries(byProvider).forEach(([provider, providerModels]) => {
            console.log(
              useColor
                ? chalk.bold.yellow(`${provider}:`)
                : `${provider}:`
            );
            providerModels.forEach((m) => {
              const batchStr = m.supportsBatch ? " (batch ✓)" : "";
              console.log(
                `  - ${m.name}${batchStr}`
              );
              console.log(`    $${m.inputPrice}/M input | $${m.outputPrice}/M output`);
            });
            console.log("");
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(formatError(message, useColor));
        process.exit(1);
      }
    });

  /**
   * Help command
   */
  program.addHelpCommand(true);

  // Parse arguments
  program.parse(process.argv);

  // Show help if no arguments
  if (process.argv.length < 3) {
    program.help();
  }
}

/**
 * Read from stdin
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";

    process.stdin.setEncoding("utf8");
    process.stdin.on("readable", () => {
      let chunk;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });

    process.stdin.on("end", () => {
      resolve(data.trim());
    });

    process.stdin.on("error", reject);
  });
}

// Run main
main().catch((error) => {
  console.error(
    formatError(
      error instanceof Error ? error.message : String(error),
      shouldUseColor()
    )
  );
  process.exit(1);
});
