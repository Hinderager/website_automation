import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim()
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      return new Response(`
        <html>
          <body>
            <h1>Authentication Error</h1>
            <p>Error: ${error}</p>
            <p><a href="/debug">Go back to debug page</a></p>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    if (!code) {
      return new Response(`
        <html>
          <body>
            <h1>Authentication Error</h1>
            <p>No authorization code received</p>
            <p><a href="/debug">Go back to debug page</a></p>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response(`
        <html>
          <body>
            <h1>Configuration Error</h1>
            <p>Google OAuth credentials not configured</p>
            <p><a href="/debug">Go back to debug page</a></p>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    // Use stable domain for production, actual URL for localhost
    const url = new URL(request.url)
    const isLocalhost = url.hostname === 'localhost'
    const baseUrl = isLocalhost 
      ? `${url.protocol}//${url.host}`
      : 'https://wordpress-automation-tool.vercel.app'
    const redirectUri = `${baseUrl}/api/auth/callback`

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      redirectUri
    )

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code)

    // Store the access token in a simple way for this demo
    // In production, you'd want to store this securely with the user session
    const accessToken = tokens.access_token

    return new Response(`
      <html>
        <head>
          <title>Authentication Success</title>
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 50px 20px; background: #f0f9ff; }
            .success { color: #059669; font-size: 24px; margin-bottom: 20px; }
            .message { color: #374151; font-size: 16px; margin-bottom: 30px; }
          </style>
        </head>
        <body>
          <h1 class="success">✅ Authentication Successful!</h1>
          <p class="message">You can now close this window and continue using the application.</p>
          
          <script>
            // Store token in session storage for the main page to use
            sessionStorage.setItem('google_access_token', '${accessToken}');
            
            // If this is a popup, notify the parent window and close
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'GOOGLE_AUTH_SUCCESS', 
                accessToken: '${accessToken}' 
              }, '*');
              window.close();
            } else {
              // If not a popup, redirect to main page after 2 seconds
              setTimeout(() => {
                window.location.href = '/';
              }, 2000);
            }
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    })

  } catch (error) {
    console.error('OAuth callback error:', error)
    return new Response(`
      <html>
        <body>
          <h1>Authentication Error</h1>
          <p>Failed to complete authentication: ${error instanceof Error ? error.message : 'Unknown error'}</p>
          <p><a href="/debug">Go back to debug page</a></p>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    })
  }
}