/**
 * Pricing changelog command.
 * Displays a reverse-chronological table of all pricing changes.
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import Table from "cli-table3";
import chalk from "chalk";
import type { HistoryEntry } from "./updater.js";

export { HistoryEntry };

const HISTORY_FILE = join(homedir(), ".llm-costs", "pricing-history.json");

export interface ChangelogOptions {
  since?: string;
  useColor: boolean;
}

/**
 * Parse a duration string like "30d" or "7d" into a cutoff Date.
 */
function parseSince(since: string): Date {
  const match = since.match(/^(\d+)d$/);
  if (!match) {
    throw new Error(
      `Invalid --since format: "${since}". Use a number followed by "d", e.g. "30d".`
    );
  }
  const days = parseInt(match[1], 10);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

/**
 * Display pricing changelog from ~/.llm-costs/pricing-history.json.
 */
export async function runChangelog(options: ChangelogOptions): Promise<void> {
  const { since, useColor } = options;

  let history: HistoryEntry[] = [];
  try {
    const data = await readFile(HISTORY_FILE, "utf-8");
    history = JSON.parse(data) as HistoryEntry[];
  } catch {
    const msg =
      "No pricing history found. History is recorded automatically when prices change.";
    console.log(useColor ? chalk.gray(msg) : msg);
    return;
  }

  if (since) {
    const cutoff = parseSince(since);
    history = history.filter((e) => new Date(e.date) >= cutoff);
  }

  if (history.length === 0) {
    const msg = `No pricing changes found${since ? ` in the last ${since}` : ""}.`;
    console.log(useColor ? chalk.gray(msg) : msg);
    return;
  }

  const bold = useColor ? (s: string) => chalk.bold(s) : (s: string) => s;
  const cyan = useColor ? (s: string) => chalk.cyan(s) : (s: string) => s;
  const green = useColor ? (s: string) => chalk.green(s) : (s: string) => s;
  const red = useColor ? (s: string) => chalk.red(s) : (s: string) => s;
  const gray = useColor ? (s: string) => chalk.gray(s) : (s: string) => s;

  console.log("");
  console.log(bold(cyan("Pricing Changelog")));
  console.log(
    gray(
      `${history.length} update${history.length > 1 ? "s" : ""}${since ? ` in the last ${since}` : ""}`
    )
  );
  console.log("");

  for (const entry of history) {
    const date = new Date(entry.date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    console.log(bold(`\uD83D\uDCC5 ${date}`));

    if (entry.changes.length > 0) {
      const table = new Table({
        head: [
          bold("Model"),
          bold("Provider"),
          bold("Field"),
          bold("Old"),
          bold("New"),
          bold("Change"),
        ],
        style: { head: [], border: useColor ? ["gray"] : [] },
      });

      for (const c of entry.changes) {
        const pct = ((c.newValue - c.oldValue) / c.oldValue) * 100;
        const pctStr = pct > 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
        const pctFormatted = useColor
          ? pct > 0
            ? red(pctStr)
            : green(pctStr)
          : pctStr;
        const fieldLabel = c.field === "inputPrice" ? "Input" : "Output";
        table.push([
          c.modelName,
          c.provider,
          fieldLabel,
          `$${c.oldValue}/M`,
          `$${c.newValue}/M`,
          pctFormatted,
        ]);
      }
      console.log(table.toString());
    }

    if (entry.newModels.length > 0) {
      console.log(green(`  + New: ${entry.newModels.join(", ")}`));
    }
    if (entry.removedModels.length > 0) {
      console.log(red(`  - Removed: ${entry.removedModels.join(", ")}`));
    }
    console.log("");
  }
}
