import { google } from 'googleapis'

export interface ClassificationResult {
  category: 'with subtopics' | 'no subtopics' | null;
  reason: string;
  context?: string[];
  matchedLine?: string;
  lineNumber?: number;
  subtopics?: string[];
}

// Extract document ID from various Google Docs URL formats
function extractDocumentId(docUrl: string): string | null {
  console.log('Google Doc Debug - Extracting document ID from URL:', docUrl);
  
  const patterns = [
    /\/document\/d\/([a-zA-Z0-9-_]+)/, // Regular format: /d/{id}/edit
    /\/document\/d\/e\/([a-zA-Z0-9-_]+)/, // Published format: /d/e/{id}/pub
  ];
  
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = docUrl.match(pattern);
    if (match) {
      const extractedId = match[1];
      console.log(`Google Doc Debug - Pattern ${i + 1} matched, extracted document ID:`, extractedId);
      
      // Special handling for the correct document ID
      if (extractedId === '2PACX-1vQ1AgoSsHbr-Q5KrZ9I76WULb4vXJYkIR7ztkSdnF7pw_MG3Ji0Lss9qDthDP6QZ_bx1aQQiaFEsvCU') {
        console.log('Google Doc Debug - Using correct document ID for API access');
      }
      
      return extractedId;
    } else {
      console.log(`Google Doc Debug - Pattern ${i + 1} did not match:`, pattern.toString());
    }
  }
  
  console.log('Google Doc Debug - Could not extract document ID from URL');
  return null;
}

export async function detectCategoryFromDoc(docUrl: string, keyword: string, accessToken?: string): Promise<ClassificationResult> {
  try {
    console.log('Google Doc Debug - Processing keyword:', keyword);
    console.log('Google Doc Debug - Document URL:', docUrl);
    
    // Use the direct document ID from environment variable if available
    let documentId: string | null = process.env.GOOGLE_DOC_ID?.trim() || process.env['GOOGLE-DOC-ID']?.trim() || null;
    if (!documentId) {
      documentId = extractDocumentId(docUrl);
    }
    
    if (!documentId) {
      return {
        category: null,
        reason: 'Could not extract document ID from URL and GOOGLE_DOC_ID not set'
      };
    }
    
    // Clean the document ID - remove quotes and whitespace if present
    documentId = documentId.replace(/['"]/g, '').trim();
    
    console.log('Google Doc Debug - Document ID:', documentId);
    console.log('Google Doc Debug - Using direct document ID from env:', !!process.env.GOOGLE_DOC_ID);
    
    // Check if we have OAuth credentials
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID?.trim();
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET?.trim();
    
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return {
        category: null,
        reason: 'Google OAuth credentials not configured'
      };
    }
    
    if (!accessToken) {
      return {
        category: null,
        reason: 'No access token provided. User needs to authenticate with Google.'
      };
    }
    
    // Set up OAuth authentication
    const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ access_token: accessToken });
    
    // Initialize Google Docs API
    const docs = google.docs({ version: 'v1', auth });
    
    console.log('Google Doc Debug - Fetching document via Docs API');
    
    // Get the document
    const response = await docs.documents.get({
      documentId: documentId,
    });
    
    const document = response.data;
    if (!document || !document.body) {
      return {
        category: null,
        reason: 'Document not found or has no content'
      };
    }
    
    console.log('Google Doc Debug - Successfully retrieved document via API');
    
    // Extract text content and analyze structure
    const textElements: Array<{ text: string; isHeading: boolean; level?: number }> = [];
    
    const extractContentFromElement = (element: any, parentStyle: any = {}): void => {
      if (element.paragraph) {
        const paragraph = element.paragraph;
        let text = '';
        let isHeading = false;
        let headingLevel = 0;
        
        // Check if this paragraph is a heading
        if (paragraph.paragraphStyle?.namedStyleType) {
          const styleType = paragraph.paragraphStyle.namedStyleType;
          if (styleType.includes('HEADING')) {
            isHeading = true;
            headingLevel = parseInt(styleType.replace('HEADING_', '')) || 1;
          }
        }
        
        // Extract text from paragraph elements
        if (paragraph.elements) {
          for (const elem of paragraph.elements) {
            if (elem.textRun && elem.textRun.content) {
              text += elem.textRun.content;
            }
          }
        }
        
        text = text.trim();
        if (text) {
          textElements.push({
            text,
            isHeading,
            level: headingLevel
          });
        }
      }
      
      // Recursively process nested elements
      if (element.table) {
        element.table.tableRows?.forEach((row: any) => {
          row.tableCells?.forEach((cell: any) => {
            cell.content?.forEach((cellElement: any) => {
              extractContentFromElement(cellElement, parentStyle);
            });
          });
        });
      }
    }
    
    // Process all content elements
    if (document.body.content) {
      document.body.content.forEach(element => {
        extractContentFromElement(element);
      });
    }
    
    console.log('Google Doc Debug - Extracted', textElements.length, 'text elements');
    console.log('Google Doc Debug - First few elements:', textElements.slice(0, 5));
    
    const keywordLower = keyword.toLowerCase().trim();
    console.log('Google Doc Debug - Looking for keyword:', `"${keywordLower}"`);
    
    // Find the element containing the keyword
    const foundElement = textElements.find((element, index) => {
      const textLower = element.text.toLowerCase().trim();
      const contains = textLower.includes(keywordLower);
      
      if (contains) {
        console.log(`Google Doc Debug - Found keyword in element ${index + 1}:`);
        console.log(`  - Text: "${element.text}"`);
        console.log(`  - Is Heading: ${element.isHeading}`);
        console.log(`  - Heading Level: ${element.level || 'N/A'}`);
      }
      
      return contains;
    });
    
    if (!foundElement) {
      return {
        category: null,
        reason: `Keyword "${keyword}" not found in document`
      };
    }
    
    // Classification logic based on document structure
    let category: 'with subtopics' | 'no subtopics';
    let reason: string;
    let subtopics: string[] = [];
    
    if (foundElement.isHeading) {
      // If the keyword itself is a heading, it likely has subtopics
      category = 'with subtopics';
      reason = `"${keyword}" found as heading level ${foundElement.level} (with subtopics)`;
      
      // Extract subtopics - get all non-heading items until the next heading
      const elementIndex = textElements.findIndex(el => el === foundElement);
      console.log(`Google Doc Debug - Keyword found at index ${elementIndex}, extracting subtopics from index ${elementIndex + 1}`);
      console.log(`Google Doc Debug - Total elements: ${textElements.length}`);
      
      // Look for items after the keyword heading
      for (let i = elementIndex + 1; i < textElements.length; i++) {
        const element = textElements[i];
        console.log(`Google Doc Debug - Checking element ${i}: "${element.text.substring(0, 50)}..." isHeading=${element.isHeading}`);
        
        // Stop at the next heading (left-justified item)
        if (element.isHeading) {
          console.log(`Google Doc Debug - Stopping at next heading: "${element.text}"`);
          break;
        }
        
        // Add non-heading items as subtopics (indented/bulleted items)
        // But skip empty lines
        const trimmedText = element.text.trim();
        if (!element.isHeading && trimmedText) {
          // Only skip if it's EXACTLY the keyword (not if it just contains it)
          if (trimmedText.toLowerCase() !== keywordLower) {
            subtopics.push(trimmedText);
            console.log(`Google Doc Debug - Added subtopic ${subtopics.length}: "${trimmedText}"`);
          }
        }
      }
      
      console.log(`Google Doc Debug - Found ${subtopics.length} subtopics total`);
    } else {
      // If keyword is not a heading, it's likely a sub-item under a heading
      category = 'no subtopics';
      
      // Try to find the parent heading
      const elementIndex = textElements.findIndex(el => el === foundElement);
      let parentHeading = '';
      
      // Look backwards for the most recent heading
      for (let i = elementIndex - 1; i >= 0; i--) {
        if (textElements[i].isHeading) {
          parentHeading = textElements[i].text;
          break;
        }
      }
      
      if (parentHeading) {
        reason = `"${keyword}" found under heading "${parentHeading}" (no subtopics)`;
      } else {
        reason = `"${keyword}" found as regular content (no subtopics)`;
      }
    }
    
    console.log(`Google Doc Debug - Classification: ${category}`);
    console.log(`Google Doc Debug - Reason: ${reason}`);
    if (subtopics.length > 0) {
      console.log(`Google Doc Debug - Subtopics:`, subtopics);
    }
    
    return {
      category,
      reason,
      matchedLine: foundElement.text,
      lineNumber: textElements.indexOf(foundElement) + 1,
      subtopics: subtopics.length > 0 ? subtopics : undefined
    };
    
  } catch (error) {
    console.error('Google Docs API error:', error);
    
    // If the API fails, provide a more specific error message and suggest alternatives
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('not found')) {
      return {
        category: null,
        reason: `Document not accessible via API. This may be a published document that requires the actual document ID for API access. Error: ${errorMessage}`
      };
    }
    
    return {
      category: null,
      reason: `Google Docs API error: ${errorMessage}`
    };
  }
}