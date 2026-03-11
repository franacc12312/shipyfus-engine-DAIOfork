module.exports = {
  apps: [{
    name: 'shipyfus-backend',
    cwd: '/home/ubuntu/.openclaw/workspace/shipyfus-engine',
    script: 'apps/backend/src/index.ts',
    interpreter: '/home/ubuntu/.openclaw/workspace/shipyfus-engine/node_modules/.bin/tsx',
    env: {
      PORT: 3001,
      SUPABASE_URL: 'https://nrbhwfmixzygxdnpjpoq.supabase.co',
      SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yYmh3Zm1peHp5Z3hkbnBqcG9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxOTgwMjEsImV4cCI6MjA4ODc3NDAyMX0.mfCpF9Jk3sDSJzXCD8niojWPS9wIxEVl1zT1tU1mOyU',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yYmh3Zm1peHp5Z3hkbnBqcG9xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE5ODAyMSwiZXhwIjoyMDg4Nzc0MDIxfQ.mjeFrPxUmeRMgIa7knk0hAM6_FTDRjfhWB3LvshrZbQ',
      ADMIN_PASSWORD: 'shipyfus-admin-2026',
      OWNER_USER_ID: '00000000-0000-0000-0000-000000000001',
      FRONTEND_URL: 'https://shipyfus-engine.vercel.app'
    }
  }]
};
