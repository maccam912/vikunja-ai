import { register, registerInstrumentations } from "@arizeai/phoenix-otel";
import { OpenAIInstrumentation } from "@arizeai/openinference-instrumentation-openai";
import OpenAI from "openai";

let isInitialized = false;

/**
 * Initialize Phoenix Arize tracing for OpenAI/OpenRouter
 * Must be called before creating any OpenAI clients
 */
export function initializePhoenix(phoenixEndpoint: string, apiKey?: string) {
  if (isInitialized) {
    console.log("[Phoenix] Already initialized");
    return;
  }

  try {
    console.log(`[Phoenix] Initializing with endpoint: ${phoenixEndpoint}`);

    // Set environment variables for Phoenix collector
    Deno.env.set("PHOENIX_COLLECTOR_ENDPOINT", phoenixEndpoint);
    if (apiKey) {
      Deno.env.set("PHOENIX_API_KEY", apiKey);
      console.log("[Phoenix] Using API key authentication");
    }

    // Register Phoenix OTEL provider (ESM approach)
    register({
      projectName: "vikunja-ai",
    });

    // Manual instrumentation for ESM
    const instrumentation = new OpenAIInstrumentation();
    instrumentation.manuallyInstrument(OpenAI);

    registerInstrumentations({
      instrumentations: [instrumentation],
    });

    isInitialized = true;
    console.log("[Phoenix] ✓ Tracing initialized successfully");
  } catch (error) {
    console.error("[Phoenix] Failed to initialize:", error);
    throw error;
  }
}

/**
 * Check if Phoenix is initialized
 */
export function isPhoenixInitialized(): boolean {
  return isInitialized;
}
