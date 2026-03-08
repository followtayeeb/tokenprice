# llm-costs — Product Requirements Document (PRD)

**Document Version:** 1.0  
**Last Updated:** 2026-03-03  
**Status:** Ready for Development  

---

## Executive Summary

**llm-costs** is a universal LLM cost estimation CLI tool that helps developers estimate, compare, and track the costs of using different Large Language Models (LLMs) directly from the terminal. Today, developers using LLM APIs must navigate multiple provider dashboards, web apps, or Python libraries to understand costs before sending requests. llm-costs changes this by making cost estimation as simple as typing a command.

**Problem:** "How much will this cost?" should take 2 seconds to answer in the terminal, not 2 minutes in a web browser.

**Solution:** A beautifully designed, zero-configuration CLI that estimates token counts, compares pricing across 20+ models from 6 providers, and integrates with CI/CD pipelines—all with a single command.

**Success Definition (90 days):**
- 100+ GitHub stars in Week 1
- 500+ GitHub stars in Month 1
- 1,000+ GitHub stars by Month 3
- 500+ npm downloads/week → 5,000+ by Month 3
- Top 3 search results for "llm cost calculator cli"
- Featured on Product Hunt front page
- Mention in 3+ AI/Dev newsletters

**Target Launch:** Product Hunt + HN Show HN simultaneously

---

## Problem Statement

### Current Pain Points

1. **No Terminal-Native Solution:** Existing tools are Python libraries (requires Python), web apps (requires browser/login), or provider dashboards (vendor lock-in).

2. **Slow Workflow:** Developers interrupt their terminal workflow to:
   - Open a web calculator
   - Log into provider dashboards
   - Copy/paste prompts into external tools
   - Wait for pages to load

3. **Provider Fragmentation:** Each LLM provider (OpenAI, Anthropic, Google, Mistral, etc.) has different pricing models, and pricing changes regularly.

4. **No CI/CD Integration:** Teams can't enforce cost budgets in their CI/CD pipelines today.

5. **Token Counting Complexity:** Different models use different tokenizers; developers need tiktoken for OpenAI but don't have standard tools for Anthropic models.

### Market Opportunity

- 500K+ active developers using LLM APIs monthly
- 10K+ AI startups building with LLMs
- Growing concern about LLM costs (especially after token economics changed)
- No dominant CLI tool in this space yet

---

## Target Users

### Primary User Persona 1: AI Application Developer
- **Who:** Full-stack developers building LLM-powered features (e.g., chatbots, content generators)
- **Need:** Quick cost estimates before API calls during development
- **Usage:** 5-10 times per day, primarily during coding sessions
- **Pain:** Constant context-switching to check costs; unsure about token counts
- **Success:** "I can estimate costs without leaving my terminal"

### Primary User Persona 2: DevOps / Platform Engineer
- **Who:** Infrastructure engineers building LLM platforms and cost governance
- **Need:** Cost budgeting, monitoring, and automated CI/CD guards
- **Usage:** Pipeline integration, cost dashboards, daily budget reviews
- **Pain:** No way to enforce cost limits on development teams
- **Success:** "CI/CD pipelines fail if cost exceeds threshold"

### Primary User Persona 3: LLM Researcher
- **Who:** ML engineers, researchers, prompt engineers evaluating models
- **Need:** Batch cost estimation across many prompts and models
- **Usage:** Analyzing cost/performance tradeoffs for entire datasets
- **Pain:** Manual spreadsheet calculations, inconsistent tokenizers
- **Success:** "I can estimate costs for 1M prompts in seconds"

### Secondary User Persona 4: Independent Developer / Hacker
- **Who:** Solo builders, students, hackers exploring LLMs
- **Need:** Accessible, no-setup tool to understand costs
- **Usage:** Ad hoc, exploratory
- **Pain:** High barrier to entry (requires Python, setup, learning curve)
- **Success:** "I can compare models with one command"

---

## User Stories

### Phase 1 (MVP)

1. As an **AI developer**, I want to **estimate the cost of my prompt for a single model**, so that **I know if I can afford to send this request**.
   - Acceptance: `llm-costs "Hello world" --model claude-sonnet-4-5` returns cost in <500ms

2. As an **AI developer**, I want to **compare costs across all available models**, so that **I can pick the most cost-effective model**.
   - Acceptance: `llm-costs "Hello world" --compare` shows all 20+ models sorted by cost

3. As a **DevOps engineer**, I want to **count tokens for a prompt**, so that **I can validate token usage in my logs**.
   - Acceptance: `llm-costs count "Some text"` returns token count (±5% accuracy)

4. As a **researcher**, I want to **read prompts from stdin**, so that **I can pipe files and scripts into llm-costs**.
   - Acceptance: `cat prompts.txt | llm-costs --model gpt-4o` works without tty

5. As an **independent developer**, I want to **install and run llm-costs with zero configuration**, so that **I don't need to set up API keys or config files**.
   - Acceptance: `npx llm-costs "hello"` works instantly, no setup required

6. As an **AI developer**, I want to **see token count breakdown (input vs output)**, so that **I understand the cost composition**.
   - Acceptance: Output shows: "Input tokens: 50 | Output tokens: ~200 | Total: ~250"

7. As a **researcher**, I want to **estimate output tokens based on model behavior**, so that **I can predict total costs**.
   - Acceptance: Estimation is within ±20% of actual for common prompts

8. As a **DevOps engineer**, I want to **see if a model supports batch API**, so that **I can plan for bulk processing**.
   - Acceptance: Table output shows ✓ next to batch-compatible models

9. As an **AI developer**, I want to **use relative model names** (e.g., "claude" or "gpt"), so that **I don't need to memorize exact model IDs**.
   - Acceptance: `llm-costs "hello" --model claude` suggests Claude models

10. As a **CI/CD engineer**, I want to **output results as JSON**, so that **I can parse results in my scripts**.
    - Acceptance: `llm-costs "hello" --output json` returns valid JSON

11. As a **terminal enthusiast**, I want to **disable colored output**, so that **llm-costs works in CI environments without color codes**.
    - Acceptance: `NO_COLOR=1 llm-costs "hello" --compare` outputs plain text

12. As an **AI developer**, I want to **see context window sizes**, so that **I know if my prompt fits in the model**.
    - Acceptance: Comparison table shows context window for each model

13. As a **DevOps engineer**, I want to **update pricing data**, so that **I have the latest costs from providers**.
    - Acceptance: `llm-costs --update-pricing` fetches latest from GitHub repo

14. As an **AI developer**, I want to **see a beautiful, easy-to-read comparison table**, so that **I can make quick decisions**.
    - Acceptance: Table uses color, alignment, and formatting to highlight cheapest option

15. As a **researcher**, I want to **estimate costs for 100+ token prompts in <1 second**, so that **I can do bulk analysis**.
    - Acceptance: Startup time + token counting takes <200ms for 100K token input

### Phase 2

16. As a **researcher**, I want to **process batch JSONL files**, so that **I can estimate costs for 1M prompts**.
    - Acceptance: `llm-costs batch prompts.jsonl --model gpt-4o` returns total cost + per-request breakdown

17. As a **DevOps engineer**, I want to **project monthly costs based on request frequency**, so that **I can budget for LLM infrastructure**.
    - Acceptance: `llm-costs budget --model gpt-4o --requests-per-day 1000 --avg-tokens 2000` returns monthly projection

18. As a **platform engineer**, I want to **watch API usage logs in real-time**, so that **I can track actual costs as they happen**.
    - Acceptance: `llm-costs watch --log openai_usage.log` streams usage in real-time

19. As a **CI/CD engineer**, I want to **fail builds if costs exceed a threshold**, so that **I can prevent runaway costs**.
    - Acceptance: `llm-costs guard prompts.txt --model gpt-4o --max-cost 1.00` exits with code 1 if cost > $1.00

20. As a **researcher**, I want to **export results as CSV**, so that **I can load results into Excel/Python**.
    - Acceptance: `llm-costs batch prompts.jsonl --output csv` returns CSV with columns: prompt, tokens, cost

### Phase 3

21. As a **MCP developer**, I want to **run llm-costs as an MCP server**, so that **Claude/LLMs can estimate costs.**.
    - Acceptance: `llm-costs --mcp` starts MCP server on stdio, registers estimate/compare tools

22. As an **AI developer**, I want to **use interactive mode with autocomplete**, so that **I can discover models and options interactively**.
    - Acceptance: `llm-costs -i` opens interactive shell with model autocomplete

23. As a **VS Code user**, I want to **see inline cost estimates in my editor**, so that **I can estimate costs while writing prompts**.
    - Acceptance: VS Code extension shows cost decorators above prompts

24. As a **GitHub user**, I want to **use GitHub Actions to check prompt costs**, so that **I can run cost checks on every PR**.
    - Acceptance: GitHub Action exists and can be added to workflows

25. As a **researcher**, I want to **see cost breakdown by provider**, so that **I can understand provider distribution**.
    - Acceptance: `llm-costs --compare --breakdown` shows subtotals by provider (Anthropic, OpenAI, etc.)

---

## Functional Requirements

### Phase 1 (MVP) — Weeks 1-4

| Requirement | Priority | Acceptance Criteria |
|---|---|---|
| **Single-model cost estimation** | P0 | `llm-costs "<text>" --model <model>` outputs cost in <500ms. Accuracy within ±10% of actual. |
| **Multi-model comparison** | P0 | `llm-costs "<text>" --compare` shows all models sorted by total cost, colored table, <1s response. |
| **Token counting (OpenAI)** | P0 | Uses @dqbd/tiktoken for OpenAI models, accuracy >99%. |
| **Token counting (fallback)** | P0 | Fallback heuristic (chars/3.5) available when tiktoken unavailable. |
| **Output estimation** | P0 | Estimate output tokens based on model type, accuracy ±20%. |
| **Beautiful table output** | P0 | cli-table3 with colors (green=cheapest), borders, alignment. Shows input/output/total costs. |
| **Stdin support** | P0 | Read prompts from pipes: `cat file.txt \| llm-costs --model gpt-4o`. |
| **Model name matching** | P1 | `--model claude` suggests/matches Claude models. Accept partial names. |
| **JSON output** | P1 | `--output json` returns valid JSON: {model, inputTokens, outputTokens, inputCost, outputCost, totalCost}. |
| **CSV output** | P1 | `--output csv` returns CSV format. |
| **Pricing data loading** | P0 | Load pricing.json from data/ directory. Fast load (<50ms). |
| **Pricing data format** | P0 | Support model objects: id, name, provider, input, output, context_window, supports_batch. |
| **Color/No-color support** | P0 | Respect --no-color flag and NO_COLOR env var. |
| **Context window display** | P1 | Show context window for each model in comparison table. |
| **Batch API indicator** | P1 | Show ✓ for models supporting batch API. |
| **Help and documentation** | P0 | `llm-costs --help` shows all commands, flags, examples. |
| **Version command** | P1 | `llm-costs --version` shows current version. |
| **20+ models** | P0 | Support Anthropic (3), OpenAI (5), Google (2), DeepSeek (2), Mistral (2), Cohere (2), Groq (1+) models. |
| **Startup time < 200ms** | P0 | Full CLI startup to ready state in <200ms on modern hardware. |

### Phase 2 (Advanced) — Weeks 5-8

| Requirement | Priority | Acceptance Criteria |
|---|---|---|
| **Batch JSONL processing** | P0 | `llm-costs batch prompts.jsonl --model <model>` processes JSONL (one prompt per line), outputs total + per-line costs. |
| **Budget projection** | P0 | `llm-costs budget --model <model> --requests-per-day N --avg-tokens M` calculates weekly/monthly cost. |
| **Log watching** | P1 | `llm-costs watch --log path.log` tails log file, estimates costs in real-time. |
| **CI/CD budget guard** | P0 | `llm-costs guard <file> --model <model> --max-cost $X` exits with code 1 if cost > X. |
| **Pricing auto-update** | P1 | GitHub Actions workflow updates pricing.json weekly. `llm-costs --update-pricing` manually fetches. |
| **CSV input support** | P1 | `llm-costs batch prompts.csv --model <model>` processes CSV files. |
| **Performance** | P0 | Process 1M prompts in <60 seconds (bulk mode). |

### Phase 3 (Ecosystem) — Weeks 9+

| Requirement | Priority | Acceptance Criteria |
|---|---|---|
| **MCP server mode** | P2 | `llm-costs --mcp` starts MCP server, exports estimate/compare tools. |
| **Interactive mode** | P2 | `llm-costs -i` opens interactive REPL with model autocomplete. |
| **VS Code extension** | P2 | Extension displays inline cost estimates for prompts in editors. |
| **GitHub Action** | P2 | Official GitHub Action for cost checks in workflows. |
| **Cost breakdown** | P2 | `--breakdown` flag shows cost distribution by provider. |

---

## Non-Functional Requirements

| Requirement | Target | Rationale |
|---|---|---|
| **CLI Startup Time** | <200ms | Developers run it dozens of times/day; must be instant |
| **Table Rendering** | <100ms | Key feature must feel snappy |
| **Token Counting** | <500ms for 100K tokens | Bulk processing must be fast |
| **Bundle Size** | <5MB | Easy installation, fast npm install |
| **Node.js Version** | 18.0+ | ES2022 features, async/await, native support |
| **Platforms** | macOS, Linux, Windows | Cover 99% of developer machines |
| **Error Messages** | User-friendly, actionable | Developers should understand errors immediately |
| **Testing** | >80% code coverage | Jest unit + integration tests |
| **Documentation** | Complete | JSDoc on all public functions |
| **TypeScript** | Strict mode | No `any` types, full type safety |

---

## Success Metrics

### Week 1
- GitHub stars: 100+
- npm weekly downloads: 500+
- Product Hunt top 5
- HN Show HN top 10

### Month 1
- GitHub stars: 500+
- npm weekly downloads: 2,500+
- Mentions in 2+ newsletters
- Top search result for "llm cost calculator cli"

### Month 3
- GitHub stars: 1,000+
- npm weekly downloads: 5,000+
- Mentioned in 5+ newsletters/blogs
- First page Google result

### Beyond
- Community contributions to pricing.json
- 3+ GitHub Issues asking for Phase 2 features
- Real production usage (evidenced by GitHub issues)

---

## Out of Scope (Explicitly)

- Making actual API calls (this is an estimator only)
- Storing API keys or credentials
- Building a web UI or dashboard
- Real-time monitoring of actual costs (Phase 3 only via watch mode)
- Provider authentication or account linking
- Building language bindings (Python, Go, etc.) in v1

---

## Dependencies & Risk Management

### Critical Dependencies
| Dependency | Risk | Mitigation |
|---|---|---|
| **@dqbd/tiktoken** | Package discontinued or broken | Maintain pure-JS fallback tokenizer; community can contribute alternative |
| **Provider pricing accuracy** | Prices change without notice | Weekly auto-update via GH Actions; community PRs for updates |
| **npm package name** | Name already taken | Verify availability before launch |
| **Node.js 18 EOL** | Support drift | Update min version annually; target current LTS |

### Implementation Risks
| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Tokenizer inaccuracy (>15% error) | Medium | Users make wrong decisions | Use tiktoken + document fallback limits, tests against known samples |
| Table formatting breaks on Windows | Medium | Bad user experience | Test on Windows CI; use cross-platform libs (cli-table3) |
| Pricing data becomes stale | High | Users see wrong prices | Weekly auto-update workflow + community PRs |
| Performance regression (>200ms startup) | Medium | Kill adoption | Benchmark in CI; fail builds if regression detected |

### Market Risks
| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| HN/Product Hunt launch flops | Low-Medium | Project gets no visibility | Strong positioning, demo video, launch on both platforms |
| Competitor launches similar tool | Medium | Market dilution | Launch fast (within 2 weeks); build community early |
| Limited market demand | Low | Niche tool | Problem is real (ask 5 developers); timing is good (LLM cost concern is rising) |

---

## Launch Checklist

**1 Week Before Launch**
- [ ] Code complete and tested (Phase 1)
- [ ] 80%+ test coverage achieved
- [ ] npm package name verified as available
- [ ] GitHub repo set up with all files
- [ ] README with demo screenshots ready
- [ ] CONTRIBUTING.md written
- [ ] LICENSE file (MIT)
- [ ] CHANGELOG.md started

**Launch Day**
- [ ] Tag v0.1.0 in git
- [ ] Run `npm publish` (should auto-publish via prepublishOnly)
- [ ] Verify package on npmjs.com
- [ ] Test `npx llm-costs "hello"` works
- [ ] Submit to Product Hunt (8-9am PT)
- [ ] Prepare HN Show HN post (title, description, demo)
- [ ] Post on Twitter/X (if applicable)
- [ ] Email to personal network

**Week 1**
- [ ] Monitor Product Hunt/HN comments; respond quickly
- [ ] Merge community PRs (if any)
- [ ] Fix any critical bugs
- [ ] Collect feature requests
- [ ] Share on relevant subreddits (r/openai, r/langchain, r/MachineLearning)
- [ ] Reach out to AI/Dev newsletter authors

**Month 1**
- [ ] Plan Phase 2 features based on feedback
- [ ] Publish blog post: "We built a CLI that estimates LLM costs in <200ms"
- [ ] Add GitHub badges to README
- [ ] Create demo video (30-60 sec)

---

## Success Criteria Summary

**Product:**
- Launch with all Phase 1 features
- Support 20+ models from 6+ providers
- Beautiful, functional CLI interface
- Zero configuration required

**Community:**
- 100 GitHub stars in Week 1
- 500 stars by Month 1
- 1,000 stars by Month 3
- Active community PRs to pricing.json

**Business:**
- 500+ npm downloads/week → 5,000+ by Month 3
- Top 3 search results for "llm cost calculator"
- Featured in 3+ major newsletters
- Real-world production usage

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-03  
**Next Review:** Upon Phase 1 completion
