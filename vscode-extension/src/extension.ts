import * as vscode from 'vscode';

interface ModelPricing {
  id: string;
  name: string;
  provider: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
  supportsBatch: boolean;
}

const MODELS: ModelPricing[] = [
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', provider: 'Anthropic', inputPrice: 5.00, outputPrice: 25.00, contextWindow: 200000, supportsBatch: true },
  { id: 'claude-sonnet-4-5-20250514', name: 'Claude Sonnet 4.5', provider: 'Anthropic', inputPrice: 3.00, outputPrice: 15.00, contextWindow: 200000, supportsBatch: true },
  { id: 'claude-haiku-4-5-20250514', name: 'Claude Haiku 4.5', provider: 'Anthropic', inputPrice: 1.00, outputPrice: 5.00, contextWindow: 200000, supportsBatch: true },
  { id: 'gpt-4-turbo', name: 'GPT-4.1', provider: 'OpenAI', inputPrice: 2.00, outputPrice: 8.00, contextWindow: 128000, supportsBatch: true },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', inputPrice: 2.50, outputPrice: 10.00, contextWindow: 128000, supportsBatch: true },
  { id: 'gpt-4o-mini', name: 'GPT-4o-mini', provider: 'OpenAI', inputPrice: 0.40, outputPrice: 1.60, contextWindow: 128000, supportsBatch: true },
  { id: 'o3', name: 'o3', provider: 'OpenAI', inputPrice: 10.00, outputPrice: 40.00, contextWindow: 128000, supportsBatch: false },
  { id: 'o3-mini', name: 'o3-mini', provider: 'OpenAI', inputPrice: 1.10, outputPrice: 4.40, contextWindow: 128000, supportsBatch: false },
  { id: 'gemini-2-5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', inputPrice: 1.25, outputPrice: 10.00, contextWindow: 1000000, supportsBatch: true },
  { id: 'gemini-2-5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', inputPrice: 0.30, outputPrice: 2.50, contextWindow: 1000000, supportsBatch: true },
  { id: 'deepseek-v3', name: 'DeepSeek-V3', provider: 'DeepSeek', inputPrice: 0.14, outputPrice: 0.28, contextWindow: 64000, supportsBatch: true },
  { id: 'deepseek-r1', name: 'DeepSeek-R1', provider: 'DeepSeek', inputPrice: 0.55, outputPrice: 2.19, contextWindow: 64000, supportsBatch: true },
  { id: 'mistral-large-2411', name: 'Mistral Large', provider: 'Mistral', inputPrice: 2.00, outputPrice: 6.00, contextWindow: 32000, supportsBatch: true },
  { id: 'mistral-medium', name: 'Mistral Medium', provider: 'Mistral', inputPrice: 0.40, outputPrice: 2.00, contextWindow: 32000, supportsBatch: false },
  { id: 'command-r-plus', name: 'Command R+', provider: 'Cohere', inputPrice: 2.50, outputPrice: 10.00, contextWindow: 128000, supportsBatch: true },
  { id: 'command-r', name: 'Command R', provider: 'Cohere', inputPrice: 0.15, outputPrice: 0.60, contextWindow: 128000, supportsBatch: true },
  { id: 'llama-3-3-70b', name: 'Llama-3.3-70B', provider: 'Groq', inputPrice: 0.59, outputPrice: 0.79, contextWindow: 8000, supportsBatch: false },
];

function countTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function estimateOutputTokens(inputTokens: number): number {
  if (inputTokens < 50) return Math.ceil(inputTokens * 3);
  if (inputTokens < 200) return Math.ceil(inputTokens * 2.5);
  if (inputTokens < 500) return Math.ceil(inputTokens * 2);
  if (inputTokens < 2000) return Math.ceil(inputTokens * 1.5);
  return Math.ceil(inputTokens * 0.8);
}

function estimateCost(inputTokens: number, outputTokens: number, model: ModelPricing): number {
  return (inputTokens * model.inputPrice + outputTokens * model.outputPrice) / 1_000_000;
}

function findModel(modelId: string): ModelPricing {
  return MODELS.find(m => m.id === modelId)
    ?? MODELS.find(m => m.name.toLowerCase().includes(modelId.toLowerCase()))
    ?? MODELS[0];
}

export function activate(context: vscode.ExtensionContext): void {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'llm-costs.estimateCost';
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => {
      const config = vscode.workspace.getConfiguration('llm-costs');
      if (!config.get('showStatusBar') || !config.get('autoEstimate')) {
        statusBarItem.hide();
        return;
      }
      const selection = e.textEditor.selection;
      if (selection.isEmpty) {
        statusBarItem.hide();
        return;
      }
      const text = e.textEditor.document.getText(selection);
      const modelId = config.get('defaultModel', 'claude-sonnet-4-5-20250514') as string;
      const model = findModel(modelId);
      const inputTokens = countTokens(text);
      const outputTokens = estimateOutputTokens(inputTokens);
      const cost = estimateCost(inputTokens, outputTokens, model);
      statusBarItem.text = `$(symbol-ruler) ~${inputTokens} tokens | $${cost.toFixed(4)}`;
      statusBarItem.tooltip = `llm-costs: ~${inputTokens} input tokens, ~${outputTokens} output tokens estimated\nModel: ${model.name}\nEstimated cost: $${cost.toFixed(6)}`;
      statusBarItem.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('llm-costs.estimateCost', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const text = editor.document.getText(editor.selection);
      if (!text) {
        vscode.window.showWarningMessage('llm-costs: Select some text first');
        return;
      }
      const config = vscode.workspace.getConfiguration('llm-costs');
      const modelId = config.get('defaultModel', 'claude-sonnet-4-5-20250514') as string;
      const model = findModel(modelId);
      const inputTokens = countTokens(text);
      const outputTokens = estimateOutputTokens(inputTokens);
      const cost = estimateCost(inputTokens, outputTokens, model);
      vscode.window.showInformationMessage(
        `llm-costs: ~${inputTokens} tokens | ${model.name}: $${cost.toFixed(4)} estimated`
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('llm-costs.compareModels', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const text = editor.document.getText(editor.selection);
      if (!text) {
        vscode.window.showWarningMessage('llm-costs: Select some text first');
        return;
      }
      const inputTokens = countTokens(text);
      const outputTokens = estimateOutputTokens(inputTokens);
      const sorted = [...MODELS]
        .map(m => ({ model: m, cost: estimateCost(inputTokens, outputTokens, m) }))
        .sort((a, b) => a.cost - b.cost);

      const items = sorted.map((item, idx) => ({
        label: `${idx === 0 ? '$(star) ' : ''}${item.model.name}`,
        description: `$${item.cost.toFixed(4)}`,
        detail: `${item.model.provider} · ${item.model.contextWindow.toLocaleString()} ctx · ${item.model.supportsBatch ? 'batch \u2713' : ''}`,
      }));

      await vscode.window.showQuickPick(items, {
        title: `llm-costs: ~${inputTokens} tokens, compare all models`,
        placeHolder: 'Models sorted by cost (cheapest first)',
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('llm-costs.setModel', async () => {
      const items = MODELS.map(m => ({
        label: m.name,
        description: `$${m.inputPrice}/M in · $${m.outputPrice}/M out`,
        detail: m.provider,
      }));
      const picked = await vscode.window.showQuickPick(items, {
        title: 'llm-costs: Select default model',
        placeHolder: 'Choose a model for cost estimation',
      });
      if (picked) {
        const model = MODELS.find(m => m.name === picked.label);
        if (model) {
          await vscode.workspace.getConfiguration('llm-costs').update('defaultModel', model.id, true);
          vscode.window.showInformationMessage(`llm-costs: Default model set to ${model.name}`);
        }
      }
    })
  );
}

export function deactivate(): void {}
