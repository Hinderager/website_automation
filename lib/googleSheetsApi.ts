import { google } from 'googleapis';

export interface CompetitorResult {
  competitorUrls: string[];
  found: boolean;
  matchedKeyword?: string;
  rowNumber?: number;
  error?: string;
}

// Extract Sheet ID from various Google Sheets URL formats
function extractSheetId(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error('Invalid Google Sheets URL');
  }
  return match[1];
}


export async function fetchCompetitorUrlsFromSheetsApi(
  sheetUrl: string, 
  primaryKeyword: string
): Promise<CompetitorResult> {
  try {
    console.log('Sheets API Debug - Looking for keyword:', primaryKeyword);
    
    // Extract sheet ID from URL
    const sheetId = extractSheetId(sheetUrl);
    console.log('Sheets API Debug - Sheet ID:', sheetId);
    
    // Use API key for public sheet access
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    
    if (!apiKey) {
      console.log('Sheets API Debug - API key not found in environment variables');
      return {
        competitorUrls: [],
        found: false,
        error: 'GOOGLE_SHEETS_API_KEY environment variable not set'
      };
    }
    
    if (apiKey.includes('placeholder') || apiKey.includes('temporary')) {
      console.log('Sheets API Debug - API key is placeholder, returning fallback');
      return {
        competitorUrls: [],
        found: false,
        error: 'Google Sheets API key not configured. Please set GOOGLE_SHEETS_API_KEY environment variable with a valid API key from Google Cloud Console.'
      };
    }
    
    // Create Google Sheets API client
    const sheets = google.sheets({ version: 'v4' });
    
    // Read ALL data from the sheet - no limits
    const range = 'A:Z'; // Read all columns
    console.log('Sheets API Debug - Attempting to read from sheet ID:', sheetId);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
      key: apiKey,
    });
    
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return {
        competitorUrls: [],
        found: false,
        error: 'No data found in spreadsheet'
      };
    }
    
    console.log('Sheets API Debug - Total rows found:', rows.length);
    console.log('Sheets API Debug - First 5 rows:', rows.slice(0, 5));
    
    const keywordLower = primaryKeyword.toLowerCase().trim();
    
    // COMPREHENSIVE SEARCH - check for "mattress" anywhere if keyword contains it
    if (keywordLower.includes('mattress')) {
      console.log('Sheets API Debug - COMPREHENSIVE MATTRESS SEARCH across ALL rows and columns...');
      let mattressFoundCount = 0;
      for (let i = 0; i < rows.length; i++) { // NO LIMIT - search ALL rows
        const row = rows[i];
        for (let j = 0; j < row.length; j++) {
          const cell = row[j]?.toString().toLowerCase();
          if (cell && cell.includes('mattress')) {
            mattressFoundCount++;
            console.log(`Sheets API Debug - MATTRESS FOUND #${mattressFoundCount} in Row ${i + 1}, Column ${String.fromCharCode(65 + j)}: "${row[j]}"`);
          }
        }
      }
      console.log(`Sheets API Debug - Total "mattress" occurrences found: ${mattressFoundCount}`);
    }
    
    // Also search for partial matches in Column D
    console.log('Sheets API Debug - Searching Column D for partial matches containing "mattress"...');
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.length > 3) {
        const columnD = row[3]?.toString().toLowerCase().trim();
        if (columnD && columnD.includes('mattress')) {
          console.log(`Sheets API Debug - PARTIAL MATCH in Column D, Row ${i + 1}: "${row[3]}"`);
        }
      }
    }
    
    // Search for exact match in Column D (index 3) only - ALL rows, no limit
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      if (row.length > 3) {
        const columnD = row[3]?.toString().toLowerCase().trim();
        
        // Only log specific debugging for potential matches
        if (columnD && (columnD.includes('mattress') || columnD === keywordLower)) {
          console.log(`Sheets API Debug - Row ${i + 1}: Column D = "${columnD}"`);
        }
        
        // Letter-for-letter exact match (case-insensitive) in Column D
        if (columnD === keywordLower) {
          console.log(`Sheets API Debug - EXACT MATCH found in row ${i + 1}!`);
          
          // Get competitor URLs from Column H (index 7)
          const columnH = row[7]?.toString().trim();
          
          if (columnH) {
            // Split competitor URLs - handle multiple formats
            const competitorUrls = columnH
              .split(/[\n\r]+/) // Split by line breaks first
              .flatMap((line: string) => line.split(/[,;]+/)) // Then split by commas/semicolons
              .map((url: string) => url.trim())
              .filter((url: string) => url.length > 0)
              .filter((url: string) => 
                url.toLowerCase().startsWith('http') || 
                url.includes('.com') || 
                url.includes('.net') || 
                url.includes('.org')
              );
            
            console.log(`Sheets API Debug - Found ${competitorUrls.length} URLs:`, competitorUrls);
            
            return {
              competitorUrls,
              found: true,
              matchedKeyword: row[3]?.toString().trim(),
              rowNumber: i + 1
            };
          } else {
            console.log(`Sheets API Debug - Column H is empty for row ${i + 1}`);
            return {
              competitorUrls: [],
              found: true,
              matchedKeyword: row[3]?.toString().trim(),
              rowNumber: i + 1,
              error: 'No competitor URLs found in Column H'
            };
          }
        }
      }
    }
    
    // Keyword not found
    console.log(`Sheets API Debug - Keyword "${primaryKeyword}" not found in Column D`);
    return {
      competitorUrls: [],
      found: false,
      error: `Keyword "${primaryKeyword}" not found in Column D`
    };
    
  } catch (error) {
    console.error('Google Sheets API error:', error);
    return {
      competitorUrls: [],
      found: false,
      error: `API error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
