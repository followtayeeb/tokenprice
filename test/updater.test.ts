/**
 * Tests for src/updater.ts
 */

import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import type { PricingDatabase } from "../src/pricing.js";
import type { HistoryEntry } from "../src/updater.js";

// --- Helpers ----------------------------------------------------------------

function makePricingDb(overrides?: Partial<PricingDatabase>): PricingDatabase {
  return {
    version: "1.0.0",
    updated: "2026-01-01T00:00:00Z",
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        provider: "OpenAI",
        inputPrice: 2.5,
        outputPrice: 10.0,
        contextWindow: 128000,
        supportsBatch: true,
        description: "Test model",
        releaseDate: "2024-05-13",
      },
      {
        id: "claude-sonnet-4-5-20250514",
        name: "Claude Sonnet 4.5",
        provider: "Anthropic",
        inputPrice: 3.0,
        outputPrice: 15.0,
        contextWindow: 200000,
        supportsBatch: true,
        description: "Test model",
        releaseDate: "2025-05-14",
      },
    ],
    ...overrides,
  };
}

// --- diffPricingData --------------------------------------------------------

describe("diffPricingData", () => {
  it("returns empty diff when no changes", async () => {
    const { diffPricingData } = await import("../src/updater.js");
    const db = makePricingDb();
    const result = diffPricingData(db, db);
    expect(result.changes).toHaveLength(0);
    expect(result.newModels).toHaveLength(0);
    expect(result.removedModels).toHaveLength(0);
  });

  it("detects input price change", async () => {
    const { diffPricingData } = await import("../src/updater.js");
    const oldDb = makePricingDb();
    const newDb = makePricingDb({
      models: oldDb.models.map((m) =>
        m.id === "gpt-4o" ? { ...m, inputPrice: 2.0 } : m
      ),
    });
    const result = diffPricingData(oldDb, newDb);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({
      modelId: "gpt-4o",
      field: "inputPrice",
      oldValue: 2.5,
      newValue: 2.0,
    });
    expect(result.newModels).toHaveLength(0);
    expect(result.removedModels).toHaveLength(0);
  });

  it("detects output price change", async () => {
    const { diffPricingData } = await import("../src/updater.js");
    const oldDb = makePricingDb();
    const newDb = makePricingDb({
      models: oldDb.models.map((m) =>
        m.id === "claude-sonnet-4-5-20250514" ? { ...m, outputPrice: 12.0 } : m
      ),
    });
    const result = diffPricingData(oldDb, newDb);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({
      field: "outputPrice",
      oldValue: 15.0,
      newValue: 12.0,
    });
  });

  it("detects both input and output changes on same model", async () => {
    const { diffPricingData } = await import("../src/updater.js");
    const oldDb = makePricingDb();
    const newDb = makePricingDb({
      models: oldDb.models.map((m) =>
        m.id === "gpt-4o" ? { ...m, inputPrice: 1.5, outputPrice: 8.0 } : m
      ),
    });
    const result = diffPricingData(oldDb, newDb);
    expect(result.changes).toHaveLength(2);
    const fields = result.changes.map((c) => c.field);
    expect(fields).toContain("inputPrice");
    expect(fields).toContain("outputPrice");
  });

  it("detects new model", async () => {
    const { diffPricingData } = await import("../src/updater.js");
    const oldDb = makePricingDb();
    const newDb = makePricingDb({
      models: [
        ...oldDb.models,
        {
          id: "new-model-xyz",
          name: "New Model XYZ",
          provider: "NewCo",
          inputPrice: 1.0,
          outputPrice: 4.0,
          contextWindow: 64000,
          supportsBatch: false,
          description: "Brand new",
          releaseDate: "2026-01-01",
        },
      ],
    });
    const result = diffPricingData(oldDb, newDb);
    expect(result.newModels).toContain("New Model XYZ");
    expect(result.changes).toHaveLength(0);
    expect(result.removedModels).toHaveLength(0);
  });

  it("detects removed model", async () => {
    const { diffPricingData } = await import("../src/updater.js");
    const oldDb = makePricingDb();
    const newDb = makePricingDb({
      models: oldDb.models.filter((m) => m.id !== "gpt-4o"),
    });
    const result = diffPricingData(oldDb, newDb);
    expect(result.removedModels).toContain("GPT-4o");
    expect(result.changes).toHaveLength(0);
    expect(result.newModels).toHaveLength(0);
  });

  it("handles multiple simultaneous changes", async () => {
    const { diffPricingData } = await import("../src/updater.js");
    const oldDb = makePricingDb();
    const newDb: PricingDatabase = {
      ...oldDb,
      models: [
        { ...oldDb.models[0], inputPrice: 1.0 }, // price change
        // claude-sonnet removed
        {
          // new model added
          id: "brand-new",
          name: "Brand New",
          provider: "TestCo",
          inputPrice: 0.5,
          outputPrice: 1.0,
          contextWindow: 32000,
          supportsBatch: false,
          description: "Test",
          releaseDate: "2026-01-01",
        },
      ],
    };
    const result = diffPricingData(oldDb, newDb);
    expect(result.changes).toHaveLength(1);
    expect(result.newModels).toContain("Brand New");
    expect(result.removedModels).toContain("Claude Sonnet 4.5");
  });
});

// --- checkForUpdates --------------------------------------------------------

describe("checkForUpdates", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.resetModules();
  });

  it("returns null when noUpdate is true", async () => {
    const { checkForUpdates } = await import("../src/updater.js");
    const db = makePricingDb();
    const result = await checkForUpdates(db, true, false);
    expect(result).toBeNull();
  });

  it("returns null when fetch fails", async () => {
    jest.resetModules();
    globalThis.fetch = jest.fn<typeof fetch>().mockRejectedValue(
      new Error("Network error")
    );
    const { checkForUpdates } = await import("../src/updater.js");
    const db = makePricingDb();
    const result = await checkForUpdates(db, false, false);
    expect(result).toBeNull();
  });

  it("returns null when fetch returns non-ok response", async () => {
    jest.resetModules();
    globalThis.fetch = jest.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);
    const { checkForUpdates } = await import("../src/updater.js");
    const db = makePricingDb();
    const result = await checkForUpdates(db, false, false);
    expect(result).toBeNull();
  });
});

// --- appendHistory ----------------------------------------------------------

describe("appendHistory", () => {
  it("exports HISTORY_FILE path", async () => {
    const { HISTORY_FILE } = await import("../src/updater.js");
    expect(typeof HISTORY_FILE).toBe("string");
    expect(HISTORY_FILE).toContain(".llm-costs");
    expect(HISTORY_FILE).toContain("pricing-history.json");
  });

  it("history entry shape is correct", () => {
    const entry: HistoryEntry = {
      date: new Date().toISOString(),
      changes: [
        {
          modelId: "gpt-4o",
          modelName: "GPT-4o",
          provider: "OpenAI",
          field: "inputPrice",
          oldValue: 2.5,
          newValue: 2.0,
        },
      ],
      newModels: ["New Model"],
      removedModels: [],
    };
    expect(entry.changes[0].field).toBe("inputPrice");
    expect(entry.newModels).toHaveLength(1);
  });
});
