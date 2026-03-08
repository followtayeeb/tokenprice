/**
 * Tests for src/changelog.ts
 */

import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import type { HistoryEntry } from "../src/updater.js";

// We mock fs/promises so we don't touch the real filesystem
const mockReadFile = jest.fn<() => Promise<string>>();

jest.unstable_mockModule("fs/promises", () => ({
  readFile: mockReadFile,
  writeFile: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  mkdir: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

function makeHistoryEntry(overrides?: Partial<HistoryEntry>): HistoryEntry {
  return {
    date: "2026-03-01T10:00:00Z",
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
    newModels: [],
    removedModels: [],
    ...overrides,
  };
}

describe("runChangelog", () => {
  let consoleSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    mockReadFile.mockReset();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    jest.resetModules();
  });

  it("prints a 'no history' message when file is missing", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    const { runChangelog } = await import("../src/changelog.js");
    await runChangelog({ useColor: false });
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No pricing history found");
  });

  it("prints 'no changes' when history is empty array", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify([]));
    const { runChangelog } = await import("../src/changelog.js");
    await runChangelog({ useColor: false });
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No pricing changes found");
  });

  it("renders a table when history has entries", async () => {
    const history: HistoryEntry[] = [makeHistoryEntry()];
    mockReadFile.mockResolvedValue(JSON.stringify(history));
    const { runChangelog } = await import("../src/changelog.js");
    await runChangelog({ useColor: false });
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("GPT-4o");
    expect(output).toContain("OpenAI");
    expect(output).toContain("$2.5/M");
    expect(output).toContain("$2/M");
  });

  it("filters by --since 30d", async () => {
    const recent = makeHistoryEntry({ date: new Date().toISOString() });
    const old = makeHistoryEntry({
      date: new Date("2020-01-01").toISOString(),
      changes: [
        {
          modelId: "old-model",
          modelName: "Old Model",
          provider: "OldCo",
          field: "outputPrice",
          oldValue: 10,
          newValue: 8,
        },
      ],
    });
    mockReadFile.mockResolvedValue(JSON.stringify([recent, old]));
    const { runChangelog } = await import("../src/changelog.js");
    await runChangelog({ since: "30d", useColor: false });
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("GPT-4o");
    expect(output).not.toContain("Old Model");
  });

  it("shows new and removed model names", async () => {
    const history: HistoryEntry[] = [
      makeHistoryEntry({
        changes: [],
        newModels: ["Shiny Model"],
        removedModels: ["Dusty Model"],
      }),
    ];
    mockReadFile.mockResolvedValue(JSON.stringify(history));
    const { runChangelog } = await import("../src/changelog.js");
    await runChangelog({ useColor: false });
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Shiny Model");
    expect(output).toContain("Dusty Model");
  });

  it("throws on invalid --since format", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify([makeHistoryEntry()]));
    const { runChangelog } = await import("../src/changelog.js");
    await expect(runChangelog({ since: "invalid", useColor: false })).rejects.toThrow(
      'Invalid --since format'
    );
  });

  it("shows 'no changes in last Xd' when --since filters everything out", async () => {
    // Put one entry from 100 days ago, then filter to 7d
    const old = makeHistoryEntry({
      date: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
    });
    mockReadFile.mockResolvedValue(JSON.stringify([old]));
    const { runChangelog } = await import("../src/changelog.js");
    await runChangelog({ since: "7d", useColor: false });
    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("No pricing changes found in the last 7d");
  });
});
