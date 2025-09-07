import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { keyword, flow, competitorUrls, accessToken } = await req.json();
    
    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: 'Keyword is required and must be a non-empty string' },
        { status: 400 }
      );
    }
    
    if (!flow || (flow !== 'with subtopics' && flow !== 'no subtopics')) {
      return NextResponse.json(
        { error: 'Invalid flow. Must be "with subtopics" or "no subtopics"' },
        { status: 400 }
      );
    }
    
    // Get the appropriate field list for the flow
    const fieldIds = flow === 'with subtopics' 
      ? ['wtitle', 'wentro', 'wpic1', 'wpic2', 'wpic3', 'wpic4', 'sub', 'wcost', 'wwhy', 'wfaq']
      : ['title', 'entro', 'pic1', 'pic2', 'pic3', 'pic4', 'cost', 'why', 'faq'];
    
    const results: Record<string, string> = {};
    const errors: Record<string, string> = {};
    
    // Generate content for each field by calling individual field endpoints
    for (const fieldId of fieldIds) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/generate/${fieldId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword, flow, competitorUrls, accessToken })
        });
        
        const result = await response.json();
        
        if (response.ok) {
          results[fieldId] = result.output;
        } else {
          errors[fieldId] = result.error || 'Generation failed';
        }
      } catch (error) {
        errors[fieldId] = error instanceof Error ? error.message : 'Unknown error';
      }
    }
    
    return NextResponse.json({ 
      ok: true,
      results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      flow,
      fieldCount: fieldIds.length,
      successCount: Object.keys(results).length
    });
    
  } catch (error) {
    console.error('Generate All API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during bulk generation' },
      { status: 500 }
    );
  }
}