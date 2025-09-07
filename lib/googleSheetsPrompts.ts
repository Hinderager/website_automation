import { google } from 'googleapis'

// Google Sheets configuration
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID?.trim()
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim()
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim()

export interface PromptResult {
  prompt: string | null
  example: string | null
  found: boolean
  error?: string
}

// Map internal field IDs to spreadsheet field names
// Now using simplified field names - the same for both flows
function mapFieldId(fieldId: string): string {
  const mappings: Record<string, string> = {
    'title': 'Title',
    'intro': 'Intro',
    'pic1': 'Pic1',
    'pic2': 'Pic2',
    'pic3': 'Pic3',
    'pic4': 'Pic4',
    'pictures': 'Pictures',  // Combined prompt for all pictures in C13
    'subtopics': 'Subtopics',
    'cost': 'Cost',
    'why': 'Why',
    'faq': 'FAQ'
  }
  
  return mappings[fieldId] || fieldId
}

export async function getPromptFromSheets(fieldId: string, accessToken: string): Promise<PromptResult> {
  console.log(`Google Sheets Prompts API: Looking for field "${fieldId}"`)
  
  try {
    // Check if credentials are configured
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return {
        found: false,
        prompt: null,
        example: null,
        error: 'Google OAuth credentials not configured'
      }
    }

    if (!GOOGLE_SHEET_ID) {
      return {
        found: false,
        prompt: null,
        example: null,
        error: 'GOOGLE_SHEET_ID not configured'
      }
    }

    if (!accessToken) {
      return {
        found: false,
        prompt: null,
        example: null,
        error: 'No access token provided'
      }
    }

    // Set up OAuth authentication
    const auth = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET
    )

    // Set the access token
    auth.setCredentials({
      access_token: accessToken
    })

    const sheets = google.sheets({ version: 'v4', auth })

    console.log(`Google Sheets Prompts API: Fetching from sheet ID: ${GOOGLE_SHEET_ID}`)

    // Get data from the Prompts tab, columns B:D
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: 'Prompts!B:D', // Prompts tab, columns B (Field), C (Prompt), D (Example)
    })

    const rows = response.data.values || []
    console.log(`Google Sheets Prompts API: Retrieved ${rows.length} rows from Prompts tab`)

    if (rows.length === 0) {
      return {
        found: false,
        prompt: null,
        example: null,
        error: 'No data found in Prompts tab'
      }
    }

    // Map the field ID to match spreadsheet naming
    const mappedFieldId = mapFieldId(fieldId)
    console.log(`Google Sheets Prompts API: Looking for "${mappedFieldId}" (mapped from "${fieldId}")`)

    // Search for the field in column B (index 0)
    for (let i = 1; i < rows.length; i++) { // Skip header row
      const row = rows[i]
      if (!row || row.length < 2) continue
      
      const cellB = row[0] || '' // Column B - Field name
      
      // Case-insensitive comparison
      if (cellB.toLowerCase().trim() === mappedFieldId.toLowerCase()) {
        const prompt = row[1] || '' // Column C - Prompt
        const example = row[2] || '' // Column D - Example
        
        console.log(`Google Sheets Prompts API: Found field in row ${i + 1}`)
        console.log(`Google Sheets Prompts API: Prompt length: ${prompt.length} chars`)
        
        if (!prompt) {
          return {
            found: false,
            prompt: null,
            example: null,
            error: `Field "${fieldId}" found but prompt is empty`
          }
        }
        
        return {
          found: true,
          prompt: prompt,
          example: example || null
        }
      }
    }

    console.log(`Google Sheets Prompts API: Field "${mappedFieldId}" not found in Prompts tab`)
    
    // Log available fields for debugging
    const availableFields = rows.slice(1, Math.min(10, rows.length)).map(r => r[0]).filter(f => f)
    console.log(`Google Sheets Prompts API: Available fields:`, availableFields)
    
    return {
      found: false,
      prompt: null,
      example: null,
      error: `Field "${fieldId}" (mapped to "${mappedFieldId}") not found in Prompts tab`
    }

  } catch (error) {
    console.error('Google Sheets Prompts API error:', error)
    
    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      errorMessage = error.message
      
      // Check for specific error types
      if (errorMessage.includes('invalid_grant') || errorMessage.includes('Token has been expired')) {
        errorMessage = 'Authentication expired. Please re-authenticate.'
      } else if (errorMessage.includes('Permission denied') || errorMessage.includes('Forbidden')) {
        errorMessage = 'Permission denied. Ensure the sheet is shared with your account.'
      }
    }

    return {
      found: false,
      prompt: null,
      example: null,
      error: errorMessage
    }
  }
}