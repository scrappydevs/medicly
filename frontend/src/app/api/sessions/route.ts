import { NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer();

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return Response.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('patient_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error in sessions GET:', error);
    return Response.json(
      { success: false, error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const sessionData = await request.json();

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        patient_id: sessionData.patient_id,
        evaluation_id: sessionData.treatment_id,
        status: sessionData.status || 'pending',
        due_date: sessionData.due_date,
        exercise_sets: sessionData.exercise_sets || 3,
        exercise_reps: sessionData.exercise_reps || 10,
        exercise_frequency_daily: sessionData.exercise_frequency_daily || 1,
        patient_notes: sessionData.description || null,
        created_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating session:', error);
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    let evaluationData = null;
    if (data.evaluation_id) {
      const { data: evaluation } = await supabase
        .from('evaluation_metrics')
        .select('*')
        .eq('id', data.evaluation_id)
        .single();
      evaluationData = evaluation;
    }

    const responseData = {
      ...data,
      exercise: evaluationData ? {
        id: evaluationData.id,
        name: evaluationData.name
      } : null
    };

    return Response.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error in sessions POST:', error);
    return Response.json(
      { success: false, error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
