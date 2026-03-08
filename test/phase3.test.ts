/**
 * Phase 3 feature tests
 * Covers: breakdown, mcp, interactive (smoke tests)
 */

import { jest } from "@jest/globals";

// ─── Helpers ────────────────────────────────────────────────────────────────

function captureConsole(): { logs: string[]; errors: string[]; restore: () => void } {
  const logs: string[] = [];
  const errors: string[] = [];
  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;
  console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
  console.error = (...args: unknown[]) => errors.push(args.map(String).join(" "));
  console.warn = (...args: unknown[]) => errors.push(args.map(String).join(" "));
  return {
    logs,
    errors,
    restore: () => {
      console.log = origLog;
      console.error = origError;
      console.warn = origWarn;
    },
  };
}

// ─── Breakdown ───────────────────────────────────────────────────────────────

import { runBreakdown } from "../src/breakdown";

describe("runBreakdown", () => {
  it("outputs text with provider sections and overall cheapest", async () => {
    const cap = captureConsole();
    try {
      await runBreakdown({ outputFormat: "text", useColor: false });
    } finally {
      cap.restore();
    }
    const output = cap.logs.join("\n");
    expect(output).toContain("Provider Breakdown");
    expect(output).toContain("Anthropic");
    expect(output).toContain("OpenAI");
    expect(output).toContain("Overall cheapest");
  });

  it("uses provided inputTokens/outputTokens", async () => {
    const cap = captureConsole();
    try {
      await runBreakdown({ inputTokens: 500, outputTokens: 250, outputFormat: "text", useColor: false });
    } finally {
      cap.restore();
    }
    expect(cap.logs.join("")).toContain("500 input + 250 output");
  });

  it("counts tokens from prompt text", async () => {
    const cap = captureConsole();
    try {
      await runBreakdown({ prompt: "Hello world", outputFormat: "text", useColor: false });
    } finally {
      cap.restore();
    }
    // Should show some token count in the header
    expect(cap.logs.join("")).toContain("input +");
  });

  it("outputs valid JSON with providers array", async () => {
    const cap = captureConsole();
    try {
      await runBreakdown({ inputTokens: 1000, outputTokens: 500, outputFormat: "json", useColor: false });
    } finally {
      cap.restore();
    }
    const data = JSON.parse(cap.logs.join(""));
    expect(data.inputTokens).toBe(1000);
    expect(data.outputTokens).toBe(500);
    expect(Array.isArray(data.providers)).toBe(true);
    expect(data.providers.length).toBeGreaterThan(0);
    expect(data.providers[0]).toHaveProperty("provider");
    expect(data.providers[0]).toHaveProperty("cheapestModel");
    expect(data.providers[0]).toHaveProperty("models");
    expect(data).toHaveProperty("overallCheapest");
    expect(data.overallCheapest).toHaveProperty("model");
    expect(data.overallCheapest).toHaveProperty("totalCost");
  });

  it("outputs CSV with header and provider data", async () => {
    const cap = captureConsole();
    try {
      await runBreakdown({ inputTokens: 100, outputTokens: 50, outputFormat: "csv", useColor: false });
    } finally {
      cap.restore();
    }
    const output = cap.logs.join("\n");
    expect(output).toContain("provider,model,inputCost,outputCost,totalCost");
    expect(output).toContain("Anthropic");
  });

  it("overallCheapest is the lowest cost across all providers", async () => {
    const cap = captureConsole();
    try {
      await runBreakdown({ inputTokens: 1000, outputTokens: 500, outputFormat: "json", useColor: false });
    } finally {
      cap.restore();
    }
    const data = JSON.parse(cap.logs.join(""));
    const allCosts = data.providers.flatMap((p: { models: Array<{ totalCost: number }> }) =>
      p.models.map((m) => m.totalCost)
    );
    const minCost = Math.min(...allCosts);
    expect(data.overallCheapest.totalCost).toBeCloseTo(minCost, 8);
  });

  it("each provider's cheapestCost matches minimum model cost", async () => {
    const cap = captureConsole();
    try {
      await runBreakdown({ inputTokens: 1000, outputTokens: 500, outputFormat: "json", useColor: false });
    } finally {
      cap.restore();
    }
    const data = JSON.parse(cap.logs.join(""));
    for (const provider of data.providers) {
      const minCost = Math.min(...provider.models.map((m: { totalCost: number }) => m.totalCost));
      expect(provider.cheapestCost).toBeCloseTo(minCost, 8);
    }
  });
});

// ─── MCP Server ───────────────────────────────────────────────────────────────

import { runMCPServer } from "../src/mcp";

describe("runMCPServer", () => {
  it("exports runMCPServer as a function", () => {
    expect(typeof runMCPServer).toBe("function");
  });

  it("is an async function (returns Promise when inspected via toString)", () => {
    // Can't invoke the MCP server in tests (it opens stdio transport)
    // Verify it's an async function by checking constructor name
    expect(runMCPServer.constructor.name).toBe("AsyncFunction");
  });
});

// ─── Interactive (smoke tests) ────────────────────────────────────────────────

import { runInteractive } from "../src/interactive";

describe("runInteractive", () => {
  it("exports runInteractive as a function", () => {
    expect(typeof runInteractive).toBe("function");
  });
});

// ─── Module import health checks ─────────────────────────────────────────────

describe("Phase 3 module imports", () => {
  it("breakdown module loads without error", async () => {
    const mod = await import("../src/breakdown");
    expect(mod.runBreakdown).toBeDefined();
  });

  it("mcp module loads without error", async () => {
    const mod = await import("../src/mcp");
    expect(mod.runMCPServer).toBeDefined();
  });

  it("interactive module loads without error", async () => {
    const mod = await import("../src/interactive");
    expect(mod.runInteractive).toBeDefined();
  });
});
