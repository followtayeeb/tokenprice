/**
 * Unit tests for pricing module
 */

import {
  calculateCost,
  findModel,
  getModelsFromProvider,
  getProviders,
  loadPricingData,
  sortModelsByCost,
} from "../src/pricing";

describe("Pricing Module", () => {
  const pricingData = loadPricingData();

  describe("loadPricingData", () => {
    it("should load pricing data successfully", () => {
      expect(pricingData).toBeDefined();
      expect(pricingData.models).toBeDefined();
      expect(pricingData.models.length).toBeGreaterThan(0);
    });

    it("should have required fields in each model", () => {
      pricingData.models.forEach((model) => {
        expect(model.id).toBeDefined();
        expect(model.name).toBeDefined();
        expect(model.provider).toBeDefined();
        expect(model.inputPrice).toBeGreaterThanOrEqual(0);
        expect(model.outputPrice).toBeGreaterThanOrEqual(0);
        expect(model.contextWindow).toBeGreaterThan(0);
      });
    });
  });

  describe("findModel", () => {
    it("should find model by exact ID", () => {
      const model = findModel("gpt-4o", pricingData);
      expect(model).toBeDefined();
      expect(model?.name).toContain("GPT");
    });

    it("should find model by partial name", () => {
      const model = findModel("claude", pricingData);
      expect(model).toBeDefined();
      expect(model?.provider).toBe("Anthropic");
    });

    it("should return undefined for non-existent model", () => {
      const model = findModel("nonexistent-xyz-model", pricingData);
      expect(model).toBeUndefined();
    });

    it("should be case-insensitive", () => {
      const model1 = findModel("CLAUDE", pricingData);
      const model2 = findModel("claude", pricingData);
      expect(model1?.id).toBe(model2?.id);
    });
  });

  describe("calculateCost", () => {
    it("should calculate cost correctly", () => {
      const model = findModel("gpt-4o", pricingData);
      if (!model) throw new Error("Model not found");

      const cost = calculateCost(model, 1000, 500);

      // gpt-4o: input $2.50/M, output $10/M
      const expectedInput = (1000 * 2.5) / 1000000;
      const expectedOutput = (500 * 10) / 1000000;

      expect(cost.input).toBeCloseTo(expectedInput);
      expect(cost.output).toBeCloseTo(expectedOutput);
      expect(cost.total).toBeCloseTo(expectedInput + expectedOutput);
    });

    it("should handle zero tokens", () => {
      const model = findModel("gpt-4o", pricingData);
      if (!model) throw new Error("Model not found");

      const cost = calculateCost(model, 0, 0);
      expect(cost.input).toBe(0);
      expect(cost.output).toBe(0);
      expect(cost.total).toBe(0);
    });

    it("should handle large token counts", () => {
      const model = findModel("claude-opus-4-5", pricingData);
      if (!model) throw new Error("Model not found");

      const cost = calculateCost(model, 1000000, 500000);
      expect(cost.total).toBeGreaterThan(0);
    });
  });

  describe("sortModelsByCost", () => {
    it("should sort models by total cost ascending", () => {
      const sorted = sortModelsByCost(pricingData.models, 100, 100);
      const costs = sorted.map((m) => {
        const c = calculateCost(m, 100, 100);
        return c.total;
      });

      for (let i = 0; i < costs.length - 1; i++) {
        expect(costs[i]).toBeLessThanOrEqual(costs[i + 1]);
      }
    });

    it("should not mutate original array", () => {
      const originalLength = pricingData.models.length;
      sortModelsByCost(pricingData.models, 100, 100);
      expect(pricingData.models.length).toBe(originalLength);
    });
  });

  describe("getModelsFromProvider", () => {
    it("should return models from specific provider", () => {
      const models = getModelsFromProvider("Anthropic", pricingData);
      expect(models.length).toBeGreaterThan(0);
      models.forEach((m) => {
        expect(m.provider).toBe("Anthropic");
      });
    });

    it("should be case-insensitive", () => {
      const models1 = getModelsFromProvider("Anthropic", pricingData);
      const models2 = getModelsFromProvider("anthropic", pricingData);
      expect(models1.length).toBe(models2.length);
    });
  });

  describe("getProviders", () => {
    it("should return unique provider names", () => {
      const providers = getProviders(pricingData);
      const uniqueProviders = new Set(providers);
      expect(providers.length).toBe(uniqueProviders.size);
    });

    it("should return sorted providers", () => {
      const providers = getProviders(pricingData);
      const sorted = [...providers].sort();
      expect(providers).toEqual(sorted);
    });
  });
});
