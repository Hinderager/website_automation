import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const preAuthAccessToken = process.env.GOOGLE_ACCESS_TOKEN
    const preAuthRefreshToken = process.env.GOOGLE_REFRESH_TOKEN

    if (preAuthAccessToken) {
      console.log('Using pre-authenticated tokens from environment variables')
      
      return NextResponse.json({
        access_token: preAuthAccessToken,
        refresh_token: preAuthRefreshToken,
        method: 'pre-authenticated',
        message: 'Using tokens from environment variables (development mode)'
      })
    }

    return NextResponse.json({
      method: 'oauth-required',
      message: 'No pre-authenticated tokens found. OAuth flow required.',
      authUrl: '/api/auth/google'
    })

  } catch (error) {
    console.error('Token retrieval error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve authentication tokens' },
      { status: 500 }
    )
  }
}