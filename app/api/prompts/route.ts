import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1iFmNPkM4OuxZDpP43Z45-Fs-imENfxz-t0EaNfPbFsc';

export async function POST(req: NextRequest) {
  try {
    const { fieldId, accessToken } = await req.json();
    
    if (!fieldId) {
      return NextResponse.json(
        { error: 'Field ID is required' },
        { status: 400 }
      );
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 401 }
      );
    }

    // Create OAuth2 client with access token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: accessToken
    });

    // Initialize Google Sheets API with OAuth client
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // Read the Prompts tab
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Prompts!B:D', // Read columns B (Field), C (Prompt), and D (Example)
    });

    const rows = response.data.values;
    
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'No data found in Prompts tab' },
        { status: 404 }
      );
    }

    // Find the row that matches the fieldId
    // Skip header row (index 0)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cellFieldId = row[0]?.toLowerCase().trim();
      
      // Map the field names to match what's in the spreadsheet
      const mappedFieldId = mapFieldId(fieldId);
      
      if (cellFieldId === mappedFieldId.toLowerCase()) {
        const prompt = row[1] || '';
        const example = row[2] || '';
        
        return NextResponse.json({
          success: true,
          fieldId,
          prompt,
          example,
          foundAt: `Row ${i + 1}`
        });
      }
    }

    return NextResponse.json(
      { error: `No prompt found for field "${fieldId}"` },
      { status: 404 }
    );

  } catch (error) {
    console.error('Error fetching prompts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prompts from Google Sheets' },
      { status: 500 }
    );
  }
}

// Map our internal field IDs to what's in the spreadsheet
function mapFieldId(fieldId: string): string {
  const mappings: Record<string, string> = {
    'wtitle': 'Title (with subtopics)',
    'wentro': 'Introduction (with subtopics)',
    'wpic1': 'Picture 1 (with subtopics)',
    'wpic2': 'Picture 2 (with subtopics)',
    'wpic3': 'Picture 3 (with subtopics)',
    'wpic4': 'Picture 4 (with subtopics)',
    'sub': 'Subtopics',
    'wcost': 'Cost (with subtopics)',
    'wwhy': 'Why (with subtopics)',
    'wfaq': 'FAQ (with subtopics)',
    'title': 'Title (no subtopics)',
    'entro': 'Introduction (no subtopics)',
    'pic1': 'Picture 1 (no subtopics)',
    'pic2': 'Picture 2 (no subtopics)',
    'pic3': 'Picture 3 (no subtopics)',
    'pic4': 'Picture 4 (no subtopics)',
    'cost': 'Cost (no subtopics)',
    'why': 'Why (no subtopics)',
    'faq': 'FAQ (no subtopics)'
  };
  
  return mappings[fieldId] || fieldId;
}