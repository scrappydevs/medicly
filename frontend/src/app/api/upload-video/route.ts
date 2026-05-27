import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractVideoRotationFromMetadata, type RotationAngle } from '@/utils/videoRotation';

function createSupabaseServer() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServer();

    if (!supabase) {
      console.error('Failed to create Supabase client - missing environment variables');
      return NextResponse.json({
        success: false,
        error: 'Server configuration error: Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
      }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const sessionId = formData.get('sessionId') as string;

    if (!file) {
      return NextResponse.json({ 
        success: false, 
        error: 'No file provided' 
      }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Patient ID is required' 
      }, { status: 400 });
    }

    if (!file.type.startsWith('video/')) {
      return NextResponse.json({
        success: false,
        error: 'Only video files are allowed'
      }, { status: 400 });
    }

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({
        success: false,
        error: 'File size exceeds 100MB limit'
      }, { status: 400 });
    }

    let rotationAngle: RotationAngle = 0;
    try {
      rotationAngle = await extractVideoRotationFromMetadata(file);
    } catch (error) {
      console.error('Error detecting video rotation:', error);
    }

    const timestamp = Date.now();
    const randomId = crypto.randomUUID();
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const uniqueFileName = `${timestamp}-${randomId}.${fileExtension}`;

    const filePath = sessionId
      ? `${userId}/sessions/${sessionId}/${uniqueFileName}`
      : `${userId}/processed/${uniqueFileName}`;

    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      return NextResponse.json({
        success: false,
        error: `Failed to check storage buckets: ${bucketsError.message}`
      }, { status: 500 });
    }

    const patientVideosBucket = buckets?.find(bucket => bucket.name === 'patient_videos');
    if (!patientVideosBucket) {
      return NextResponse.json({
        success: false,
        error: 'Storage bucket "patient_videos" not found. Please run the Supabase setup SQL.'
      }, { status: 500 });
    }

    if (patientVideosBucket.file_size_limit && file.size > patientVideosBucket.file_size_limit) {
      return NextResponse.json({
        success: false,
        error: `File size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds bucket limit of ${(patientVideosBucket.file_size_limit / (1024 * 1024)).toFixed(1)}MB`
      }, { status: 400 });
    }

    let uploadData = null;
    let uploadError = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await supabase.storage
          .from('patient_videos')
          .upload(filePath, file, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: attempt > 1,
          });

        uploadData = result.data;
        uploadError = result.error;

        if (!uploadError) {
          break;
        }
      } catch (uploadException) {
        uploadError = { message: `Exception: ${uploadException}`, name: 'UploadException' } as any;
      }

      const isRetryable = uploadError.message.includes('fetch failed') ||
                         uploadError.message.includes('EPIPE') ||
                         uploadError.message.includes('network') ||
                         uploadError.message.includes('timeout');

      if (!isRetryable || attempt === maxRetries) {
        break;
      }

      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    if (uploadError) {
      console.error('Supabase upload error after all retries:', uploadError);

      let userMessage = 'Failed to upload file to storage';

      if (uploadError.message.includes('fetch failed') || uploadError.message.includes('EPIPE')) {
        userMessage = 'Network connection interrupted during upload. Please check your internet connection and try again.';
      } else if (uploadError.message.includes('timeout')) {
        userMessage = 'Upload timed out. The file may be too large or your connection is slow.';
      } else if (uploadError.message.includes('permission') || uploadError.message.includes('forbidden')) {
        userMessage = 'Permission denied. Please contact support.';
      } else if (uploadError.message.includes('quota') || uploadError.message.includes('limit')) {
        userMessage = 'Storage quota exceeded. Please contact support.';
      }

      return NextResponse.json({
        success: false,
        error: userMessage,
        details: uploadError.message
      }, { status: 500 });
    }

    if (!uploadData) {
      return NextResponse.json({
        success: false,
        error: 'Upload succeeded but no data returned from storage'
      }, { status: 500 });
    }

    const { data: urlData, error: urlError } = await supabase.storage
      .from('patient_videos')
      .createSignedUrl(filePath, 60 * 60 * 24);

    if (urlError) {
      console.error('Error creating signed URL:', urlError);
    }

    const videoId = crypto.randomUUID();

    return NextResponse.json({
      success: true,
      data: {
        id: videoId,
        key: uploadData.path,
        path: uploadData.path,
        url: urlData?.signedUrl || null,
        signedUrl: urlData?.signedUrl || null,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        storagePath: filePath,
        userId,
        sessionId,
        rotation: rotationAngle,
        metadata: {
          rotation: rotationAngle,
          needsCorrection: rotationAngle !== 0,
          detectedAt: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Upload API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json({
      success: false,
      error: `Internal server error during upload: ${errorMessage}`
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = createSupabaseServer();

    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase environment variables',
        details: 'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'
      }, { status: 500 });
    }

    const { data: buckets, error } = await supabase.storage.listBuckets();
    const hasPatientVideos = buckets?.some(bucket => bucket.name === 'patient_videos');

    return NextResponse.json({
      success: true,
      message: 'Upload API is ready',
      environment: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        bucketExists: hasPatientVideos,
        totalBuckets: buckets?.length || 0
      }
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 