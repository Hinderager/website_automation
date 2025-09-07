import { NextRequest, NextResponse } from 'next/server'
import { detectCategoryFromDoc } from '@/lib/googleDoc'
import { debugGoogleSheetsAPI } from '@/lib/googleSheets'
import { getKeyStatus, validateStartupKeys } from '@/lib/startupValidation'

interface DebugResult {
  apiKeys: {
    status: Record<string, { configured: boolean; type: 'required' | 'optional' }>
    validation: { isValid: boolean; errors: string[]; warnings: string[] }
  }
  googleDoc: {
    url: string
    accessMethod: string
    classification: string
    reason: string
    error?: string
  }
  googleSheet: {
    url: string
    accessMethod: string
    columnForKeyword: string
    rowFound: number | null
    columnHHasContent: boolean
    columnHContents: string[]
    error?: string
    totalRows?: number
    keywordCell?: string | null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { keyword, accessToken } = body

    if (!keyword || typeof keyword !== 'string') {
      return NextResponse.json(
        { error: 'Keyword is required and must be a string' },
        { status: 400 }
      )
    }

    console.log(`Debug API: Processing keyword: ${keyword}`)

    // Debug API Keys status
    const apiKeyStatus = getKeyStatus()
    const apiKeyValidation = validateStartupKeys()

    // Debug Google Doc classification
    let googleDocResult
    try {
      const docUrl = process.env.GOOGLE_DOC_URL || 'https://docs.google.com/document/d/e/2PACX-1vQ1AgoSsHbr-Q5KrZ9I76WULb4vXJYkIR7ztkSdnF7pw_MG3Ji0Lss9qDthDP6QZ_bx1aQQiaFEsvCU/pub'
      const classification = await detectCategoryFromDoc(docUrl, keyword, accessToken)
      
      googleDocResult = {
        url: docUrl,
        accessMethod: accessToken ? 'Google Docs API v1 OAuth' : 'Google Docs API v1 (no access token)',
        classification: classification.category || 'error',
        reason: classification.reason,
        error: classification.category ? undefined : 'Classification failed'
      }
    } catch (error) {
      googleDocResult = {
        url: process.env.GOOGLE_DOC_URL || 'Not configured',
        accessMethod: 'Google Docs API v1 (failed)',
        classification: 'error',
        reason: 'Failed to fetch or parse document',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Debug Google Sheets integration using new API
    const googleSheetResult = await debugGoogleSheetsAPI(keyword, accessToken)

    const result: DebugResult = {
      apiKeys: {
        status: apiKeyStatus,
        validation: apiKeyValidation
      },
      googleDoc: googleDocResult,
      googleSheet: googleSheetResult
    }

    console.log(`Debug API: Returning result:`, JSON.stringify(result, null, 2))

    return NextResponse.json(result)

  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}