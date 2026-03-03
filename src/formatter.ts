/**
 * Output formatter module
 * Creates beautiful, colored terminal tables for cost comparison
 */

import chalk from "chalk";
import Table from "cli-table3";
import { ModelPricing, calculateCost } from "./pricing.js";

/**
 * Options for table formatting
 */
export interface TableOptions {
  useColor: boolean;
  showBatch: boolean;
  showContext: boolean;
}

/**
 * Format a cost value with appropriate precision
 *
 * @param {number} value - Value in dollars
 * @returns {string} Formatted string
 */
function formatCostValue(value: number): string {
  if (value < 0.0001) {
    return value.toExponential(1);
  }
  return value.toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Create a comparison table for multiple models
 *
 * @param {ModelPricing[]} models - Models to display
 * @param {number} inputTokens - Input token count
 * @param {number} outputTokens - Output token count
 * @param {TableOptions} options - Formatting options
 * @returns {string} Formatted table
 */
export function createComparisonTable(
  models: ModelPricing[],
  inputTokens: number,
  outputTokens: number,
  options: TableOptions
): string {
  const table = new Table({
    head: [
      options.useColor ? chalk.bold.cyan("Model") : "Model",
      options.useColor ? chalk.bold.cyan("Input") : "Input",
      options.useColor ? chalk.bold.cyan("Output") : "Output",
      options.useColor ? chalk.bold.cyan("Total") : "Total",
      ...(options.showBatch ? [options.useColor ? chalk.bold.cyan("Batch") : "Batch"] : []),
    ],
    colWidths: [28, 12, 12, 12, ...(options.showBatch ? [6] : [])],
    style: {
      head: [],
      border: options.useColor ? ["cyan"] : ["grey"],
    },
    wordWrap: false,
    colAligns: (["left", "right", "right", "right", ...(options.showBatch ? ["center"] : [])] as Array<"left" | "right" | "center">),
  });

  // Find cheapest model for highlighting
  let cheapestIdx = 0;
  let cheapestCost = Infinity;
  const costs = models.map((m, idx) => {
    const cost = calculateCost(m, inputTokens, outputTokens);
    if (cost.total < cheapestCost) {
      cheapestCost = cost.total;
      cheapestIdx = idx;
    }
    return cost;
  });

  // Add rows
  models.forEach((model, idx) => {
    const cost = costs[idx];
    const isCheapest = idx === cheapestIdx;
    const batchIndicator = model.supportsBatch ? "✓" : "";

    let modelName = model.name;
    if (isCheapest && options.useColor) {
      modelName = chalk.green.bold(`${model.name} ${batchIndicator}`.trim());
    } else if (options.useColor) {
      modelName = `${chalk.white(model.name)} ${batchIndicator}`.trim();
    } else {
      modelName = `${model.name} ${batchIndicator}`.trim();
    }

    const inputCost = formatCostValue(cost.input);
    const outputCost = formatCostValue(cost.output);

    const row = [
      modelName,
      options.useColor ? chalk.yellow(`$${inputCost}`) : `$${inputCost}`,
      options.useColor ? chalk.yellow(`$${outputCost}`) : `$${outputCost}`,
      isCheapest && options.useColor
        ? chalk.green.bold(`$${formatCostValue(cost.total)}`)
        : `$${formatCostValue(cost.total)}`,
    ];

    if (options.showBatch) {
      row.push(model.supportsBatch ? (options.useColor ? chalk.green("✓") : "✓") : "");
    }

    table.push(row);
  });

  return table.toString();
}

/**
 * Create a simple single-model cost display
 *
 * @param {ModelPricing} model - Model to display
 * @param {number} inputTokens - Input token count
 * @param {number} outputTokens - Output token count
 * @param {boolean} useColor - Whether to use colors
 * @returns {string} Formatted output
 */
export function formatSingleModelCost(
  model: ModelPricing,
  inputTokens: number,
  outputTokens: number,
  useColor: boolean
): string {
  const cost = calculateCost(model, inputTokens, outputTokens);

  const lines: string[] = [];
  lines.push("");

  if (useColor) {
    lines.push(chalk.bold.cyan(`${model.name}`));
    lines.push(chalk.gray(`  ${model.description}`));
    lines.push("");
    lines.push(
      chalk.white(`  Input tokens:  ${inputTokens} × $${(model.inputPrice / 1000000).toFixed(8)} = ${chalk.yellow(`$${formatCostValue(cost.input)}`)}`
      )
    );
    lines.push(
      chalk.white(`  Output tokens: ${outputTokens} × $${(model.outputPrice / 1000000).toFixed(8)} = ${chalk.yellow(`$${formatCostValue(cost.output)}`)}`
      )
    );
    lines.push("");
    lines.push(chalk.bold.green(`  Total Cost: $${formatCostValue(cost.total)}`));

    if (model.supportsBatch) {
      lines.push(chalk.gray(`  Batch API: ${chalk.green("✓ Supported")}`));
    }
    lines.push(chalk.gray(`  Context Window: ${model.contextWindow.toLocaleString()} tokens`));
  } else {
    lines.push(`${model.name}`);
    lines.push(`  ${model.description}`);
    lines.push("");
    lines.push(
      `  Input tokens:  ${inputTokens} × $${(model.inputPrice / 1000000).toFixed(8)} = $${formatCostValue(cost.input)}`
    );
    lines.push(
      `  Output tokens: ${outputTokens} × $${(model.outputPrice / 1000000).toFixed(8)} = $${formatCostValue(cost.output)}`
    );
    lines.push("");
    lines.push(`  Total Cost: $${formatCostValue(cost.total)}`);

    if (model.supportsBatch) {
      lines.push(`  Batch API: ✓ Supported`);
    }
    lines.push(`  Context Window: ${model.contextWindow.toLocaleString()} tokens`);
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Format token information summary
 *
 * @param {number} inputTokens - Input token count
 * @param {number} outputTokens - Output token count
 * @param {boolean} useColor - Whether to use colors
 * @returns {string} Formatted summary
 */
export function formatTokenSummary(
  inputTokens: number,
  outputTokens: number,
  useColor: boolean
): string {
  const totalTokens = inputTokens + outputTokens;
  const summary = `Input tokens: ${inputTokens} | Output estimate: ~${outputTokens} | Total estimate: ~${totalTokens} tokens`;

  if (useColor) {
    return chalk.gray(summary);
  }
  return summary;
}

/**
 * Format cheapest model indicator
 *
 * @param {ModelPricing} model - Cheapest model
 * @param {number} cost - Total cost
 * @param {boolean} useColor - Whether to use colors
 * @returns {string} Formatted indicator
 */
export function formatCheapestIndicator(
  model: ModelPricing,
  cost: number,
  useColor: boolean
): string {
  const indicator = `Cheapest: ${model.name} ($${formatCostValue(cost)})`;
  if (useColor) {
    return chalk.green.bold(indicator);
  }
  return indicator;
}

/**
 * Format JSON output
 *
 * @param {object} data - Data to format as JSON
 * @returns {string} JSON string
 */
export function formatAsJSON(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Format CSV output for comparison
 *
 * @param {ModelPricing[]} models - Models to display
 * @param {number} inputTokens - Input token count
 * @param {number} outputTokens - Output token count
 * @returns {string} CSV formatted output
 */
export function formatAsCSV(
  models: ModelPricing[],
  inputTokens: number,
  outputTokens: number
): string {
  const headers = ["Model", "Provider", "Input Cost ($)", "Output Cost ($)", "Total Cost ($)", "Context Window", "Batch"];
  const rows: string[] = [];

  rows.push(headers.join(","));

  models.forEach((model) => {
    const cost = calculateCost(model, inputTokens, outputTokens);
    rows.push(
      [
        `"${model.name}"`,
        `"${model.provider}"`,
        cost.input.toFixed(8),
        cost.output.toFixed(8),
        cost.total.toFixed(8),
        model.contextWindow.toString(),
        model.supportsBatch ? "Yes" : "No",
      ].join(",")
    );
  });

  return rows.join("\n");
}

/**
 * Format error message
 *
 * @param {string} message - Error message
 * @param {boolean} useColor - Whether to use colors
 * @returns {string} Formatted error
 */
export function formatError(message: string, useColor: boolean): string {
  if (useColor) {
    return chalk.red.bold(`Error: ${message}`);
  }
  return `Error: ${message}`;
}

/**
 * Format success message
 *
 * @param {string} message - Success message
 * @param {boolean} useColor - Whether to use colors
 * @returns {string} Formatted success
 */
export function formatSuccess(message: string, useColor: boolean): string {
  if (useColor) {
    return chalk.green(message);
  }
  return message;
}

/**
 * Format warning message
 *
 * @param {string} message - Warning message
 * @param {boolean} useColor - Whether to use colors
 * @returns {string} Formatted warning
 */
export function formatWarning(message: string, useColor: boolean): string {
  if (useColor) {
    return chalk.yellow.bold(`Warning: ${message}`);
  }
  return `Warning: ${message}`;
}
