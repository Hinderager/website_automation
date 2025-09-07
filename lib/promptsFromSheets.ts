import { google } from 'googleapis'
import { getValidAccessToken } from './tokenManager'

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

export interface PromptData {
  fieldId: string
  fieldTitle: string
  prompt: string
  example: string
  isSubtitlesOnly: boolean
}

export interface PromptsResult {
  prompts: PromptData[]
  error?: string
  accessMethod: string
}

export async function getPromptsFromSheet(accessToken?: string, tokenDataJson?: string): Promise<PromptsResult> {
  console.log('Fetching prompts from Google Sheets')
  
  try {
    
    // Check if credentials are configured
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return {
        prompts: [],
        accessMethod: 'Google Sheets API v4 (OAuth credentials not configured)',
        error: 'Google OAuth credentials not configured. Need GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.'
      }
    }

    if (!GOOGLE_SHEET_ID) {
      return {
        prompts: [],
        accessMethod: 'Google Sheets API v4 (sheet ID not configured)',
        error: 'GOOGLE_SHEET_ID not configured in environment variables.'
      }
    }

    if (!accessToken) {
      return {
        prompts: [],
        accessMethod: 'Google Sheets API v4 (no access token)',
        error: 'No access token provided. User needs to authenticate with Google.'
      }
    }

    // Get a valid access token (refresh if necessary)
    const validAccessToken = await getValidAccessToken(accessToken, tokenDataJson)

    // Set up OAuth authentication
    const auth = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET
    )

    // Set the access token (possibly refreshed)
    auth.setCredentials({
      access_token: validAccessToken
    })

    const sheets = google.sheets({ version: 'v4', auth })

    console.log(`Prompts API: Fetching data from Prompts tab, sheet ID: ${GOOGLE_SHEET_ID}`)

    // Get data from the Prompts sheet, columns B, C, D
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: 'Prompts!B:D', // Columns B, C, D from Prompts tab
    })

    const rows = response.data.values || []
    console.log(`Prompts API: Retrieved ${rows.length} rows from Prompts tab`)

    if (rows.length === 0) {
      return {
        prompts: [],
        accessMethod: 'Google Sheets API v4 OAuth',
        error: 'No data found in the Prompts sheet'
      }
    }

    // Log first few rows for debugging
    console.log(`Prompts API: First 3 rows:`, rows.slice(0, 3).map((row, i) => `Row ${i + 1}: ${JSON.stringify(row)}`))

    const prompts: PromptData[] = []

    // Process each row (skip header row if needed)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const fieldTitle = row[0] || '' // Column B (field/title)
      const prompt = row[1] || ''      // Column C (prompt)
      const example = row[2] || ''     // Column D (example)
      
      // Skip empty rows or header rows
      if (!fieldTitle.trim() || !prompt.trim()) {
        continue
      }
      
      // Check if this is row 17 (index 16) - the "with subtitles" special case
      const isSubtitlesOnly = (i + 1) === 17
      
      // Special case: Row 13 (index 12) - C13 is the pic1 prompt that generates 4 titles + summaries for all picture fields
      if ((i + 1) === 13) {
        // Create prompts for all 4 picture fields using the same C13 prompt
        const pictureFields = ['pic1', 'pic2', 'pic3', 'pic4']
        for (const picField of pictureFields) {
          prompts.push({
            fieldId: picField,
            fieldTitle: picField,
            prompt: prompt.trim(),
            example: example.trim(),
            isSubtitlesOnly: false
          })
          console.log(`Prompts API: Found C13 prompt for ${picField} (generates 4 titles + summaries)`)
        }
        continue
      }
      
      // Map field titles to field IDs based on existing implementation
      const fieldMapping = mapFieldTitleToId(fieldTitle, isSubtitlesOnly)
      
      if (fieldMapping) {
        // Skip picture fields if they were already handled by C13
        if (['pic1', 'pic2', 'pic3', 'pic4'].includes(fieldMapping)) {
          console.log(`Prompts API: Skipping ${fieldMapping} - already handled by C13`)
          continue
        }
        
        // Single field mapping
        prompts.push({
          fieldId: fieldMapping,
          fieldTitle: fieldTitle.trim(),
          prompt: prompt.trim(),
          example: example.trim(),
          isSubtitlesOnly
        })
        
        console.log(`Prompts API: Found prompt for ${fieldMapping} (${fieldTitle})${isSubtitlesOnly ? ' [subtopics only]' : ''}`)
      }
    }

    console.log(`Prompts API: Successfully processed ${prompts.length} prompts`)

    return {
      prompts,
      accessMethod: 'Google Sheets API v4 OAuth'
    }

  } catch (error) {
    console.error('Prompts API error:', error)
    
    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return {
      prompts: [],
      accessMethod: 'Google Sheets API v4 OAuth (failed)',
      error: `API Error: ${errorMessage}`
    }
  }
}

function mapFieldTitleToId(
  fieldTitle: string, 
  isSubtitlesOnly: boolean
): string | null {
  const title = fieldTitle.toLowerCase().trim()
  
  // Map common field titles to single field IDs
  const titleMappings: Record<string, string> = {
    'title': 'title',
    'wtitle': 'title', // "with subtopics" flow title
    'introduction': 'intro',
    'intro': 'intro',
    'entro': 'intro', // Map "entro" from Google Sheet to "intro" field
    'wentro': 'intro', // "with subtopics" flow intro
    'picture 1': 'pic1',
    'picture 2': 'pic2',
    'picture 3': 'pic3',
    'picture 4': 'pic4',
    'pic1': 'pic1',
    'pic2': 'pic2',
    'pic3': 'pic3',
    'pic4': 'pic4',
    'wpic1': 'pic1', // "with subtopics" flow pic1
    'wpic2': 'pic2', // "with subtopics" flow pic2
    'wpic3': 'pic3', // "with subtopics" flow pic3
    'wpic4': 'pic4', // "with subtopics" flow pic4
    'cost': 'cost',
    'cost information': 'cost',
    'wcost': 'cost', // "with subtopics" flow cost
    'why': 'why',
    'why choose us': 'why',
    'wwhy': 'why', // "with subtopics" flow why
    'faq': 'faq',
    'faqs': 'faq',
    'wfaq': 'faq', // "with subtopics" flow faq
    'subtopics': 'subtopics', // Only available for "with subtopics" flow
    'sub': 'subtopics'
  }
  
  // Check for direct matches
  const fieldId = titleMappings[title]
  if (fieldId) {
    if (isSubtitlesOnly) {
      // Row 17 special case - only return if it's the subtopics field
      return fieldId === 'subtopics' ? 'subtopics' : null
    } else {
      // Return the field ID
      return fieldId
    }
  }
  
  // If no mapping found, try partial matches
  for (const [key, fieldId] of Object.entries(titleMappings)) {
    if (title.includes(key) || key.includes(title)) {
      if (isSubtitlesOnly) {
        return fieldId === 'subtopics' ? 'subtopics' : null
      } else {
        return fieldId
      }
    }
  }
  
  console.log(`Prompts API: Could not map field title "${fieldTitle}" to a field ID`)
  return null
}

// Function to get a specific prompt by field ID and flow
export async function getPromptForField(
  fieldId: string, 
  flow: 'with subtopics' | 'no subtopics',
  accessToken?: string,
  tokenDataJson?: string
): Promise<{ prompt: string; example: string; error?: string }> {
  const result = await getPromptsFromSheet(accessToken, tokenDataJson)
  
  if (result.error) {
    return { prompt: '', example: '', error: result.error }
  }
  
  // Find the prompt that matches the field ID and flow
  const promptData = result.prompts.find(p => {
    // For subtopics-only prompts (row 17), only return for "with subtopics" flow
    if (p.isSubtitlesOnly) {
      return flow === 'with subtopics' && p.fieldId === fieldId
    }
    
    // For regular prompts, check if the field ID matches
    return p.fieldId === fieldId
  })
  
  if (!promptData) {
    return { 
      prompt: '', 
      example: '', 
      error: `No prompt found for field "${fieldId}" in flow "${flow}"` 
    }
  }
  
  return {
    prompt: promptData.prompt,
    example: promptData.example
  }
}