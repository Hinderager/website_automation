import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getPromptFromSheets } from '@/lib/googleSheetsPrompts';

export async function POST(req: NextRequest) {
  try {
    const { keyword, flow, accessToken } = await req.json();
    
    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: 'Keyword is required and must be a non-empty string' },
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

    // Fetch the single prompt from C13 for all pictures
    console.log('Fetching combined pictures prompt from C13');
    const promptResult = await getPromptFromSheets('pictures', accessToken);
    
    if (!promptResult.found || !promptResult.prompt) {
      return NextResponse.json(
        { error: promptResult.error || 'No prompt found for pictures in C13. Please ensure this field has a prompt in the Prompts tab.' },
        { status: 404 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Replace keyword placeholders
    let prompt = promptResult.prompt
      .replace(/{{keyword}}/gi, keyword)
      .replace(/{{KEYWORD}}/g, keyword)
      .replace(/\bKEYWORD\b/g, keyword);
    
    if (promptResult.example) {
      let example = promptResult.example
        .replace(/{{keyword}}/gi, keyword)
        .replace(/{{KEYWORD}}/g, keyword)
        .replace(/\bKEYWORD\b/g, keyword);
      prompt += `\n\nExample format:\n${example}`;
    }

    // Generate content using OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional content writer. The keyword for this content is "${keyword}". Generate exactly 13 unique title and summary combinations for ${keyword} services. Each combination should focus on a different aspect or benefit. Never repeat themes or key phrases between combinations.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.8
    });

    let content = response.choices[0]?.message?.content || 'Content generation failed';
    
    // Parse the 13 combinations from the response
    // Expected format: numbered list or separated sections
    const combinations: Array<{ title: string; summary: string }> = [];
    
    // Try to parse numbered list format (1. Title\nSummary\n\n2. Title\nSummary...)
    const sections = content.split(/\n\n+/);
    
    for (const section of sections) {
      // Remove numbering and clean up
      const cleanSection = section.replace(/^\d+[\.\)]\s*/, '').trim();
      if (!cleanSection) continue;
      
      // Split into title and summary (first line is title, rest is summary)
      const lines = cleanSection.split('\n');
      if (lines.length >= 2) {
        const title = lines[0].replace(/^[#*]+\s*/, '').replace(/[*]+/g, '').trim();
        const summary = lines.slice(1).join(' ').replace(/^[-•]\s*/, '').trim();
        
        if (title && summary) {
          combinations.push({ title, summary });
        }
      } else if (lines.length === 1 && lines[0].includes(':')) {
        // Handle "Title: Summary" format
        const [title, summary] = lines[0].split(':').map(s => s.trim());
        if (title && summary) {
          combinations.push({ title, summary });
        }
      }
    }
    
    // If we couldn't parse enough combinations, try alternative parsing
    if (combinations.length < 13) {
      // Try parsing by looking for patterns like "Title:" or similar
      const matches = Array.from(content.matchAll(/(?:^|\n)([^:\n]+):\s*([^\n]+(?:\n(?![^:\n]+:)[^\n]+)*)/gm));
      for (const match of matches) {
        if (combinations.length >= 13) break;
        const title = match[1].replace(/^\d+[\.\)]\s*/, '').replace(/[#*]+/g, '').trim();
        const summary = match[2].trim();
        if (title && summary && !combinations.find(c => c.title === title)) {
          combinations.push({ title, summary });
        }
      }
    }
    
    console.log(`Parsed ${combinations.length} combinations from response`);
    
    // Ensure we have at least 4 combinations
    if (combinations.length < 4) {
      return NextResponse.json(
        { error: `Only found ${combinations.length} combinations. Need at least 4. Response may not be in expected format.` },
        { status: 500 }
      );
    }
    
    // Randomly select 4 unique combinations
    const selectedIndices = new Set<number>();
    while (selectedIndices.size < 4 && selectedIndices.size < combinations.length) {
      const randomIndex = Math.floor(Math.random() * Math.min(combinations.length, 13));
      selectedIndices.add(randomIndex);
    }
    
    const selectedCombinations = Array.from(selectedIndices).map(i => combinations[i]);
    
    // Format the output for each picture box
    const pictureOutputs = {
      pic1: `${selectedCombinations[0].title}\n${selectedCombinations[0].summary}`,
      pic2: `${selectedCombinations[1].title}\n${selectedCombinations[1].summary}`,
      pic3: `${selectedCombinations[2].title}\n${selectedCombinations[2].summary}`,
      pic4: `${selectedCombinations[3].title}\n${selectedCombinations[3].summary}`
    };
    
    // Apply proper case to titles in each output
    for (const key of Object.keys(pictureOutputs) as Array<keyof typeof pictureOutputs>) {
      const lines = pictureOutputs[key].split('\n');
      if (lines.length > 0) {
        // Apply proper case to the title (first line)
        lines[0] = lines[0].split(' ').map((word, index) => {
          const smallWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
          if (smallWords.includes(word.toLowerCase()) && index > 0) {
            return word.toLowerCase();
          }
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');
        
        // Ensure first letter is always capitalized
        if (lines[0].length > 0) {
          lines[0] = lines[0].charAt(0).toUpperCase() + lines[0].slice(1);
        }
        
        pictureOutputs[key] = lines.join('\n');
      }
    }
    
    return NextResponse.json({ 
      ok: true, 
      outputs: pictureOutputs,
      totalCombinations: combinations.length,
      selectedIndices: Array.from(selectedIndices)
    });
    
  } catch (error) {
    console.error('Pictures generation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during pictures generation' },
      { status: 500 }
    );
  }
}