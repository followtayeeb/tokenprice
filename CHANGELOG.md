# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-03

### Added

- Initial release of tokenprice
- Single-model cost estimation with `--model` flag
- Multi-model cost comparison with `--compare` flag
- Support for 17 LLM models from 7 providers:
  - Anthropic: Claude Opus 4.5, Sonnet 4.5, Haiku 4.5
  - OpenAI: GPT-4.1, GPT-4o, GPT-4o-mini, o3, o3-mini
  - Google: Gemini 2.5 Pro, Gemini 2.5 Flash
  - DeepSeek: DeepSeek-V3, DeepSeek-R1
  - Mistral: Mistral Large, Mistral Medium
  - Cohere: Command R+, Command R
  - Groq: Llama-3.3-70B
- Token counting with heuristic fallback
- Output token estimation based on input size
- Beautiful colored terminal table output with cli-table3
- JSON and CSV output formats
- Colored output support with `--no-color` flag and `NO_COLOR` env var
- File input support with `--file` flag
- Stdin pipe support
- Token counting command: `tokenprice count`
- Model listing command: `tokenprice list`
- Comprehensive CLI help and documentation
- Complete TypeScript strict mode implementation
- Unit tests for pricing and tokenizer modules
- ESLint and Prettier configuration
- Jest testing framework
- GitHub Actions CI/CD workflows
- MIT License

### Planned for Phase 2

- Batch processing from JSONL/CSV files
- Budget projection calculator
- Log file watcher for real-time usage tracking
- CI/CD budget guard for automated cost checks
- Automatic pricing updates from provider APIs

### Planned for Phase 3

- MCP (Model Context Protocol) server mode
- VS Code extension with inline cost decorators
- GitHub Action for PR cost checks
- Interactive REPL mode with autocomplete

