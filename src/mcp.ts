/**
 * MCP (Model Context Protocol) server mode
 * Exposes tokenprice functionality as MCP tools over stdio
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  loadPricingData,
  findModel,
  calculateCost,
  sortModelsByCost,
} from "./pricing.js";
import {
  countTokens,
  countTokensImproved,
  estimateOutputTokens,
  formatTokens,
} from "./tokenizer.js";

/**
 * Run the tokenprice MCP server over stdio
 */
export async function runMCPServer(): Promise<void> {
  const server = new McpServer(
    { name: "tokenprice", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  const db = loadPricingData();

  // Tool 1: estimate_cost
  server.tool(
    "estimate_cost",
    "Estimate the cost of a prompt for a specific LLM model",
    { prompt: z.string(), model: z.string() },
    (args) => {
      const model = findModel(args.model, db);
      if (!model) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Model "${args.model}" not found. Use list_models to see available models.`,
            },
          ],
        };
      }

      const tokenResult = countTokens(args.prompt, model.id);
      const inputTokens = tokenResult.tokens;
      const outputTokens = estimateOutputTokens(inputTokens);
      const cost = calculateCost(model, inputTokens, outputTokens);

      const lines = [
        `Model: ${model.name} (${model.provider})`,
        `Input tokens: ${formatTokens(inputTokens)} (${tokenResult.method})`,
        `Estimated output tokens: ${formatTokens(outputTokens)}`,
        `Input cost:  $${cost.input.toFixed(6)}`,
        `Output cost: $${cost.output.toFixed(6)}`,
        `Total cost:  $${cost.total.toFixed(6)}`,
        `Context window: ${formatTokens(model.contextWindow)}`,
      ];

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );

  // Tool 2: compare_models
  server.tool(
    "compare_models",
    "Compare the cost of a prompt across all available LLM models",
    { prompt: z.string() },
    (args) => {
      const tokenResult = countTokensImproved(args.prompt);
      const inputTokens = tokenResult.tokens;
      const outputTokens = estimateOutputTokens(inputTokens);

      const sorted = sortModelsByCost(db.models, inputTokens, outputTokens);

      const header = `Prompt: ${inputTokens} input tokens, ~${outputTokens} estimated output tokens\n`;
      const divider = "-".repeat(70);
      const colHeader = `${"Model".padEnd(25)} ${"Provider".padEnd(12)} ${"Input".padEnd(12)} ${"Output".padEnd(12)} Total`;

      const rows = sorted.map((m) => {
        const cost = calculateCost(m, inputTokens, outputTokens);
        return (
          `${m.name.padEnd(25)} ` +
          `${m.provider.padEnd(12)} ` +
          `$${cost.input.toFixed(6).padStart(10)} ` +
          `$${cost.output.toFixed(6).padStart(10)} ` +
          `$${cost.total.toFixed(6)}`
        );
      });

      const text = [header, colHeader, divider, ...rows].join("\n");

      return {
        content: [{ type: "text" as const, text }],
      };
    }
  );

  // Tool 3: list_models
  server.tool(
    "list_models",
    "List all available LLM models, optionally filtered by provider",
    { provider: z.string().optional() },
    (args) => {
      let models = db.models;
      if (args.provider) {
        const lower = args.provider.toLowerCase();
        models = models.filter(
          (m) => m.provider.toLowerCase() === lower
        );
      }

      const result = models.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        inputPrice: m.inputPrice,
        outputPrice: m.outputPrice,
        contextWindow: m.contextWindow,
        supportsBatch: m.supportsBatch,
      }));

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
