# Contributing to tokenprice

Thank you for your interest in contributing to tokenprice! We welcome all contributions, from bug reports to new features. This guide will help you get started.

## Code of Conduct

Be respectful, inclusive, and kind. We're all here to learn and build something great together.

## How to Contribute

### 1. Reporting Bugs

Found a bug? Please open a GitHub issue with:

- Clear description of the problem
- Steps to reproduce
- Expected vs. actual behavior
- Your environment (Node version, OS)
- Screenshots if applicable

### 2. Suggesting Features

Have an idea? Open a GitHub issue with:

- Clear description of the feature
- Why you think it's valuable
- Example usage (if applicable)
- Any alternative approaches

### 3. Adding New Models

The easiest way to contribute! To add a new LLM model:

**Edit `data/pricing.json`:**

```json
{
  "id": "model-id-unique",
  "name": "Model Display Name",
  "provider": "Provider Name",
  "inputPrice": 1.50,
  "outputPrice": 6.00,
  "contextWindow": 128000,
  "supportsBatch": true,
  "description": "Brief description of the model",
  "releaseDate": "YYYY-MM-DD"
}
```

**Notes:**
- `id`: Unique identifier, use provider's official ID
- `inputPrice` / `outputPrice`: USD per million tokens
- `contextWindow`: Maximum tokens supported
- `supportsBatch`: Whether batch API is available
- Prices should be from official provider documentation

**Submit a PR** with your changes.

### 4. Submitting Code Changes

1. **Fork the repo** and create a new branch:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Make your changes:**
   - Follow the existing code style
   - Add JSDoc comments to new functions
   - Use TypeScript strict mode
   - No `any` types

4. **Test your changes:**
   ```bash
   npm run test
   npm run lint
   npm run format
   ```

5. **Commit with clear messages:**
   ```bash
   git commit -m "feat: add support for new model"
   # or
   git commit -m "fix: correct token counting issue"
   ```

6. **Push and open a PR:**
   ```bash
   git push origin feature/my-feature
   ```

## Development Setup

```bash
# Clone the repo
git clone https://github.com/followtayeeb/tokenprice.git
cd tokenprice

# Install dependencies
npm install

# Start watch mode
npm run dev

# In another terminal, test commands
node dist/index.js --help
node dist/index.js "test prompt" --compare
```

## Project Structure

```
src/
├── index.ts       # Main CLI entry point
├── pricing.ts     # Model pricing data and utilities
├── tokenizer.ts   # Token counting logic
├── formatter.ts   # Terminal output formatting
├── estimator.ts   # Output token estimation (Phase 2)
├── batch.ts       # Batch processing (Phase 2)
├── budget.ts      # Budget calculation (Phase 2)
├── watch.ts       # Log file watching (Phase 2)
├── guard.ts       # CI/CD guard (Phase 2)
└── mcp.ts         # MCP server (Phase 3)

data/
└── pricing.json   # LLM pricing database

test/
└── (unit and integration tests)
```

## Code Style

- **TypeScript:** Strict mode (`strict: true`)
- **Formatting:** Prettier (run `npm run format`)
- **Linting:** ESLint (run `npm run lint`)
- **Naming:** camelCase for variables/functions, PascalCase for types/interfaces
- **Comments:** JSDoc for public functions

Example:

```typescript
/**
 * Calculate the total cost for a model
 *
 * @param {ModelPricing} model - The model to calculate for
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @returns {number} Total cost in USD
 */
export function calculateTotalCost(
  model: ModelPricing,
  inputTokens: number,
  outputTokens: number
): number {
  return (inputTokens * model.inputPrice + outputTokens * model.outputPrice) / 1000000;
}
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm run test:coverage
```

Tests should cover:
- Happy paths
- Edge cases
- Error conditions
- Type safety

Example test:

```typescript
import { calculateCost } from "../src/pricing";

describe("calculateCost", () => {
  it("calculates cost correctly", () => {
    const model = { /* ... */ };
    const cost = calculateCost(model, 100, 50);
    expect(cost.total).toBeGreaterThan(0);
  });
});
```

## Commit Message Format

Please use conventional commits:

```
feat: add new feature
fix: resolve bug
docs: update documentation
style: format code
refactor: restructure code
test: add or update tests
chore: update dependencies
```

Example:

```
feat: add Gemini 2.0 Pro pricing

- Add model data to pricing.json
- Test cost calculations
- Update model list in README
```

## PR Review Process

1. **Automated Checks:** All PRs must pass:
   - ESLint
   - Tests
   - TypeScript compilation

2. **Code Review:** At least one maintainer will review

3. **Approval:** Once approved, merge to main

## Release Process

(For maintainers only)

```bash
# Bump version
npm version patch|minor|major

# Build
npm run build

# Publish (automatically pushes tags)
npm publish
```

## Questions?

Open an issue or reach out on GitHub. We're here to help!

## License

By contributing, you agree your code will be licensed under MIT.

---

Thanks for making tokenprice better!

