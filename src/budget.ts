/**
 * Budget projection module
 * Projects monthly costs based on usage patterns
 */

import chalk from "chalk";
import Table from "cli-table3";
import {
  loadPricingData,
  findModel,
  calculateCost,
  sortModelsByCost,
  type ModelPricing,
} from "./pricing.js";
import { estimateOutputTokens } from "./tokenizer.js";

/**
 * Options for budget projection
 */
export interface BudgetOptions {
  modelId?: string;
  compare?: boolean;
  requestsPerDay: number;
  avgInputTokens: number;
  avgOutputTokens?: number;
  outputFormat: "text" | "json" | "csv";
  useColor: boolean;
}

/**
 * Projection data for a single model
 */
interface ModelProjection {
  model: string;
  provider: string;
  costPerRequest: number;
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
}

/**
 * Budget tier showing how many requests fit within a budget
 */
interface BudgetTier {
  budget: number;
  requestsPerDay: number;
}

/**
 * Compute projection for a single model
 *
 * @param {ModelPricing} model - Model to project
 * @param {number} avgInputTokens - Average input tokens per request
 * @param {number} avgOutputTokens - Average output tokens per request
 * @param {number} requestsPerDay - Number of requests per day
 * @returns {ModelProjection} Projection data
 */
function computeProjection(
  model: ModelPricing,
  avgInputTokens: number,
  avgOutputTokens: number,
  requestsPerDay: number
): ModelProjection {
  const cost = calculateCost(model, avgInputTokens, avgOutputTokens);
  const costPerRequest = cost.total;
  const daily = costPerRequest * requestsPerDay;
  return {
    model: model.name,
    provider: model.provider,
    costPerRequest,
    daily,
    weekly: daily * 7,
    monthly: daily * 30,
    yearly: daily * 365,
  };
}

/**
 * Format a dollar value for display
 *
 * @param {number} value - Dollar value
 * @returns {string} Formatted string
 */
function formatDollar(value: number): string {
  if (value < 0.01) {
    return `$${value.toFixed(4)}`;
  }
  if (value < 1) {
    return `$${value.toFixed(3)}`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Compute budget tiers for a given cost per request
 *
 * @param {number} costPerRequest - Cost per single request
 * @returns {BudgetTier[]} Array of budget tiers
 */
function computeBudgetTiers(costPerRequest: number): BudgetTier[] {
  const budgets = [10, 50, 100, 500];
  return budgets.map((budget) => ({
    budget,
    requestsPerDay: costPerRequest > 0 ? Math.floor(budget / (costPerRequest * 30)) : 0,
  }));
}

/**
 * Render projections as a text table
 *
 * @param {ModelProjection[]} projections - Projection data
 * @param {BudgetOptions} options - Display options
 */
function renderTextOutput(projections: ModelProjection[], options: BudgetOptions): void {
  const table = new Table({
    head: [
      options.useColor ? chalk.bold.cyan("Model") : "Model",
      options.useColor ? chalk.bold.cyan("Cost/Req") : "Cost/Req",
      options.useColor ? chalk.bold.cyan("Daily") : "Daily",
      options.useColor ? chalk.bold.cyan("Weekly") : "Weekly",
      options.useColor ? chalk.bold.cyan("Monthly") : "Monthly",
      options.useColor ? chalk.bold.cyan("Yearly") : "Yearly",
    ],
    colWidths: [28, 12, 12, 12, 12, 14],
    style: {
      head: [],
      border: options.useColor ? ["cyan"] : ["grey"],
    },
    wordWrap: false,
    colAligns: ["left", "right", "right", "right", "right", "right"] as Array<
      "left" | "right" | "center"
    >,
  });

  // Find cheapest (lowest monthly)
  let cheapestIdx = 0;
  let cheapestMonthly = Infinity;
  projections.forEach((p, idx) => {
    if (p.monthly < cheapestMonthly) {
      cheapestMonthly = p.monthly;
      cheapestIdx = idx;
    }
  });

  projections.forEach((p, idx) => {
    const isCheapest = idx === cheapestIdx;
    const modelName =
      isCheapest && options.useColor ? chalk.green.bold(p.model) : p.model;

    const row = [
      modelName,
      formatDollar(p.costPerRequest),
      formatDollar(p.daily),
      formatDollar(p.weekly),
      formatDollar(p.monthly),
      formatDollar(p.yearly),
    ];

    if (isCheapest && options.useColor) {
      row[4] = chalk.green.bold(formatDollar(p.monthly));
    }

    table.push(row);
  });

  console.log("");
  if (options.useColor) {
    console.log(
      chalk.bold.cyan("Budget Projection") +
        chalk.gray(
          ` (${options.requestsPerDay} req/day, ${options.avgInputTokens} input tokens)`
        )
    );
  } else {
    console.log(
      `Budget Projection (${options.requestsPerDay} req/day, ${options.avgInputTokens} input tokens)`
    );
  }
  console.log(table.toString());

  // Budget tiers for the cheapest model
  const cheapest = projections[cheapestIdx];
  console.log("");
  if (options.useColor) {
    console.log(chalk.bold.cyan(`Budget Tiers (${cheapest.model}):`));
  } else {
    console.log(`Budget Tiers (${cheapest.model}):`);
  }

  const tiers = computeBudgetTiers(cheapest.costPerRequest);
  tiers.forEach((tier) => {
    const line = `  $${tier.budget}/mo budget -> ${tier.requestsPerDay.toLocaleString()} requests/day`;
    if (options.useColor) {
      console.log(chalk.white(line));
    } else {
      console.log(line);
    }
  });
  console.log("");
}

/**
 * Render projections as JSON
 *
 * @param {ModelProjection[]} projections - Projection data
 * @param {BudgetOptions} options - Display options
 */
function renderJsonOutput(projections: ModelProjection[], options: BudgetOptions): void {
  const avgOutputTokens =
    options.avgOutputTokens ?? estimateOutputTokens(options.avgInputTokens);
  const output = {
    requestsPerDay: options.requestsPerDay,
    avgInputTokens: options.avgInputTokens,
    avgOutputTokens,
    projections: projections.map((p) => ({
      model: p.model,
      provider: p.provider,
      costPerRequest: p.costPerRequest,
      daily: p.daily,
      weekly: p.weekly,
      monthly: p.monthly,
      yearly: p.yearly,
    })),
  };
  console.log(JSON.stringify(output, null, 2));
}

/**
 * Render projections as CSV
 *
 * @param {ModelProjection[]} projections - Projection data
 */
function renderCsvOutput(projections: ModelProjection[]): void {
  const headers = [
    "Model",
    "Provider",
    "Cost/Request ($)",
    "Daily ($)",
    "Weekly ($)",
    "Monthly ($)",
    "Yearly ($)",
  ];
  console.log(headers.join(","));
  projections.forEach((p) => {
    console.log(
      [
        `"${p.model}"`,
        `"${p.provider}"`,
        p.costPerRequest.toFixed(8),
        p.daily.toFixed(4),
        p.weekly.toFixed(4),
        p.monthly.toFixed(4),
        p.yearly.toFixed(4),
      ].join(",")
    );
  });
}

/**
 * Run budget projection
 *
 * @param {BudgetOptions} options - Budget options
 */
export async function runBudget(options: BudgetOptions): Promise<void> {
  const db = loadPricingData();
  const avgOutputTokens =
    options.avgOutputTokens ?? estimateOutputTokens(options.avgInputTokens);

  let models: ModelPricing[];

  if (options.modelId && !options.compare) {
    const model = findModel(options.modelId, db);
    if (!model) {
      const msg = `Model not found: ${options.modelId}`;
      if (options.useColor) {
        console.error(chalk.red.bold(`Error: ${msg}`));
      } else {
        console.error(`Error: ${msg}`);
      }
      process.exit(1);
    }
    models = [model];
  } else {
    models = sortModelsByCost(db.models, options.avgInputTokens, avgOutputTokens);
  }

  const projections = models.map((m) =>
    computeProjection(m, options.avgInputTokens, avgOutputTokens, options.requestsPerDay)
  );

  switch (options.outputFormat) {
    case "json":
      renderJsonOutput(projections, options);
      break;
    case "csv":
      renderCsvOutput(projections);
      break;
    default:
      renderTextOutput(projections, options);
      break;
  }
}
