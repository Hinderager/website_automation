/**
 * Startup validation for API keys and environment variables
 * This runs when the application starts to ensure all required keys are present
 */

import { getApiKeys, ENV_VARS } from './apiKeys';

/**
 * Validates all API keys on application startup
 * Logs warnings for missing optional keys and errors for missing required keys
 */
export function validateStartupKeys(): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // This will throw if any required keys are missing
    const keys = getApiKeys();
    
    // Check for optional keys and log warnings
    if (!process.env[ENV_VARS.APP_PASSWORD]) {
      warnings.push('APP_PASSWORD not set - authentication disabled');
    }
    
    if (!process.env[ENV_VARS.ORIGIN_ALLOWLIST]) {
      warnings.push('ORIGIN_ALLOWLIST not set - CORS restrictions disabled');
    }
    
    if (!process.env[ENV_VARS.ANTHROPIC_MODEL]) {
      warnings.push('ANTHROPIC_MODEL not set - using default model');
    }
    
    if (!process.env[ENV_VARS.FREEPIK_IMAGE_MODEL]) {
      warnings.push('FREEPIK_IMAGE_MODEL not set - using default model');
    }
    
    if (!process.env[ENV_VARS.FREEPIK_ASPECT_RATIO]) {
      warnings.push('FREEPIK_ASPECT_RATIO not set - using default aspect ratio');
    }

    console.log('✅ All required API keys are configured');
    
    if (warnings.length > 0) {
      console.log('⚠️  Optional configuration warnings:');
      warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    return { isValid: true, errors, warnings };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during key validation';
    errors.push(errorMessage);
    
    console.error('❌ API key validation failed:');
    console.error(`   ${errorMessage}`);
    
    return { isValid: false, errors, warnings };
  }
}

/**
 * Gets a summary of all configured API keys (without exposing the actual keys)
 */
export function getKeyStatus(): Record<string, { configured: boolean; type: 'required' | 'optional' }> {
  return {
    [ENV_VARS.ANTHROPIC_API_KEY]: {
      configured: !!process.env[ENV_VARS.ANTHROPIC_API_KEY],
      type: 'required'
    },
    [ENV_VARS.FREEPIK_API_KEY]: {
      configured: !!process.env[ENV_VARS.FREEPIK_API_KEY],
      type: 'required'
    },
    [ENV_VARS.FREEPIK_WEBHOOK_SECRET]: {
      configured: !!process.env[ENV_VARS.FREEPIK_WEBHOOK_SECRET],
      type: 'required'
    },
    [ENV_VARS.GOOGLE_DOC_URL]: {
      configured: !!process.env[ENV_VARS.GOOGLE_DOC_URL],
      type: 'required'
    },
    [ENV_VARS.APP_PASSWORD]: {
      configured: !!process.env[ENV_VARS.APP_PASSWORD],
      type: 'optional'
    },
    [ENV_VARS.ORIGIN_ALLOWLIST]: {
      configured: !!process.env[ENV_VARS.ORIGIN_ALLOWLIST],
      type: 'optional'
    },
    [ENV_VARS.ANTHROPIC_MODEL]: {
      configured: !!process.env[ENV_VARS.ANTHROPIC_MODEL],
      type: 'optional'
    },
    [ENV_VARS.FREEPIK_IMAGE_MODEL]: {
      configured: !!process.env[ENV_VARS.FREEPIK_IMAGE_MODEL],
      type: 'optional'
    },
    [ENV_VARS.FREEPIK_ASPECT_RATIO]: {
      configured: !!process.env[ENV_VARS.FREEPIK_ASPECT_RATIO],
      type: 'optional'
    },
  };
}


