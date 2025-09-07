/**
 * Global API Keys Configuration
 * Centralized management of all API keys and environment variables
 */

export interface ApiKeys {
  anthropic: {
    apiKey: string;
    model: string;
  };
  freepik: {
    apiKey: string;
    webhookSecret: string;
    imageModel: string;
    aspectRatio: string;
  };
  google: {
    docUrl: string;
  };
  app: {
    password?: string;
    originAllowlist?: string;
    publicUrl: string;
  };
}

/**
 * Validates and returns all API keys from environment variables
 * Throws an error if any required keys are missing
 */
export function getApiKeys(): ApiKeys {
  const requiredKeys = {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    },
    freepik: {
      apiKey: process.env.FREEPIK_API_KEY || '',
      webhookSecret: process.env.FREEPIK_WEBHOOK_SECRET || '',
      imageModel: process.env.FREEPIK_IMAGE_MODEL || 'imagen nano banana',
      aspectRatio: process.env.FREEPIK_ASPECT_RATIO || 'original',
    },
    google: {
      docUrl: process.env.GOOGLE_DOC_URL || '',
    },
    app: {
      password: process.env.APP_PASSWORD,
      originAllowlist: process.env.ORIGIN_ALLOWLIST,
      publicUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
  };

  // Validate required keys
  const missingKeys: string[] = [];
  
  if (!requiredKeys.anthropic.apiKey) {
    missingKeys.push('ANTHROPIC_API_KEY');
  }
  
  if (!requiredKeys.freepik.apiKey) {
    missingKeys.push('FREEPIK_API_KEY');
  }
  
  if (!requiredKeys.freepik.webhookSecret) {
    missingKeys.push('FREEPIK_WEBHOOK_SECRET');
  }
  
  if (!requiredKeys.google.docUrl) {
    missingKeys.push('GOOGLE_DOC_URL');
  }

  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingKeys.join(', ')}\n` +
      'Please check your .env.local file and ensure all required keys are set.'
    );
  }

  return requiredKeys;
}

/**
 * Validates a specific API key without throwing errors
 * Returns true if the key exists and is not empty
 */
export function validateApiKey(keyName: keyof ApiKeys, subKey?: string): boolean {
  try {
    const keys = getApiKeys();
    
    if (subKey) {
      return !!(keys[keyName] as any)[subKey];
    }
    
    return !!keys[keyName];
  } catch {
    return false;
  }
}

/**
 * Gets a specific API key safely (returns undefined if not found)
 */
export function getApiKey(keyName: keyof ApiKeys, subKey?: string): string | undefined {
  try {
    const keys = getApiKeys();
    
    if (subKey) {
      return (keys[keyName] as any)[subKey];
    }
    
    return keys[keyName] as any;
  } catch {
    return undefined;
  }
}

/**
 * Environment variable names for reference
 */
export const ENV_VARS = {
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  ANTHROPIC_MODEL: 'ANTHROPIC_MODEL',
  FREEPIK_API_KEY: 'FREEPIK_API_KEY',
  FREEPIK_WEBHOOK_SECRET: 'FREEPIK_WEBHOOK_SECRET',
  FREEPIK_IMAGE_MODEL: 'FREEPIK_IMAGE_MODEL',
  FREEPIK_ASPECT_RATIO: 'FREEPIK_ASPECT_RATIO',
  GOOGLE_DOC_URL: 'GOOGLE_DOC_URL',
  APP_PASSWORD: 'APP_PASSWORD',
  ORIGIN_ALLOWLIST: 'ORIGIN_ALLOWLIST',
  NEXT_PUBLIC_APP_URL: 'NEXT_PUBLIC_APP_URL',
} as const;


