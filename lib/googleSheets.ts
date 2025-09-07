import { google } from 'googleapis'

// Google Sheets configuration
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID?.trim()
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim()
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim()

export interface CompetitorResult {
  competitorUrls: string[];
  found: boolean;
  matchedKeyword?: string | null;
  rowNumber?: number;
  error?: string;
  accessMethod?: string;
  totalRows?: number;
}

interface GoogleSheetsResult {
  found: boolean
  rowNumber?: number
  keywordCell?: string | null
  competitorUrls: string[]
  error?: string
  totalRows: number
  accessMethod: string
}

export async function getCompetitorUrlsFromSheets(keyword: string, accessToken?: string): Promise<GoogleSheetsResult> {
  console.log(`Google Sheets API: Looking for keyword "${keyword}"`)
  
  try {
    // Check if credentials are configured
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return {
        found: false,
        competitorUrls: [],
        totalRows: 0,
        accessMethod: 'Google Sheets API v4 (OAuth credentials not configured)',
        error: 'Google OAuth credentials not configured. Need GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.'
      }
    }

    if (!GOOGLE_SHEET_ID) {
      return {
        found: false,
        competitorUrls: [],
        totalRows: 0,
        accessMethod: 'Google Sheets API v4 (sheet ID not configured)',
        error: 'GOOGLE_SHEET_ID not configured in environment variables.'
      }
    }

    if (!accessToken) {
      return {
        found: false,
        competitorUrls: [],
        totalRows: 0,
        accessMethod: 'Google Sheets API v4 (no access token)',
        error: 'No access token provided. User needs to authenticate with Google.'
      }
    }

    // Set up OAuth authentication - redirect URI not needed for token usage
    const auth = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET
    )

    // Set the access token
    auth.setCredentials({
      access_token: accessToken
    })

    const sheets = google.sheets({ version: 'v4', auth })

    console.log(`Google Sheets API: Fetching data from sheet ID: ${GOOGLE_SHEET_ID}`)

    // Get data from columns D and H (keyword and competitor URLs)
    // Try without sheet name first (uses the first/default sheet)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: 'D:H', // Columns D through H on the first/default sheet
    })

    const rows = response.data.values || []
    console.log(`Google Sheets API: Retrieved ${rows.length} rows`)

    if (rows.length === 0) {
      return {
        found: false,
        competitorUrls: [],
        totalRows: 0,
        accessMethod: 'Google Sheets API v4 OAuth',
        error: 'No data found in the spreadsheet'
      }
    }

    // Log first few rows for debugging
    console.log(`Google Sheets API: First 3 rows:`, rows.slice(0, 3).map((row, i) => `Row ${i + 1}: ${JSON.stringify(row)}`))

    // Search for keyword in column D (index 0 in our range D:H)
    let foundRow: number | null = null
    let keywordCell: string | null = null
    let competitorUrls: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const cellD = row[0] || '' // Column D (index 0 in D:H range)
      
      if (cellD.toLowerCase().includes(keyword.toLowerCase())) {
        foundRow = i + 1 // 1-based row number
        keywordCell = cellD
        
        console.log(`Google Sheets API: Found keyword in row ${foundRow}, column D: "${cellD}"`)
        
        // Get column H contents (index 4 in D:H range)
        const cellH = row[4] || '' // Column H
        
        if (cellH.trim()) {
          // Split URLs by common separators
          const urls = cellH.split(/[\n\r,;]+/)
            .map((url: string) => url.trim())
            .filter((url: string) => url.length > 0 && (url.startsWith('http') || url.includes('.')))
          
          competitorUrls = urls
          console.log(`Google Sheets API: Found ${urls.length} competitor URLs in column H: ${JSON.stringify(urls)}`)
        } else {
          console.log(`Google Sheets API: Column H is empty for row ${foundRow}`)
        }
        break
      }
    }

    if (foundRow === null) {
      console.log(`Google Sheets API: Keyword "${keyword}" not found in column D`)
      return {
        found: false,
        competitorUrls: [],
        totalRows: rows.length,
        accessMethod: 'Google Sheets API v4 OAuth',
        error: `Keyword "${keyword}" not found in column D`
      }
    }

    return {
      found: true,
      rowNumber: foundRow,
      keywordCell,
      competitorUrls,
      totalRows: rows.length,
      accessMethod: 'Google Sheets API v4 OAuth'
    }

  } catch (error) {
    console.error('Google Sheets API error:', error)
    
    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return {
      found: false,
      competitorUrls: [],
      totalRows: 0,
      accessMethod: 'Google Sheets API v4 OAuth (failed)',
      error: `API Error: ${errorMessage}`
    }
  }
}

// Legacy function for backwards compatibility - now uses API
export async function fetchCompetitorUrls(sheetUrl: string, primaryKeyword: string): Promise<CompetitorResult> {
  console.log(`Legacy fetchCompetitorUrls called - redirecting to API method`)
  
  const result = await getCompetitorUrlsFromSheets(primaryKeyword)
  
  return {
    competitorUrls: result.competitorUrls,
    found: result.found,
    matchedKeyword: result.keywordCell,
    rowNumber: result.rowNumber,
    error: result.error,
    accessMethod: result.accessMethod,
    totalRows: result.totalRows
  }
}

// Debug function that returns detailed information for the debug page
export async function debugGoogleSheetsAPI(keyword: string, accessToken?: string) {
  console.log(`Google Sheets Debug: Processing keyword "${keyword}"`)
  
  const result = await getCompetitorUrlsFromSheets(keyword, accessToken)
  
  return {
    url: `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/edit`,
    accessMethod: result.accessMethod,
    columnForKeyword: 'Column D',
    rowFound: result.rowNumber || null,
    columnHHasContent: result.competitorUrls.length > 0,
    columnHContents: result.competitorUrls,
    error: result.error,
    totalRows: result.totalRows,
    keywordCell: result.keywordCell
  }
}