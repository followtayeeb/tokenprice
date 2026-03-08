# tokenprice — LLM Cost Estimator for VS Code

Estimate and compare LLM API costs directly in your editor. Select text, see token counts and pricing instantly for 17 models across 6 providers.

## Features

- **Status bar** — shows token count and estimated cost for selected text
- **Estimate Cost** (Ctrl+Shift+T / Cmd+Shift+T) — quick cost estimate for the current selection
- **Compare Models** — side-by-side cost comparison across all supported models, sorted cheapest first
- **Set Default Model** — pick your preferred model from a quick-pick list

## Supported Providers

Anthropic, OpenAI, Google, DeepSeek, Mistral, Cohere, Groq (17 models total).

## Configuration

| Setting | Default | Description |
|---|---|---|
| `tokenprice.defaultModel` | `claude-sonnet-4-5-20250514` | Model ID used for single-model estimates |
| `tokenprice.showStatusBar` | `true` | Show token/cost info in the status bar |
| `tokenprice.autoEstimate` | `true` | Auto-update the status bar on selection change |

## Usage

1. Select text in the editor.
2. Press **Ctrl+Shift+T** (or **Cmd+Shift+T** on macOS) to see the cost estimate.
3. Run **tokenprice: Compare Models** from the command palette to compare all models.
4. Run **tokenprice: Set Default Model** to change your default.

## How It Works

Token counting uses a chars/4 heuristic. Output tokens are estimated based on input length. Pricing data covers all major LLM providers as of March 2026.

## License

MIT
