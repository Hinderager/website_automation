import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getPromptFromSheets } from '@/lib/googleSheetsPrompts';

export async function POST(req: NextRequest, { params }: { params: { box: string } }) {
  try {
    const { keyword, flow, competitorUrls, accessToken, previousPictures, subtopics, allPictures } = await req.json();
    const fieldId = params.box;
    
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
    
    // Validate field exists (simplified - same fields for both flows)
    const validFields = ['title', 'intro', 'pic1', 'pic2', 'pic3', 'pic4', 'subtopics', 'cost', 'why', 'faq'];
    
    if (!validFields.includes(fieldId)) {
      return NextResponse.json(
        { error: `Invalid field "${fieldId}"` },
        { status: 400 }
      );
    }
    
    // Subtopics field only valid for "with subtopics" flow
    if (fieldId === 'subtopics' && flow !== 'with subtopics') {
      return NextResponse.json(
        { error: 'Subtopics field is only available for "with subtopics" classification' },
        { status: 400 }
      );
    }
    
    // Check for OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Check for access token (OAuth authentication required)
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Authentication required. Please authenticate with Google to access prompts.' },
        { status: 401 }
      );
    }

    // Fetch the prompt from Google Sheets using the same pattern as competitor URLs
    console.log('Calling getPromptFromSheets for field:', fieldId);
    const promptResult = await getPromptFromSheets(fieldId, accessToken);
    console.log('Prompt result:', promptResult);
    
    if (!promptResult.found || !promptResult.prompt) {
      return NextResponse.json(
        { error: promptResult.error || `No prompt found for field "${fieldId}". Please ensure this field has a prompt in the Prompts tab.` },
        { status: 404 }
      );
    }
    
    const promptData = {
      prompt: promptResult.prompt,
      example: promptResult.example || undefined
    };
    
    console.log('Successfully fetched prompt for', fieldId);

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Generate content using OpenAI API
    const generatedContent = await generateContentWithOpenAI(
      openai, 
      fieldId, 
      keyword, 
      flow, 
      competitorUrls,
      promptData,
      previousPictures,
      subtopics
    );
    
    return NextResponse.json({ 
      ok: true, 
      output: generatedContent,
      fieldId,
      flow
    });
    
  } catch (error) {
    console.error('Generation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during content generation' },
      { status: 500 }
    );
  }
}

async function generateContentWithOpenAI(
  openai: OpenAI,
  fieldId: string, 
  keyword: string, 
  flow: string, 
  competitorUrls?: string[],
  promptData?: any,
  previousPictures?: Record<string, string>,
  subtopics?: string[]
): Promise<string> {
  const fieldLabels: Record<string, string> = {
    'title': 'Title',
    'intro': 'Introduction',
    'pic1': 'Picture 1 Description',
    'pic2': 'Picture 2 Description',
    'pic3': 'Picture 3 Description',
    'pic4': 'Picture 4 Description',
    'subtopics': 'Subtopics',
    'cost': 'Cost Information',
    'why': 'Why Choose Us',
    'faq': 'FAQs'
  };
  
  const fieldLabel = fieldLabels[fieldId] || fieldId;
  
  // Build context about competitors if provided (only for FAQ fields)
  const issFaqField = fieldId === 'faq';
  const competitorContext = (issFaqField && competitorUrls && competitorUrls.length > 0)
    ? `\n\nCompetitor URLs to reference for inspiration (but create original content): ${competitorUrls.join(', ')}`
    : '';
  
  // For subtopics field, include the list in the prompt but still generate content
  // The prompt should use these subtopics to generate the appropriate content
  
  // ONLY use prompt from Google Sheets - no made-up prompts allowed
  if (!promptData || !promptData.prompt) {
    throw new Error('Prompt data is required from Google Sheets');
  }
  
  // Replace keyword placeholders with actual keyword
  // Support multiple placeholder formats: {{keyword}}, {{KEYWORD}}, KEYWORD, etc.
  let prompt = promptData.prompt
    .replace(/{{keyword}}/gi, keyword)
    .replace(/{{KEYWORD}}/g, keyword)
    .replace(/\bKEYWORD\b/g, keyword);
  
  // For subtopics field, include the actual subtopics from Google Doc
  if (fieldId === 'subtopics' && subtopics && subtopics.length > 0) {
    // Add the actual subtopics list to the prompt
    const subtopicsList = subtopics.map(item => `• ${item.replace(/^[•\-*\s]+/, '').trim()}`).join('\n');
    prompt = prompt.replace(/{{subtopics}}/gi, subtopicsList);
    
    // Also add them as context if the prompt doesn't have a placeholder
    if (!prompt.includes(subtopicsList)) {
      prompt += `\n\nThe following subtopics were found for ${keyword}:\n${subtopicsList}\n\nUse these subtopics to generate the content as specified above.`;
    }
  }
  
  // Also replace in example if provided
  let example = promptData.example;
  if (example) {
    example = example
      .replace(/{{keyword}}/gi, keyword)
      .replace(/{{KEYWORD}}/g, keyword)
      .replace(/\bKEYWORD\b/g, keyword);
    
    // Also replace subtopics in example if present
    if (fieldId === 'subtopics' && subtopics && subtopics.length > 0) {
      const subtopicsList = subtopics.map(item => `• ${item.replace(/^[•\-*\s]+/, '').trim()}`).join('\n');
      example = example.replace(/{{subtopics}}/gi, subtopicsList);
    }
    
    prompt += `\n\nExample format:\n${example}`;
  }
  
  // Add competitor context only for FAQ fields
  if (issFaqField && competitorContext) {
    prompt += competitorContext;
  }

  // Add context about previous pictures to ensure uniqueness
  const isPictureField = fieldId.startsWith('pic');
  if (isPictureField && previousPictures) {
    const previousDescriptions = Object.entries(previousPictures)
      .filter(([key, value]) => key !== fieldId && value) // Exclude current field and empty values
      .map(([key, value]) => `[${key}]: ${value}`)
      .join('\n');
    
    if (previousDescriptions) {
      // Extract key themes/words from previous descriptions for stronger uniqueness
      const usedThemes: string[] = [];
      const usedPhrases: string[] = [];
      Object.entries(previousPictures).forEach(([key, value]) => {
        if (key !== fieldId && value) {
          // Extract the first line/title if it exists
          const firstLine = value.split('\n')[0];
          if (firstLine) {
            usedPhrases.push(firstLine.toLowerCase());
          }
          
          // Extract main themes/keywords from the entire description
          const words = value.toLowerCase().split(/\s+/);
          const keyThemes = ['stress', 'free', 'eco', 'friendly', 'safe', 'damage', 'fast', 'efficient', 
                             'professional', 'affordable', 'reliable', 'convenient', 'simplified', 
                             'streamlined', 'worry', 'seamless', 'easy', 'quick', 'disposal', 'recycling'];
          
          words.forEach(word => {
            keyThemes.forEach(theme => {
              if (word.includes(theme)) {
                usedThemes.push(theme);
              }
            });
          });
        }
      });
      
      const uniqueThemes = Array.from(new Set(usedThemes));
      
      prompt += `\n\nCRITICAL UNIQUENESS REQUIREMENT: You MUST create a completely different description.\n\n`;
      
      if (usedPhrases.length > 0) {
        prompt += `ALREADY USED TITLES/PHRASES (DO NOT REPEAT SIMILAR CONCEPTS):\n${usedPhrases.join('\n')}\n\n`;
      }
      
      if (uniqueThemes.length > 0) {
        prompt += `AVOID ALL THESE THEMES/WORDS: ${uniqueThemes.join(', ')}\n\n`;
      }
      
      prompt += `Previous descriptions for reference (DO NOT COPY OR REPEAT):\n${previousDescriptions}\n\n`;
      prompt += `Generate a COMPLETELY UNIQUE description with DIFFERENT themes, benefits, and focus areas. Do not use "stress-free", "worry-free", "seamless" or similar concepts if they've been used. Be creative and explore entirely new angles.`;
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional content writer. The keyword for this content is "${keyword}". Never output the word "KEYWORD" in uppercase - always replace it with the actual keyword: "${keyword}".${isPictureField ? ` CRITICAL UNIQUENESS RULES:
1. NEVER use "stress-free", "stress free", "worry-free", "hassle-free" or similar phrases if ANY other picture uses them
2. NEVER use "seamless", "smooth", "easy" if already used
3. NEVER use "eco-friendly", "environmentally" if already used  
4. Each picture MUST focus on a COMPLETELY DIFFERENT benefit or aspect
5. DO NOT repeat ANY key phrases or themes from other pictures
6. Be creative - use unique angles like: speed, local expertise, family-owned, licensed/insured, scheduling flexibility, transparent pricing, equipment quality, team experience, service areas, guarantees, etc.
7. NEVER start multiple descriptions with the same structure or phrase` : ''}`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    let content = response.choices[0]?.message?.content || 'Content generation failed';
    
    // Remove any markdown formatting symbols like ###, **, etc.
    content = content
      .replace(/^#{1,6}\s+/gm, '') // Remove markdown headers
      .replace(/\*\*/g, '') // Remove bold markers
      .replace(/^\*\s+/gm, '') // Remove bullet points
      .trim();
    
    // Post-process to ensure no KEYWORD placeholders remain
    content = content
      .replace(/{{keyword}}/gi, keyword)
      .replace(/{{KEYWORD}}/g, keyword)
      .replace(/\bKEYWORD\b/g, keyword);
    
    // Apply proper case to title field
    if (fieldId === 'title') {
      content = content.split(' ').map(word => {
        // Keep small words lowercase unless they're the first word
        const smallWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        if (smallWords.includes(word.toLowerCase()) && content.indexOf(word) > 0) {
          return word.toLowerCase();
        }
        // Capitalize first letter of each word
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }).join(' ');
      
      // Ensure first letter is always capitalized
      if (content.length > 0) {
        content = content.charAt(0).toUpperCase() + content.slice(1);
      }
    }
    
    return content;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to generate content with OpenAI API');
  }
}