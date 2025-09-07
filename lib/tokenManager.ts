import { google } from 'googleapis';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim();

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  timestamp?: number;
}

export interface RefreshResult {
  accessToken: string;
  success: boolean;
  error?: string;
}

/**
 * Check if a token is expired or will expire soon (within 5 minutes)
 */
export function isTokenExpired(tokenData: TokenData): boolean {
  if (!tokenData.expiryDate) {
    // If no expiry date, assume it might be expired after 1 hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    return (tokenData.timestamp || 0) < oneHourAgo;
  }
  
  // Check if token expires within next 5 minutes (300,000 ms)
  const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
  return tokenData.expiryDate < fiveMinutesFromNow;
}

/**
 * Refresh an expired access token using the refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return {
        accessToken: '',
        success: false,
        error: 'Google OAuth credentials not configured'
      };
    }

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET
    );

    // Set the refresh token
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    // Refresh the access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    const newAccessToken = credentials.access_token;
    
    if (!newAccessToken) {
      return {
        accessToken: '',
        success: false,
        error: 'No access token returned from refresh'
      };
    }

    console.log('Token refreshed successfully');
    
    return {
      accessToken: newAccessToken,
      success: true
    };

  } catch (error) {
    console.error('Token refresh error:', error);
    
    return {
      accessToken: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown refresh error'
    };
  }
}

/**
 * Get a valid access token, refreshing if necessary
 * This function should be used by all Google API calls
 */
export async function getValidAccessToken(accessToken: string, tokenDataJson?: string): Promise<string> {
  // If we don't have token data for expiry checking, just return the provided token
  if (!tokenDataJson) {
    console.log('No token data available for expiry check, using provided token');
    return accessToken;
  }

  try {
    const tokenData: TokenData = JSON.parse(tokenDataJson);
    
    // Check if token is expired
    if (!isTokenExpired(tokenData)) {
      console.log('Token is still valid');
      return accessToken;
    }

    console.log('Token appears to be expired, attempting refresh...');

    // Try to refresh the token
    if (!tokenData.refreshToken) {
      console.log('No refresh token available, cannot refresh');
      return accessToken; // Return original token as fallback
    }

    const refreshResult = await refreshAccessToken(tokenData.refreshToken);
    
    if (refreshResult.success) {
      console.log('Token refreshed successfully');
      return refreshResult.accessToken;
    } else {
      console.log('Token refresh failed:', refreshResult.error);
      return accessToken; // Return original token as fallback
    }

  } catch (error) {
    console.error('Error in getValidAccessToken:', error);
    return accessToken; // Return original token as fallback
  }
}