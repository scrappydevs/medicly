import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const { description } = await request.json();

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    console.log('🤖 AI Exercise Selection - Patient description:', description);

    // Get available exercises from evaluation_metrics table
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: evaluationMetrics, error } = await supabase
      .from('evaluation_metrics')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('❌ Error fetching evaluation metrics:', error);
      return NextResponse.json(
        { error: 'Failed to fetch available exercises' },
        { status: 500 }
      );
    }

    if (!evaluationMetrics || evaluationMetrics.length === 0) {
      return NextResponse.json(
        { error: 'No exercises available in database' },
        { status: 500 }
      );
    }

    console.log('📋 Available evaluation exercises:', evaluationMetrics.length);

    // Create exercise list for Claude
    const exerciseList = evaluationMetrics.map(e =>
      `ID: ${e.id} | Name: ${e.name}`
    ).join('\n');

    const prompt = `You are an AI physical therapy assistant. A patient has described their problem, and you need to select the most appropriate exercise from the available options.

PATIENT'S PROBLEM DESCRIPTION:
"${description}"

AVAILABLE EXERCISES:
${exerciseList}

INSTRUCTIONS:
1. Analyze the patient's description to understand their pain, movement issues, or physical therapy needs
2. Match their problem to the most appropriate exercise from the list above
3. Consider factors like:
   - Body part affected (shoulder, knee, back, etc.)
   - Type of problem (pain, stiffness, weakness, mobility, etc.)
   - Exercise type that would help (stretching, strengthening, mobility, etc.)

RESPONSE FORMAT:
Respond with ONLY a JSON object in this exact format:
{
  "exercise_id": [ID number from the list],
  "exercise_name": "[Name of the selected exercise]",
  "reasoning": "[Brief explanation of why this exercise was chosen for this specific problem]",
  "confidence": [number between 0.0 and 1.0 indicating confidence in the selection]
}

Do not include any other text, explanations, or formatting - only the JSON object.`;

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const aiResponseText = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log('🤖 Claude raw response:', aiResponseText);

    // Parse Claude's JSON response
    let aiResult;
    try {
      // Clean the response to extract just the JSON
      const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
      const cleanJson = jsonMatch ? jsonMatch[0] : aiResponseText;
      aiResult = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('❌ Error parsing Claude response:', parseError, 'Raw response:', aiResponseText);
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    console.log('✅ AI selected exercise:', aiResult.exercise_name, 'ID:', aiResult.exercise_id, 'Confidence:', aiResult.confidence);

    // Create exercise object from AI response
    const selectedExercise = {
      id: aiResult.exercise_id,
      name: aiResult.exercise_name
    };

    return NextResponse.json({
      success: true,
      exercise: selectedExercise,
      reasoning: aiResult.reasoning,
      confidence: aiResult.confidence,
      aiResponse: aiResult
    });

  } catch (error) {
    console.error('❌ AI Exercise Selection error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}