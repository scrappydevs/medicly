export const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },

  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001',
  },

  upload: {
    maxFileSize: 100 * 1024 * 1024,
    allowedVideoTypes: ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime', 'video/x-msvideo'],
  },

  processing: {
    pollInterval: 2000,
    signedUrlExpiry: 60 * 60 * 24,
    processingUrlExpiry: 60 * 60,
  }
};

export function validateConfig() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
