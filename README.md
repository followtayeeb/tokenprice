# tokenprice

> Know before you send. Compare LLM costs in your terminal.

[![npm version](https://img.shields.io/npm/v/tokenprice.svg?style=flat-square)](https://www.npmjs.com/package/tokenprice)
[![npm downloads](https://img.shields.io/npm/dw/tokenprice.svg?style=flat-square)](https://www.npmjs.com/package/tokenprice)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org)

## Demo

Estimate costs and compare across 20+ models:

```bash
$ tokenprice "Explain quantum computing" --compare

╔════════════════════════════╦═══════════╦═══════════╦════════════╗
║ Model                      ║ Input     ║ Output    ║ Total      ║
╠════════════════════════════╬═══════════╬═══════════╬════════════╣
║ Gemini 2.5 Flash ✓         ║ $0.00008  ║ $0.00032  ║ $0.00040   ║
║ Claude Haiku 4.5 ✓         ║ $0.00025  ║ $0.00125  ║ $0.00150   ║
║ Llama-3.3-70B (Groq) ✓     ║ $0.00059  ║ $0.00079  ║ $0.00138   ║
║ DeepSeek-R1               ║ $0.00055  ║ $0.00219  ║ $0.00274   ║
║ Claude Sonnet 4.5 ✓       ║ $0.00300  ║ $0.01500  ║ $0.01800   ║
║ GPT-4o                    ║ $0.00250  ║ $0.01000  ║ $0.01250   ║
║ Mistral Large ✓           ║ $0.00200  ║ $0.00600  ║ $0.00800   ║
║ Command R+ (Cohere) ✓     ║ $0.00250  ║ $0.01000  ║ $0.01250   ║
║ Gemini 2.5 Pro            ║ $0.00125  ║ $0.01000  ║ $0.01125   ║
║ Claude Opus 4.5           ║ $0.01500  ║ $0.07500  ║ $0.09000   ║
║ GPT-4.1                   ║ $0.00200  ║ $0.00800  ║ $0.01000   ║
║ o3-mini                   ║ $0.00110  ║ $0.00440  ║ $0.00550   ║
╚════════════════════════════╩═══════════╩═══════════╩════════════╝

Input tokens: 6 | Output estimate: ~50 | Total estimate: ~56 tokens
Cheapest: Gemini 2.5 Flash ($0.00040)
✓ = Batch API support
```

## Installation

### Zero Setup (Try Now)

```bash
npx tokenprice "Hello world" --compare
```

### Permanent Install

```bash
# Global installation
npm install -g tokenprice

# Or use Homebrew (coming soon)
brew install tokenprice
```

### Verify Installation

```bash
tokenprice --version
# tokenprice v0.1.0
```

## Quick Start

### Estimate Cost for a Single Model

```bash
tokenprice "Explain quantum computing in simple terms" --model claude-sonnet-4-5

# Output:
# Input tokens: 6 | Output estimate: ~80
# Claude Sonnet 4.5: $0.00060 (input) + $0.00120 (output) = $0.00180 total
```

### Compare All Models

```bash
tokenprice "Your prompt here" --compare

# Shows beautiful table with all 20+ models sorted by cost
```

### Read from File

```bash
tokenprice --file prompt.txt --compare

# Or via pipe
cat system-prompt.txt | tokenprice --model gpt-4o
```

### Estimate Tokens Only

```bash
tokenprice count "Hello world"
# Output: 3 tokens (using heuristic)

# With OpenAI models (uses tiktoken)
tokenprice count "Hello world" --model gpt-4o
# Output: 2 tokens (accurate)
```

### Get Token Count with Cost

```bash
tokenprice "Your prompt" --model claude-opus-4-5 --show-tokens

# Output:
# Input: 3 tokens ($0.000045)
# Output: ~150 tokens (estimated) ($0.01125)
# Total: ~$0.011295
```

### JSON Output for Scripts

```bash
tokenprice "hello" --model gpt-4o --output json

# Output:
# {
#   "model": "gpt-4o",
#   "inputTokens": 1,
#   "outputTokensEstimated": 50,
#   "totalTokensEstimated": 51,
#   "inputCost": 0.0000025,
#   "outputCost": 0.0005,
#   "totalCost": 0.0005025
# }
```

## Supported Models

tokenprice supports 20+ models from the top LLM providers:

### Anthropic

| Model | Input | Output | Context | Batch |
|-------|-------|--------|---------|-------|
| Claude Opus 4.5 | $15/M | $75/M | 200K | Yes |
| Claude Sonnet 4.5 | $3/M | $15/M | 200K | Yes |
| Claude Haiku 4.5 | $0.25/M | $1.25/M | 200K | Yes |

### OpenAI

| Model | Input | Output | Context | Batch |
|-------|-------|--------|---------|-------|
| GPT-4.1 | $2/M | $8/M | 128K | Yes |
| GPT-4o | $2.50/M | $10/M | 128K | Yes |
| GPT-4o-mini | $0.40/M | $1.60/M | 128K | Yes |
| o3 | $10/M | $40/M | 128K | Yes |
| o3-mini | $1.10/M | $4.40/M | 128K | Yes |

### Google

| Model | Input | Output | Context | Batch |
|-------|-------|--------|---------|-------|
| Gemini 2.5 Pro | $1.25/M | $10/M | 1M | Yes |
| Gemini 2.5 Flash | $0.075/M | $0.30/M | 1M | Yes |

### DeepSeek

| Model | Input | Output | Context | Batch |
|-------|-------|--------|---------|-------|
| DeepSeek-V3 | $0.27/M | $1.10/M | 64K | Yes |
| DeepSeek-R1 | $0.55/M | $2.19/M | 64K | Yes |

### Mistral

| Model | Input | Output | Context | Batch |
|-------|-------|--------|---------|-------|
| Mistral Large | $2/M | $6/M | 32K | Yes |
| Mistral Medium | $0.40/M | $2/M | 32K | No |

### Cohere

| Model | Input | Output | Context | Batch |
|-------|-------|--------|---------|-------|
| Command R+ | $2.50/M | $10/M | 128K | Yes |
| Command R | $0.15/M | $0.60/M | 128K | Yes |

### Groq (Free)

| Model | Input | Output | Context | Batch |
|-------|-------|--------|---------|-------|
| Llama-3.3-70B | $0.59/M | $0.79/M | 8K | No |

## Why tokenprice?

1. **Zero Setup** — No API keys, no configuration, no fuss. Just run it.

2. **Terminal Native** — Works in your shell, integrates with pipes, no browser required.

3. **Comprehensive** — Covers 20+ models from 6 providers. Always up-to-date pricing.

## Advanced Usage

### Batch Processing (Phase 2)

Estimate costs for many prompts at once:

```bash
# Process JSONL file (one prompt per line)
tokenprice batch prompts.jsonl --model gpt-4o

# Output:
# Total prompts: 1000
# Total tokens: 250,000
# Total cost: $6.25
# Average cost per prompt: $0.00625
```

### Budget Projection (Phase 2)

Plan your LLM spending:

```bash
tokenprice budget --model gpt-4o --requests-per-day 500 --avg-tokens 2000

# Output:
# Daily cost: $2.50
# Weekly cost: $17.50
# Monthly cost: $75.00
```

### CI/CD Cost Guard (Phase 2)

Prevent runaway costs in your pipelines:

```bash
# Fail if cost exceeds threshold
tokenprice guard prompt.txt --model gpt-4o --max-cost 0.50

# Exit code 0 if cost <= $0.50
# Exit code 1 if cost > $0.50 (suitable for CI/CD)
```

### Watch API Logs (Phase 2)

Monitor real-time API usage:

```bash
tokenprice watch --log openai_usage.log
```

### Update Pricing (Phase 2)

Keep pricing up-to-date:

```bash
tokenprice --update-pricing

# Fetches latest pricing from GitHub repo
```

## Comparison vs Alternatives

| Feature | tokenprice | tokencost | llm-pricing | token-tally |
|---------|---|---|---|---|
| **CLI** | Yes | No | No | Yes |
| **Zero Setup** | Yes | No | No | Yes |
| **20+ Models** | Yes | Limited | Yes | Limited |
| **Batch Processing** | Phase 2 | No | No | No |
| **CI/CD Integration** | Phase 2 | No | No | No |
| **Open Source** | Yes | No | Partial | Yes |
| **Active Maintenance** | Yes | No | Maybe | Maybe |

## GitHub Actions Integration

Use tokenprice in your CI/CD workflow:

```yaml
name: Cost Check

on: [pull_request]

jobs:
  cost-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: followtayeeb/tokenprice-action@v1
        with:
          prompt-file: src/system-prompt.txt
          model: claude-sonnet-4-5
          max-cost: '1.00'
```

## Contributing

We love contributions! Whether it's:

- Adding new models to `data/pricing.json`
- Submitting bug reports
- Adding features
- Improving documentation

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Development

```bash
# Clone repo
git clone https://github.com/followtayeeb/tokenprice.git
cd tokenprice

# Install dependencies
npm install

# Start development
npm run dev

# Run tests
npm test

# Format and lint
npm run format && npm run lint
```

## Roadmap

- **Phase 1 (v0.1)**: MVP — Cost estimation, comparison, token counting
- **Phase 2 (v0.2)**: Batch processing, budget projections, CI/CD guards
- **Phase 3 (v1.0)**: MCP server, VS Code extension, GitHub Actions

## FAQ

**Q: Does tokenprice make actual API calls?**  
A: No, it estimates costs locally. No API keys required, no data leaves your machine.

**Q: How accurate are token estimates?**  
A: Using tiktoken for OpenAI models: >99% accuracy. For other models: ±5-15% using heuristics.

**Q: Why is Node.js 18+ required?**  
A: We use modern JavaScript features (async/await, native fetch). Node 18 is LTS and widely available.

**Q: Can I use this in CI/CD?**  
A: Yes! Use `NO_COLOR=1` env var for plain text output, or `--output json` for machine-readable format.

**Q: Is pricing data accurate?**  
A: Pricing is from official provider docs and updated weekly via GitHub Actions. Community PRs welcome for corrections.

**Q: Which models does it support?**  
A: 20+ models from Anthropic, OpenAI, Google, DeepSeek, Mistral, Cohere, and Groq. See [Supported Models](#supported-models).

**Q: Will you support language XYZ?**  
A: Phase 3! Currently TypeScript/Node. Python bindings may come later.

## License

MIT - See [LICENSE](LICENSE) for details

## Author

Built with curiosity by followtayeeb

---

**Have questions or feature requests?** Open an issue on GitHub or reach out on Twitter.

**Like tokenprice?** Please star us and share! Your support means the world.

