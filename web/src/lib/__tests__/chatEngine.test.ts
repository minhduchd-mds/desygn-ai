/**
 * Tests for chat-engine module.
 */
import { describe, it, expect } from "vitest";
import { ChatEngine, createUserMessage, createAssistantMessage, createSystemMessage } from "../../chat-engine";

describe("ChatEngine", () => {
  it("creates with default config", () => {
    const engine = ChatEngine.create();
    const config = engine.getConfig();
    expect(config.provider).toBe("groq");
    expect(config.model).toBe("llama-3.3-70b-versatile");
    expect(config.enableAgentMode).toBe(false);
    expect(config.injectDesignContext).toBe(true);
  });

  it("creates with custom config", () => {
    const engine = ChatEngine.create({ provider: "anthropic", model: "claude-3" });
    expect(engine.getConfig().provider).toBe("anthropic");
    expect(engine.getConfig().model).toBe("claude-3");
  });

  it("updates config via configure", () => {
    const engine = ChatEngine.create();
    engine.configure({ temperature: 0.5, maxTokens: 4096 });
    expect(engine.getConfig().temperature).toBe(0.5);
    expect(engine.getConfig().maxTokens).toBe(4096);
  });

  it("abort does not throw when no active request", () => {
    const engine = ChatEngine.create();
    expect(() => engine.abort()).not.toThrow();
  });
});

describe("Message helpers", () => {
  it("createUserMessage creates correct structure", () => {
    const msg = createUserMessage("Hello");
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("Hello");
  });

  it("createAssistantMessage has Desygn AI title", () => {
    const msg = createAssistantMessage("Response");
    expect(msg.role).toBe("assistant");
    expect(msg.content).toBe("Response");
    expect(msg.title).toBe("Desygn AI");
  });

  it("createSystemMessage has System title", () => {
    const msg = createSystemMessage("System info");
    expect(msg.role).toBe("assistant");
    expect(msg.title).toBe("System");
  });

  it("messages have unique ids", () => {
    const m1 = createUserMessage("a");
    const m2 = createUserMessage("b");
    expect(m1.id).not.toBe(m2.id);
  });

  it("messages have id format with timestamp", () => {
    const msg = createUserMessage("test");
    // id format: `${Date.now()}-${random}`
    expect(msg.id).toMatch(/^\d+-[0-9a-f]+$/);
  });
});
