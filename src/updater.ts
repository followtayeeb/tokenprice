/**
 * Auto-update system for pricing data.
 * Checks for stale pricing on every CLI run and fetches updates in the background.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import chalk from "chalk";
import type { PricingDatabase } from "./pricing.js";

export interface PriceChange {
  modelId: string;
  modelName: string;
  provider: string;
  field: "inputPrice" | "outputPrice";
  oldValue: number;
  newValue: number;
}

export interface HistoryEntry {
  date: string;
  changes: PriceChange[];
  newModels: string[];
  removedModels: string[];
}

interface CachedPricing extends PricingDatabase {
  lastChecked: string;
}

const CACHE_DIR = join(homedir(), ".tokenprice");
const CACHE_FILE = join(CACHE_DIR, "pricing.json");
export const HISTORY_FILE = join(CACHE_DIR, "pricing-history.json");

const PRICING_URL =
  "https://raw.githubusercontent.com/followtayeeb/tokenprice/main/data/pricing.json";

const STALE_DAYS = 7;
const FETCH_TIMEOUT_MS = 5000;

async function ensureCacheDir(): Promise<void> {
  if (!existsSync(CACHE_DIR)) {
    await mkdir(CACHE_DIR, { recursive: true });
  }
}

async function getLastChecked(): Promise<Date | null> {
  try {
    const data = await readFile(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(data) as Partial<CachedPricing>;
    if (parsed.lastChecked) return new Date(parsed.lastChecked);
  } catch {
    // No cache yet
  }
  return null;
}

function isStale(lastChecked: Date | null): boolean {
  if (!lastChecked) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);
  return lastChecked < cutoff;
}

/**
 * Diff two pricing databases, returning changed prices and added/removed models.
 */
export function diffPricingData(
  oldData: PricingDatabase,
  newData: PricingDatabase
): { changes: PriceChange[]; newModels: string[]; removedModels: string[] } {
  const changes: PriceChange[] = [];
  const newModelNames: string[] = [];
  const removedModels: string[] = [];

  const oldMap = new Map(oldData.models.map((m) => [m.id, m]));
  const newMap = new Map(newData.models.map((m) => [m.id, m]));

  for (const [id, newModel] of newMap) {
    const oldModel = oldMap.get(id);
    if (!oldModel) {
      newModelNames.push(newModel.name);
    } else {
      if (oldModel.inputPrice !== newModel.inputPrice) {
        changes.push({
          modelId: id,
          modelName: newModel.name,
          provider: newModel.provider,
          field: "inputPrice",
          oldValue: oldModel.inputPrice,
          newValue: newModel.inputPrice,
        });
      }
      if (oldModel.outputPrice !== newModel.outputPrice) {
        changes.push({
          modelId: id,
          modelName: newModel.name,
          provider: newModel.provider,
          field: "outputPrice",
          oldValue: oldModel.outputPrice,
          newValue: newModel.outputPrice,
        });
      }
    }
  }

  for (const [id, oldModel] of oldMap) {
    if (!newMap.has(id)) removedModels.push(oldModel.name);
  }

  return { changes, newModels: newModelNames, removedModels };
}

export async function appendHistory(entry: HistoryEntry): Promise<void> {
  await ensureCacheDir();
  let history: HistoryEntry[] = [];
  try {
    const data = await readFile(HISTORY_FILE, "utf-8");
    history = JSON.parse(data) as HistoryEntry[];
  } catch {
    // Start fresh
  }
  history.unshift(entry);
  await writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
}

function formatUpdateMessage(
  changes: PriceChange[],
  newModels: string[],
  removedModels: string[],
  useColor: boolean
): string {
  const parts: string[] = [];

  const shown = changes.slice(0, 2);
  for (const c of shown) {
    const label = c.field === "inputPrice" ? "input" : "output";
    parts.push(`${c.modelName} ${label} $${c.oldValue}→$${c.newValue}`);
  }
  if (changes.length > 2) parts.push(`+${changes.length - 2} more price changes`);
  if (newModels.length > 0)
    parts.push(`+${newModels.length} new model${newModels.length > 1 ? "s" : ""}`);
  if (removedModels.length > 0)
    parts.push(`-${removedModels.length} removed`);

  const detail = parts.join(", ");
  const msg = `\u21BB Pricing updated: ${detail}. Run tokenprice changelog to see details.`;
  return useColor ? chalk.dim(chalk.gray(msg)) : msg;
}

/**
 * Check if pricing is stale and fetch updates in the background.
 * Returns a message to display after the main table output, or null if no changes.
 * A 5-second timeout prevents network issues from blocking the process.
 */
export async function checkForUpdates(
  currentData: PricingDatabase,
  noUpdate: boolean,
  useColor: boolean
): Promise<string | null> {
  if (noUpdate) return null;

  const doCheck = async (): Promise<string | null> => {
    try {
      await ensureCacheDir();
      const lastChecked = await getLastChecked();
      if (!isStale(lastChecked)) return null;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(PRICING_URL, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) return null;

      const text = await response.text();
      let newData: PricingDatabase;
      try {
        newData = JSON.parse(text) as PricingDatabase;
      } catch {
        return null;
      }

      if (!Array.isArray(newData.models)) return null;

      // Update the local cache with a new lastChecked timestamp
      const cached: CachedPricing = {
        ...newData,
        lastChecked: new Date().toISOString(),
      };
      await writeFile(CACHE_FILE, JSON.stringify(cached, null, 2), "utf-8");

      const { changes, newModels, removedModels } = diffPricingData(currentData, newData);

      if (changes.length === 0 && newModels.length === 0 && removedModels.length === 0) {
        return null;
      }

      await appendHistory({
        date: new Date().toISOString(),
        changes,
        newModels,
        removedModels,
      });

      return formatUpdateMessage(changes, newModels, removedModels, useColor);
    } catch {
      return null;
    }
  };

  return doCheck();
}
