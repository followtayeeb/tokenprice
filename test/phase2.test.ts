/**
 * Phase 2 feature tests
 * Covers: batch, budget, guard, watch, fetchLatestPricing
 */

import { jest } from "@jest/globals";
import { writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ─── Helpers ────────────────────────────────────────────────────────────────

const TMP = tmpdir();

async function writeTmp(name: string, content: string): Promise<string> {
  const p = join(TMP, `tokenprice-test-${name}`);
  await writeFile(p, content, "utf-8");
  return p;
}

async function cleanTmp(p: string): Promise<void> {
  try {
    await unlink(p);
  } catch {
    // ignore
  }
}

// Capture console output
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

// ─── Batch ───────────────────────────────────────────────────────────────────

import { runBatch } from "../src/batch";

describe("runBatch", () => {
  it("processes a JSONL file in text mode", async () => {
    const content = [
      JSON.stringify({ id: "p1", prompt: "Explain quantum computing" }),
      JSON.stringify({ id: "p2", prompt: "What is TypeScript?" }),
    ].join("\n");

    const filePath = await writeTmp("batch.jsonl", content);
    const cap = captureConsole();
    try {
      await runBatch({ filePath, outputFormat: "text", useColor: false });
    } finally {
      cap.restore();
    }
    await cleanTmp(filePath);

    const output = cap.logs.join("\n");
    expect(output).toContain("p1");
    expect(output).toContain("p2");
    expect(output).toContain("Batch Summary");
  });

  it("processes a JSONL file in json mode", async () => {
    const content = JSON.stringify({ id: "q1", prompt: "Hello world" }) + "\n";
    const filePath = await writeTmp("batch2.jsonl", content);

    const cap = captureConsole();
    try {
      await runBatch({ filePath, outputFormat: "json", useColor: false });
    } finally {
      cap.restore();
    }
    await cleanTmp(filePath);

    const parsed = JSON.parse(cap.logs[0]);
    expect(parsed).toHaveProperty("id", "q1");
    expect(parsed).toHaveProperty("inputTokens");
    expect(parsed).toHaveProperty("costs");
    expect(Array.isArray(parsed.costs)).toBe(true);
  });

  it("processes a CSV file in csv mode", async () => {
    const content = "prompt,id\nExplain AI,row1\nWhat is Rust?,row2\n";
    const filePath = await writeTmp("batch.csv", content);

    const cap = captureConsole();
    try {
      await runBatch({ filePath, outputFormat: "csv", useColor: false });
    } finally {
      cap.restore();
    }
    await cleanTmp(filePath);

    const output = cap.logs.join("\n");
    expect(output).toContain("id,prompt,model");
    expect(output).toContain("row1");
    expect(output).toContain("row2");
  });

  it("warns on malformed JSONL lines and skips them", async () => {
    const content = "not-json\n" + JSON.stringify({ prompt: "Valid prompt" }) + "\n";
    const filePath = await writeTmp("batch-bad.jsonl", content);

    const origStderr = process.stderr.write.bind(process.stderr);
    const warnings: string[] = [];
    process.stderr.write = (s: string | Uint8Array) => {
      warnings.push(typeof s === "string" ? s : "");
      return true;
    };

    const cap = captureConsole();
    try {
      await runBatch({ filePath, outputFormat: "text", useColor: false });
    } finally {
      cap.restore();
      process.stderr.write = origStderr;
    }
    await cleanTmp(filePath);

    expect(warnings.some((w) => w.includes("invalid JSON") || w.includes("skipping"))).toBe(true);
    expect(cap.logs.join("")).toContain("Batch Summary");
  });

  it("sets exitCode=1 for missing file", async () => {
    const origExitCode = process.exitCode;
    process.exitCode = 0;
    const cap = captureConsole();
    try {
      await runBatch({ filePath: "/nonexistent/file.jsonl", outputFormat: "text", useColor: false });
    } finally {
      cap.restore();
    }
    expect(process.exitCode).toBe(1);
    process.exitCode = origExitCode;
  });
});

// ─── Budget ───────────────────────────────────────────────────────────────────

import { runBudget } from "../src/budget";

describe("runBudget", () => {
  it("outputs projections in text mode", async () => {
    const cap = captureConsole();
    try {
      await runBudget({
        requestsPerDay: 100,
        avgInputTokens: 1000,
        outputFormat: "text",
        useColor: false,
      });
    } finally {
      cap.restore();
    }

    const output = cap.logs.join("\n");
    expect(output).toContain("Budget Projection");
    expect(output).toContain("Monthly");
    expect(output).toContain("Budget Tiers");
  });

  it("outputs valid JSON", async () => {
    const cap = captureConsole();
    try {
      await runBudget({
        requestsPerDay: 50,
        avgInputTokens: 500,
        outputFormat: "json",
        useColor: false,
      });
    } finally {
      cap.restore();
    }

    const data = JSON.parse(cap.logs.join(""));
    expect(data.requestsPerDay).toBe(50);
    expect(data.avgInputTokens).toBe(500);
    expect(Array.isArray(data.projections)).toBe(true);
    expect(data.projections[0]).toHaveProperty("monthly");
    expect(data.projections[0]).toHaveProperty("costPerRequest");
  });

  it("computes monthly cost correctly", async () => {
    const cap = captureConsole();
    try {
      // Use gpt-4o: $2.50/M input, $10/M output, 1000 input + ~1500 est. output tokens
      await runBudget({
        modelId: "gpt-4o",
        requestsPerDay: 100,
        avgInputTokens: 1000,
        avgOutputTokens: 500,
        outputFormat: "json",
        useColor: false,
      });
    } finally {
      cap.restore();
    }

    const data = JSON.parse(cap.logs.join(""));
    expect(data.projections).toHaveLength(1);
    const proj = data.projections[0];
    // costPerRequest = (1000*2.5 + 500*10) / 1_000_000 = 0.0075
    expect(proj.costPerRequest).toBeCloseTo(0.0075, 4);
    expect(proj.monthly).toBeCloseTo(0.0075 * 100 * 30, 2);
  });

  it("outputs CSV with header", async () => {
    const cap = captureConsole();
    try {
      await runBudget({
        modelId: "gpt-4o",
        requestsPerDay: 10,
        avgInputTokens: 200,
        outputFormat: "csv",
        useColor: false,
      });
    } finally {
      cap.restore();
    }

    const output = cap.logs.join("\n");
    expect(output).toContain("Model");
    expect(output).toContain("Monthly");
    expect(output).toContain("GPT-4o");
  });
});

// ─── Guard ────────────────────────────────────────────────────────────────────

import { runGuard } from "../src/guard";

class ExitError extends Error {
  constructor(public code: number) { super(`process.exit(${code})`); }
}

describe("runGuard", () => {
  let origExit: typeof process.exit;
  let exitMock: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    origExit = process.exit;
    exitMock = jest.fn().mockImplementation((code?: number) => {
      throw new ExitError(code ?? 0);
    });
    process.exit = exitMock as unknown as typeof process.exit;
  });

  afterEach(() => {
    process.exit = origExit;
  });

  async function guard(opts: Parameters<typeof runGuard>[0]): Promise<ReturnType<typeof captureConsole>> {
    const cap = captureConsole();
    try {
      await runGuard(opts);
    } catch (e) {
      if (!(e instanceof ExitError)) throw e;
    } finally {
      cap.restore();
    }
    return cap;
  }

  it("PASSes when cost is below limit", async () => {
    const cap = await guard({ prompt: "Hi", modelId: "claude-haiku", maxCost: 100.0, outputFormat: "text", useColor: false });
    expect(exitMock).toHaveBeenCalledWith(0);
    expect(cap.logs.join("")).toContain("PASS");
  });

  it("FAILs when cost exceeds limit", async () => {
    const cap = await guard({ prompt: "A".repeat(100000), modelId: "claude-opus", maxCost: 0.000001, outputFormat: "text", useColor: false });
    expect(exitMock).toHaveBeenCalledWith(1);
    expect(cap.logs.join("")).toContain("FAIL");
  });

  it("outputs JSON with correct fields", async () => {
    const cap = await guard({ prompt: "Short prompt", modelId: "gpt-4o", maxCost: 99.0, outputFormat: "json", useColor: false });
    expect(exitMock).toHaveBeenCalledWith(0);
    const data = JSON.parse(cap.logs[0]);
    expect(data.status).toBe("pass");
    expect(data).toHaveProperty("estimatedCost");
    expect(data).toHaveProperty("inputTokens");
    expect(data.maxCost).toBe(99.0);
  });

  it("reads prompt from file", async () => {
    const filePath = await writeTmp("guard-prompt.txt", "Hello from file");
    const cap = await guard({ promptPath: filePath, modelId: "gpt-4o-mini", maxCost: 50.0, outputFormat: "text", useColor: false });
    await cleanTmp(filePath);
    expect(exitMock).toHaveBeenCalledWith(0);
    expect(cap.logs.join("")).toContain("PASS");
  });

  it("exits 1 for unknown model", async () => {
    await guard({ prompt: "test", modelId: "nonexistent-model-xyz", maxCost: 1.0, outputFormat: "text", useColor: false });
    expect(exitMock).toHaveBeenCalledWith(1);
  });
});

// ─── Watch ────────────────────────────────────────────────────────────────────

import { parseLogLine } from "../src/watch";

describe("parseLogLine", () => {
  it("parses key=value format", () => {
    const result = parseLogLine(
      "2024-01-15T10:23:45Z model=gpt-4o input_tokens=1250 output_tokens=380"
    );
    expect(result).not.toBeNull();
    expect(result?.model).toBe("gpt-4o");
    expect(result?.inputTokens).toBe(1250);
    expect(result?.outputTokens).toBe(380);
    expect(result?.timestamp).toBe("2024-01-15T10:23:45Z");
  });

  it("parses JSON with nested usage object", () => {
    const result = parseLogLine(
      JSON.stringify({
        timestamp: "2024-01-15T10:23:45Z",
        model: "gpt-4o",
        usage: { input_tokens: 800, output_tokens: 200 },
      })
    );
    expect(result).not.toBeNull();
    expect(result?.model).toBe("gpt-4o");
    expect(result?.inputTokens).toBe(800);
    expect(result?.outputTokens).toBe(200);
  });

  it("parses flat JSON format", () => {
    const result = parseLogLine(
      JSON.stringify({ model: "claude-sonnet-4-5", input_tokens: 500, output_tokens: 150 })
    );
    expect(result).not.toBeNull();
    expect(result?.model).toBe("claude-sonnet-4-5");
    expect(result?.inputTokens).toBe(500);
    expect(result?.outputTokens).toBe(150);
  });

  it("returns null for blank lines", () => {
    expect(parseLogLine("")).toBeNull();
    expect(parseLogLine("   ")).toBeNull();
  });

  it("returns null for unrecognized formats", () => {
    expect(parseLogLine("random log line with no tokens")).toBeNull();
    expect(parseLogLine("{invalid json}")).toBeNull();
  });

  it("returns null for JSON missing required fields", () => {
    expect(parseLogLine(JSON.stringify({ model: "gpt-4o" }))).toBeNull();
    expect(parseLogLine(JSON.stringify({ input_tokens: 100, output_tokens: 50 }))).toBeNull();
  });
});

// ─── fetchLatestPricing ───────────────────────────────────────────────────────

import { fetchLatestPricing } from "../src/pricing";

describe("fetchLatestPricing", () => {
  it("handles network errors gracefully (no throw)", async () => {
    // Override global fetch to simulate failure
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("Network error");
    };

    const cap = captureConsole();
    try {
      await expect(fetchLatestPricing(false)).resolves.toBeUndefined();
    } finally {
      cap.restore();
      globalThis.fetch = origFetch;
    }

    expect(cap.errors.join("")).toContain("Could not fetch latest pricing");
  });

  it("handles non-200 HTTP responses gracefully", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      ({ ok: false, status: 404, text: async () => "" } as unknown as Response);

    const cap = captureConsole();
    try {
      await expect(fetchLatestPricing(false)).resolves.toBeUndefined();
    } finally {
      cap.restore();
      globalThis.fetch = origFetch;
    }

    expect(cap.errors.join("")).toContain("Could not fetch latest pricing");
  });

  it("handles invalid JSON response gracefully", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      ({ ok: true, status: 200, text: async () => "not-json" } as unknown as Response);

    const cap = captureConsole();
    try {
      await expect(fetchLatestPricing(false)).resolves.toBeUndefined();
    } finally {
      cap.restore();
      globalThis.fetch = origFetch;
    }

    expect(cap.errors.join("")).toContain("Could not fetch latest pricing");
  });

  it("handles missing models array gracefully", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ version: "1.0", updated: "2026-01-01" }),
      } as unknown as Response);

    const cap = captureConsole();
    try {
      await expect(fetchLatestPricing(false)).resolves.toBeUndefined();
    } finally {
      cap.restore();
      globalThis.fetch = origFetch;
    }

    expect(cap.errors.join("")).toContain("Could not fetch latest pricing");
  });
});
