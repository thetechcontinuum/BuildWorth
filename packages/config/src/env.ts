import { z } from "zod";

// Automatically load .env in Node 20+ if present
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile();
  } catch {
    // .env file optional
  }
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://postgres:postgres@localhost:5432/buildworth?schema=public"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_ADMIN_URL: z.string().url().default("http://localhost:3001"),
  AUTH_SECRET: z.string().min(16).default("dev-secret-key-at-least-16-characters"),

  // AI Provider & Agnes AI configuration (https://agnes-ai.com)
  AI_PROVIDER: z.enum(["agnes", "mock", "openai", "gemini", "anthropic"]).default("agnes"),
  AGNES_AI_API_KEY: z.string().default(""),
  AGNES_AI_BASE_URL: z.string().url().default("https://api.agnes-ai.com/v1"),
  AGNES_AI_MODEL: z.string().default("agnes-default"),
  AGNES_AI_EMBEDDING_MODEL: z.string().default("agnes-embed-default"),

  AI_DAILY_SPEND_LIMIT_CENTS: z.coerce.number().int().positive().default(500),
  AI_MONTHLY_SPEND_LIMIT_CENTS: z.coerce.number().int().positive().default(15000),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
});

export type AppEnv = z.infer<typeof EnvSchema>;

let parsedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!parsedEnv) {
    const result = EnvSchema.safeParse(process.env);
    if (!result.success) {
      console.error("Invalid environment configuration:", result.error.format());
      throw new Error("Invalid environment configuration");
    }
    parsedEnv = result.data;
  }
  return parsedEnv;
}
