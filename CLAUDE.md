# llm-costs — Claude Code Project Guide

## Project Overview

**Name:** llm-costs  
**Tagline:** "Know before you send. Compare LLM costs in your terminal."  
**Language:** TypeScript (Node.js 18+)  
**Distribution:** npm (`npm install -g llm-costs`) + npx (`npx llm-costs`)  
**License:** MIT  

llm-costs is a universal LLM cost CLI tool that helps developers estimate, compare, and track the costs of using different Large Language Models (LLMs) before sending requests. It's written in TypeScript, runs in the terminal, and requires zero configuration.

## Architecture

```
llm-costs/
├── src/
│   ├── index.ts          # CLI entry point (commander.js)
│   ├── tokenizer.ts      # Token counting (tiktoken + fallbacks)
│   ├── pricing.ts        # Pricing data loader + auto-updater
│   ├── estimator.ts      # Output token estimation logic
│   ├── formatter.ts      # Beautiful table output (cli-table3 + chalk)
│   ├── compare.ts        # Multi-model comparison engine
│   ├── batch.ts          # Batch processing from JSONL/CSV
│   ├── budget.ts         # Budget projection calculator
│   ├── watch.ts          # Log file watcher
│   ├── guard.ts          # CI/CD budget guard
│   └── mcp.ts            # MCP server mode
├── data/
│   └── pricing.json      # Community-maintained pricing database
├── test/
│   └── (Jest test files)
├── README.md
├── CONTRIBUTING.md
├── LICENSE
├── package.json
├── tsconfig.json
└── .github/
    └── workflows/
        ├── ci.yml
        └── update-pricing.yml
```

## Build & Development Commands

```bash
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode for development
npm test             # Run Jest test suite
npm run lint         # Run ESLint checks
npm run format       # Format code with Prettier
npm run release      # Bump version + publish to npm
```

## Coding Standards

- **TypeScript:** Strict mode enabled (`strict: true`)
- **Linting:** ESLint with recommended rules + Prettier
- **Testing:** Jest with >80% code coverage target
- **Documentation:** All public functions must have JSDoc comments
- **Type Safety:** No `any` types allowed
- **Async:** Prefer `async/await` over promises
- **Error Handling:** Always surface user-friendly error messages
- **Performance:** CLI startup time < 200ms

## Feature Phases

### Phase 1 (MVP) — Cost Estimation & Comparison
- Single-model cost estimation
- Multi-model comparison with beautiful tables
- Token counting (OpenAI + Anthropic)
- Output token estimation (based on model patterns)
- Supports ~20 models from top 6 providers
- Interactive CLI with `--compare` flag
- Pipe-friendly (reads from stdin)

**Target:** Launch on Product Hunt & HN

### Phase 2 — Advanced Features
- Batch processing (JSONL/CSV input)
- Budget projections (requests/day → monthly cost)
- Log file watcher for real API usage tracking
- CI/CD budget guard (fail builds if cost > threshold)
- JSON/CSV output formats
- Pricing auto-update from GitHub

**Target:** 500+ npm weekly downloads

### Phase 3 — Ecosystem
- MCP (Model Context Protocol) server mode
- VS Code extension (pricing in editor decorators)
- GitHub Action for cost checks
- Interactive mode with autocomplete
- Cost breakdown by provider

**Target:** 1000+ GitHub stars, 5000+ weekly downloads

## CLI Examples

### Phase 1 Examples
```bash
# Quick cost estimate for a single prompt
llm-costs "Explain quantum computing" --model claude-sonnet-4-5

# Compare all models
llm-costs "Your prompt here" --compare

# Read from a file
cat prompt.txt | llm-costs --model gpt-4o

# Interactive mode (Phase 3)
llm-costs -i
```

### Phase 2 Examples
```bash
# Batch processing
llm-costs batch prompts.jsonl --model claude-sonnet-4-5

# Budget projection
llm-costs budget --model gpt-4o --requests-per-day 500 --avg-tokens 2000

# CI/CD guard
llm-costs guard prompt.txt --model gpt-4o --max-cost 0.50

# Watch API usage logs
llm-costs watch --log openai_usage.log
```

### Phase 3 Examples
```bash
# MCP server mode
llm-costs --mcp

# Interactive with autocomplete
llm-costs -i
```

## Pricing Data Format

**File:** `data/pricing.json`

```json
{
  "version": "1.0.0",
  "updated": "2026-03-03",
  "models": [
    {
      "id": "claude-opus-4-5-20251101",
      "name": "Claude Opus 4.5",
      "provider": "Anthropic",
      "input": 15.00,
      "output": 75.00,
      "context_window": 200000,
      "supports_batch": true,
      "description": "Most capable model"
    },
    {
      "id": "gpt-4o",
      "name": "GPT-4o",
      "provider": "OpenAI",
      "input": 2.50,
      "output": 10.00,
      "context_window": 128000,
      "supports_batch": true,
      "description": "Multimodal reasoning"
    }
  ]
}
```

**Notes:**
- Prices are in **USD per million tokens**
- Input tokens are typically cheaper than output tokens
- Context window is in tokens
- `supports_batch` indicates batch API availability
- Updated weekly via GitHub Actions

## Important Implementation Notes

### Token Counting
- Primary: `@dqbd/tiktoken` for accurate OpenAI tokenization
- Fallback: Character-based heuristic (chars ÷ 3.5) when tiktoken unavailable
- Anthropic models use OpenAI encoding as reasonable approximation

### Table Output (CRITICAL FEATURE)
The comparison table is the key viral feature. Invest heavily:
- Use `cli-table3` with custom styling
- Add color highlighting (cheapest model in green)
- Show input cost, output cost, and total cost columns
- Sort by total cost (ascending)
- Indicate batch API support
- Add context window info

Example:
```
┌─────────────────────────┬──────────┬──────────┬────────────┐
│ Model                   │ Input    │ Output   │ Total      │
├─────────────────────────┼──────────┼──────────┼────────────┤
│ Claude Haiku 4.5 ✓      │ $0.25    │ $1.25    │ $1.50   ✓  │
│ Llama-3.3-70B          │ $0.59    │ $0.79    │ $1.38      │
│ Gemini 2.5 Flash       │ $0.075   │ $0.30    │ $0.375     │
│ Claude Sonnet 4.5 ✓    │ $3.00    │ $15.00   │ $18.00     │
│ GPT-4o                 │ $2.50    │ $10.00   │ $12.50     │
└─────────────────────────┴──────────┴──────────┴────────────┘
```

### Environment Variables & Flags
- `--no-color` flag and `NO_COLOR` env var for CI compatibility
- `--update-pricing` flag fetches latest pricing from GitHub repo
- `--output json` or `--output csv` for machine-readable output
- `--model` can be a partial match (e.g., `claude` → suggests Claude models)

### Stdin Detection
- If stdin is a TTY: prompt the user for input
- If stdin is piped: read the full input silently
- Allow both inline text and file input

## Development Workflow

1. Clone the repo
2. Run `npm install`
3. Run `npm run dev` for watch mode
4. Make changes in `src/`
5. Run `npm test` to validate
6. Run `npm run lint && npm run format` before commits

## Testing Strategy

- Unit tests for each module (tokenizer, pricing, estimator, formatter)
- Integration tests for CLI commands
- Snapshot tests for table output
- Performance benchmarks for token counting
- Target: >80% coverage

## Deployment & Release

1. Bump version in `package.json` (semver)
2. Update `CHANGELOG.md`
3. Run `npm run build`
4. Commit: `git commit -m "v1.2.3"`
5. Tag: `git tag v1.2.3`
6. Push: `git push origin main --tags`
7. `npm publish` (runs `prepublishOnly` script)
8. GitHub Actions: Automatically publishes to npm after tag push

## Marketing & Launch

**Product Hunt Launch:**
- Day 0: Submit early morning (US time)
- Tagline: "Know before you send. Compare LLM costs in your terminal. Zero setup."
- Demo with screenshots of the comparison table
- Target: Top 5 products

**HN Show HN:**
- Submit to HN: "Show HN: llm-costs — Universal LLM Cost CLI"
- Show the beautiful table output
- Target: Front page (top 10)

**Success Metrics (90 days):**
- ⭐ 100 stars in Week 1
- ⭐ 500 stars in Month 1
- ⭐ 1000 stars by Month 3
- 📥 500 npm downloads/week → 5000 by Month 3
- 📰 Mentioned in 3+ newsletters (e.g., tldr.tech, AI Engineer)

## Key Resources

- **Commander.js:** CLI framework (excellent docs)
- **@dqbd/tiktoken:** OpenAI's token counter (works on all platforms)
- **cli-table3:** Table rendering for terminals
- **chalk:** Terminal colors
- **jest:** Testing framework
- **typescript:** Language

## Open Questions / Decisions

1. Should we support Python packaging? (Consider: maybe Phase 2)
2. Should we auto-fetch pricing daily or on-demand? (Decision: daily via GH Actions)
3. Should the comparison table show all models or allow filtering? (Decision: show all, sortable)
4. Should we store usage statistics (Phase 3 only)?

---

**Last Updated:** 2026-03-03  
**Project Lead:** followtayeeb  
**Status:** Ready for development
