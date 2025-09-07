import { NextRequest, NextResponse } from 'next/server';
import { detectCategoryFromDoc } from '@/lib/googleDoc';
import { validateApiKey, getApiKeys } from '@/lib/apiKeys';

export async function POST(req: NextRequest) {
  try {
    const { keyword, accessToken } = await req.json();
    
    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: 'Keyword is required and must be a non-empty string' },
        { status: 400 }
      );
    }
    
    if (!validateApiKey('google', 'docUrl')) {
      return NextResponse.json(
        { error: 'Google Doc URL not configured' },
        { status: 500 }
      );
    }
    
    const apiKeys = getApiKeys();
    const result = await detectCategoryFromDoc(apiKeys.google.docUrl, keyword, accessToken);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Classification API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during classification' },
      { status: 500 }
    );
  }
}