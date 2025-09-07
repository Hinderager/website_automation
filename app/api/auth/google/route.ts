import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim()
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim()

export async function GET(request: NextRequest) {
  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Google OAuth credentials not configured' },
        { status: 500 }
      )
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

    // Get the default login email from environment
    const DEFAULT_LOGIN_EMAIL = process.env.DEFAULT_LOGIN_EMAIL || 'allusers@topshelfpros.com'
    
    // Generate the URL for Google OAuth consent
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/documents.readonly'
      ],
      login_hint: DEFAULT_LOGIN_EMAIL, // Suggest the default email
      state: 'debug' // You can use this to track where the auth came from
    })

    return NextResponse.json({ authUrl })

  } catch (error) {
    console.error('OAuth setup error:', error)
    return NextResponse.json(
      { error: 'Failed to setup OAuth authentication' },
      { status: 500 }
    )
  }
}