/**
 * Interactive REPL mode for tokenprice
 * Provides a looping prompt-based interface with tab completion for model names
 */

import * as readline from "readline";
import chalk from "chalk";
import {
  loadPricingData,
  findModel,
  sortModelsByCost,
} from "./pricing.js";
import type { PricingDatabase } from "./pricing.js";
import {
  createComparisonTable,
  formatSingleModelCost,
  formatTokenSummary,
} from "./formatter.js";
import { countTokensImproved, estimateOutputTokens } from "./tokenizer.js";

/**
 * Promisified readline.question helper
 *
 * @param {readline.Interface} rl - Readline interface
 * @param {string} prompt - Question prompt
 * @returns {Promise<string>} User's answer
 */
function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer: string) => {
      resolve(answer);
    });
  });
}

/**
 * Build a completer function for tab-completing model IDs
 *
 * @param {PricingDatabase} database - Pricing database for model IDs
 * @returns {function} Completer compatible with readline
 */
function buildCompleter(
  database: PricingDatabase
): (line: string) => [string[], string] {
  const modelIds = database.models.map((m) => m.id);
  return function completer(line: string): [string[], string] {
    const lower = line.toLowerCase();
    const hits = modelIds.filter((id) => id.toLowerCase().startsWith(lower));
    return [hits.length > 0 ? hits : modelIds, line];
  };
}

/**
 * Print the welcome banner
 */
function printBanner(): void {
  console.log(
    chalk.cyan(
      [
        "",
        "╔══════════════════════════════════════════╗",
        "║  tokenprice — interactive mode            ║",
        "║  Tab to autocomplete model names          ║",
        '║  Type "exit" or Ctrl+C to quit            ║',
        "╚══════════════════════════════════════════╝",
        "",
      ].join("\n")
    )
  );
}

/**
 * Run the interactive REPL mode
 * Loops prompting the user for a prompt and model, displaying cost results
 */
export async function runInteractive(): Promise<void> {
  const database = loadPricingData();

  printBanner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: buildCompleter(database),
  });

  // Handle Ctrl+C gracefully
  rl.on("SIGINT", () => {
    console.log("\n" + chalk.cyan("Goodbye!"));
    rl.close();
    process.exit(0);
  });

  let running = true;

  while (running) {
    // Step a: Ask for prompt
    let promptText = "";
    while (promptText === "") {
      const answer = await question(rl, '> Enter your prompt (or "exit"): ');
      const trimmed = answer.trim();
      if (trimmed === "exit" || trimmed === "quit") {
        console.log(chalk.cyan("Goodbye!"));
        rl.close();
        process.exit(0);
      }
      promptText = trimmed;
    }

    // Step b: Ask for model
    const modelAnswer = await question(
      rl,
      "> Model [Enter=compare all, or type name]: "
    );
    const modelQuery = modelAnswer.trim();

    // Count tokens
    const tokenResult = countTokensImproved(promptText);
    const inputTokens = tokenResult.tokens;
    const outputTokens = estimateOutputTokens(inputTokens);

    // Step c: Show results
    if (modelQuery === "") {
      // Compare all models
      const sorted = sortModelsByCost(database.models, inputTokens, outputTokens);
      const table = createComparisonTable(sorted, inputTokens, outputTokens, {
        useColor: true,
        showBatch: true,
        showContext: false,
      });
      console.log(table);
    } else {
      // Single model
      const model = findModel(modelQuery, database);
      if (model) {
        const output = formatSingleModelCost(
          model,
          inputTokens,
          outputTokens,
          true
        );
        console.log(output);
      } else {
        console.log(chalk.red(`Model "${modelQuery}" not found.`));
        console.log(
          chalk.gray(
            "Available models: " +
              database.models.map((m) => m.id).join(", ")
          )
        );
        console.log("");
        continue;
      }
    }

    // Step d: Show token summary
    console.log(formatTokenSummary(inputTokens, outputTokens, true));
    console.log("");

    // Step e: Ask to continue
    const again = await question(rl, "> Estimate another? [Y/n]: ");
    const trimmedAgain = again.trim().toLowerCase();
    if (trimmedAgain === "n" || trimmedAgain === "no") {
      running = false;
    }
    console.log("");
  }

  console.log(chalk.cyan("Goodbye!"));
  rl.close();
  process.exit(0);
}
