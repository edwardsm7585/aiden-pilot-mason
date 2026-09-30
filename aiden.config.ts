/**
 * AIDEN feature flags.
 *
 * `aiden doctor` reads this to decide which env vars are required, and
 * `aiden upgrade` reads it to know which codemods to apply.
 *
 * aiden-cli 2.0.1 does not evaluate this file: it regex-converts the
 * `aidenConfig` literal to JSON. Keep the literal JSON-compatible — no
 * `as` casts, no `undefined`, no `//` inside strings (escape as `\/\/`) —
 * and keep `ai.providers` as booleans (the CLI schema requires it).
 */

type AidenConfigShape = {
  version: string;
  app: {
    name: string;
    shortName: string;
    tagline: string;
    description: string;
    supportEmail: string;
    url: string;
    companyLegalName: string;
    footerLinks: { href: string; label: string }[];
  };
  auth: {
    providers: {
      google: boolean;
      github: boolean;
      microsoft: boolean;
      credentials: boolean;
    };
  };
  ai: {
    providers: Record<AIProviderName, boolean>;
    models: Record<AIProviderName, string>;
  };
  audit: { enabled: boolean };
  rbac: { enabled: boolean };
  billing: { enabled: boolean };
  email: { enabled: boolean };
};

type AIProviderName =
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "groq"
  | "cohere";

export const aidenConfig: AidenConfigShape = {
  /** AIDEN single-train version this app was last upgraded to. */
  version: "2.0.1",

  /**
   * Your app's identity. These are placeholders — replace them with your
   * product's real values. `NEXT_PUBLIC_APP_*` env vars override the
   * name/tagline/copyright at runtime (see src/config/brand.ts).
   */
  app: {
    name: "Your App",
    shortName: "your-app",
    tagline: "Your product tagline goes here.",
    description: "A short description of your app for metadata and previews.",
    supportEmail: "support@example.com",
    url: "https:\/\/example.com",
    companyLegalName: "Your Company, Inc.",
    footerLinks: [],
  },

  auth: {
    providers: {
      google: false,
      github: false,
      microsoft: false,
      credentials: true,
    },
  },

  ai: {
    /** Toggle providers here; `aiden doctor` requires the matching API key env var. */
    providers: {
      openai: false,
      anthropic: false,
      google: false,
      mistral: false,
      groq: false,
      cohere: false,
    },
    /** Default model per provider, used by src/lib/ai.ts. */
    models: {
      openai: "gpt-4o-mini",
      anthropic: "claude-haiku-4-5",
      google: "gemini-2.5-flash",
      mistral: "mistral-small-latest",
      groq: "llama-3.3-70b-versatile",
      cohere: "command-r",
    },
  },

  audit: {
    enabled: true, // Prisma sink registered in src/lib/audit.ts
  },

  rbac: {
    enabled: true, // roles seeded in prisma/seed.ts; rules in src/lib/abilities.ts
  },

  billing: {
    enabled: false, // toggle when wiring Stripe in src/lib/stripe.ts
  },

  email: {
    enabled: false, // toggle when wiring SendGrid in src/lib/email.ts
  },
};

export type AidenConfig = typeof aidenConfig;
