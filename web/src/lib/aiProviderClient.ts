/**
 * AI Provider Client — Real API connection layer.
 * Bridges ProviderRouter decisions with actual API calls to Groq/OpenAI/Anthropic.
 */

// ─── Types ─────────────────────────────────────────────

export interface ProviderCredentials {
  groqApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  localEndpoint?: string;
}

export interface CompletionRequest {
  provider: "groq" | "openai" | "anthropic" | "local";
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  signal?: AbortSignal;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionResponse {
  content: string;
  model: string;
  provider: string;
  tokensUsed: { input: number; output: number; total: number };
  latencyMs: number;
  finishReason: "stop" | "length" | "error";
  cached: boolean;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
  tokensUsed?: number;
}

export interface ProviderHealth {
  provider: string;
  status: "healthy" | "degraded" | "down";
  latencyMs: number;
  lastChecked: number;
}

interface ProviderConfig {
  baseUrl: string;
  authHeader: string;
  modelPrefix?: string;
}

// ─── Constants ─────────────────────────────────────────

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    authHeader: "Authorization",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    authHeader: "Authorization",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    authHeader: "x-api-key",
  },
};

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

// ─── AIProviderClient ──────────────────────────────────

export class AIProviderClient {
  private credentials: ProviderCredentials = {};
  private healthCache: Map<string, ProviderHealth> = new Map();
  private requestCount = 0;
  private totalTokens = 0;
  private totalCostUsd = 0;

  configure(creds: ProviderCredentials): void {
    this.credentials = { ...this.credentials, ...creds };
  }

  getConfiguredProviders(): string[] {
    const providers: string[] = [];
    if (this.credentials.groqApiKey) providers.push("groq");
    if (this.credentials.openaiApiKey) providers.push("openai");
    if (this.credentials.anthropicApiKey) providers.push("anthropic");
    if (this.credentials.localEndpoint) providers.push("local");
    return providers;
  }

  isConfigured(provider: string): boolean {
    switch (provider) {
      case "groq": return !!this.credentials.groqApiKey;
      case "openai": return !!this.credentials.openaiApiKey;
      case "anthropic": return !!this.credentials.anthropicApiKey;
      case "local": return !!this.credentials.localEndpoint;
      default: return false;
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const start = performance.now();

    if (!this.isConfigured(request.provider)) {
      throw new Error(`Provider "${request.provider}" not configured. Call configure() first.`);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await this.executeRequest(request);
        const latencyMs = Math.round(performance.now() - start);

        this.requestCount++;
        this.totalTokens += response.tokensUsed.total;
        this.totalCostUsd += this.estimateCost(request.provider, request.model, response.tokensUsed);

        return { ...response, latencyMs };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry on 4xx errors (except 429 rate limit)
        if (lastError.message.includes("401") || lastError.message.includes("403")) {
          throw lastError;
        }

        // Exponential backoff
        if (attempt < MAX_RETRIES - 1) {
          const delay = RETRY_BASE_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error("Request failed after retries");
  }

  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    if (!this.isConfigured(request.provider)) {
      throw new Error(`Provider "${request.provider}" not configured.`);
    }

    const config = this.getProviderConfig(request.provider);
    const apiKey = this.getApiKey(request.provider);
    const url = `${config.baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (request.provider === "anthropic") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const body = this.buildRequestBody(request, true);

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!response.ok) {
      throw new Error(`${request.provider} API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            yield { delta: "", done: true };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              yield { delta, done: false };
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { delta: "", done: true };
  }

  async healthCheck(provider: string): Promise<ProviderHealth> {
    const start = performance.now();
    let status: ProviderHealth["status"] = "down";

    try {
      if (!this.isConfigured(provider)) {
        status = "down";
      } else {
        // Lightweight check — list models endpoint
        const config = this.getProviderConfig(provider);
        const apiKey = this.getApiKey(provider);

        const headers: Record<string, string> = {};
        if (provider === "anthropic") {
          headers["x-api-key"] = apiKey;
          headers["anthropic-version"] = "2023-06-01";
        } else {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }

        const response = await fetch(`${config.baseUrl}/models`, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(5000),
        });

        const latency = performance.now() - start;
        status = response.ok ? (latency > 2000 ? "degraded" : "healthy") : "down";
      }
    } catch {
      status = "down";
    }

    const health: ProviderHealth = {
      provider,
      status,
      latencyMs: Math.round(performance.now() - start),
      lastChecked: Date.now(),
    };

    this.healthCache.set(provider, health);
    return health;
  }

  async healthCheckAll(): Promise<ProviderHealth[]> {
    const providers = this.getConfiguredProviders();
    return Promise.all(providers.map(p => this.healthCheck(p)));
  }

  getStats() {
    return {
      requestCount: this.requestCount,
      totalTokens: this.totalTokens,
      totalCostUsd: Math.round(this.totalCostUsd * 10000) / 10000,
      configuredProviders: this.getConfiguredProviders(),
      healthCache: Object.fromEntries(this.healthCache),
    };
  }

  resetStats(): void {
    this.requestCount = 0;
    this.totalTokens = 0;
    this.totalCostUsd = 0;
  }

  // ─── Private ───────────────────────────────────────────

  private async executeRequest(request: CompletionRequest): Promise<CompletionResponse> {
    const config = this.getProviderConfig(request.provider);
    const apiKey = this.getApiKey(request.provider);

    if (request.provider === "anthropic") {
      return this.executeAnthropicRequest(request, config, apiKey);
    }

    // OpenAI-compatible (Groq, OpenAI, local)
    const url = `${config.baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    };

    const body = this.buildRequestBody(request, false);

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`${request.provider} ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content ?? "",
      model: data.model ?? request.model,
      provider: request.provider,
      tokensUsed: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
        total: data.usage?.total_tokens ?? 0,
      },
      latencyMs: 0, // Set by caller
      finishReason: choice?.finish_reason === "length" ? "length" : "stop",
      cached: !!data.usage?.prompt_tokens_details?.cached_tokens,
    };
  }

  private async executeAnthropicRequest(
    request: CompletionRequest,
    config: ProviderConfig,
    apiKey: string,
  ): Promise<CompletionResponse> {
    const url = `${config.baseUrl}/messages`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };

    const systemMsg = request.messages.find(m => m.role === "system");
    const userMessages = request.messages.filter(m => m.role !== "system");

    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.maxTokens ?? 4096,
      messages: userMessages.map(m => ({ role: m.role, content: m.content })),
    };

    if (systemMsg) {
      body.system = systemMsg.content;
    }
    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`anthropic ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text ?? "";

    return {
      content,
      model: data.model ?? request.model,
      provider: "anthropic",
      tokensUsed: {
        input: data.usage?.input_tokens ?? 0,
        output: data.usage?.output_tokens ?? 0,
        total: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
      latencyMs: 0,
      finishReason: data.stop_reason === "max_tokens" ? "length" : "stop",
      cached: !!data.usage?.cache_read_input_tokens,
    };
  }

  private buildRequestBody(request: CompletionRequest, stream: boolean): Record<string, unknown> {
    return {
      model: request.model,
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
      stream,
    };
  }

  private getProviderConfig(provider: string): ProviderConfig {
    if (provider === "local") {
      return {
        baseUrl: this.credentials.localEndpoint ?? "http://localhost:11434/v1",
        authHeader: "Authorization",
      };
    }
    const config = PROVIDER_CONFIGS[provider];
    if (!config) throw new Error(`Unknown provider: ${provider}`);
    return config;
  }

  private getApiKey(provider: string): string {
    switch (provider) {
      case "groq": return this.credentials.groqApiKey ?? "";
      case "openai": return this.credentials.openaiApiKey ?? "";
      case "anthropic": return this.credentials.anthropicApiKey ?? "";
      case "local": return "local";
      default: return "";
    }
  }

  private estimateCost(provider: string, model: string, tokens: { input: number; output: number }): number {
    // Cost per 1M tokens (approximate)
    const costs: Record<string, { input: number; output: number }> = {
      "llama-3.1-8b-instant": { input: 0.05, output: 0.08 },
      "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
      "mixtral-8x7b-32768": { input: 0.24, output: 0.24 },
      "gpt-4o": { input: 2.5, output: 10 },
      "claude-sonnet-4-20250514": { input: 3, output: 15 },
      "claude-haiku-4.5-20250501": { input: 0.8, output: 4 },
    };

    const rate = costs[model] ?? (provider === "groq" ? { input: 0.1, output: 0.1 } : { input: 1, output: 3 });
    return (tokens.input * rate.input + tokens.output * rate.output) / 1_000_000;
  }
}

// ─── Factory ───────────────────────────────────────────

export function createAIProviderClient(credentials?: ProviderCredentials): AIProviderClient {
  const client = new AIProviderClient();
  if (credentials) client.configure(credentials);
  return client;
}
