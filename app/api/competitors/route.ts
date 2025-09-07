import { NextRequest, NextResponse } from 'next/server';
import { getCompetitorUrlsFromSheets } from '@/lib/googleSheets';

export async function POST(req: NextRequest) {
  console.log('Competitor API called!');
  
  try {
    const { keyword, accessToken } = await req.json();
    console.log('Keyword received:', keyword);
    console.log('Access token provided:', !!accessToken);
    
    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: 'Keyword is required and must be a non-empty string' },
        { status: 400 }
      );
    }
    
    console.log('Calling OAuth-based Google Sheets API...');
    
    const result = await getCompetitorUrlsFromSheets(keyword, accessToken);
    console.log('Google Sheets API result:', result);
    
    // Transform the result to match the expected format
    return NextResponse.json({
      found: result.found,
      competitorUrls: result.competitorUrls,
      matchedKeyword: result.keywordCell,
      rowNumber: result.rowNumber,
      error: result.error
    });
  } catch (error) {
    console.error('Competitor URLs API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during competitor lookup' },
      { status: 500 }
    );
  }
}