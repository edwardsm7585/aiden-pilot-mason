import "server-only";
import {
  createAIClient,
  type AIClient,
  type AIProvider,
} from "@upstart13-com/aiden-ai";
import { aidenConfig } from "@/../aiden.config";
// Register the AIUsage sink in the same module graph as the AI calls (see
// the note in src/lib/auth.ts on why instrumentation.ts alone isn't enough).
import "@/lib/ai-usage";

/**
 * The app's single AI client (plan D6). Provider and model come from
 * `aiden.config.ts` → `ai.active` + `ai.models[active]`, so switching
 * provider is a one-line config change with no edits here or in routes.
 * Install the provider's SDK (optional peer of aiden-ai) before enabling it.
 */

const API_KEY_ENV: Record<AIProvider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  mistral: "MISTRAL_API_KEY",
  groq: "GROQ_API_KEY",
  cohere: "COHERE_API_KEY",
};

/** Thrown when the active provider is disabled (the AI kill-switch, plan §7). */
export class AIUnavailableError extends Error {
  constructor() {
    super("AI unavailable");
  }
}

let client: Promise<AIClient> | undefined;

/** Lazily build (once) and return the configured AI client. */
export function getAI(): Promise<AIClient> {
  const provider = aidenConfig.ai.active;
  if (!aidenConfig.ai.providers[provider]) {
    return Promise.reject(new AIUnavailableError());
  }
  client ??= createAIClient({
    provider,
    model: aidenConfig.ai.models[provider],
    apiKey: process.env[API_KEY_ENV[provider]],
  }).catch((err: unknown) => {
    client = undefined; // don't cache a failed build; retry on next call
    throw err;
  });
  return client;
}
