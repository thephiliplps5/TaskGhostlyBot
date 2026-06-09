import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://soblvyvwwdmsfdmcaljh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvYmx2eXZ3d2Rtc2ZkbWNhbGpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NzU5NDQsImV4cCI6MjA5NjU1MTk0NH0.F7pq_ZGGp3sPRrE5_s_9BtMM_RsS9NV4ykHymVYWYrM';

let currentToken = '';

export function setSupabaseToken(token: string) {
  currentToken = token;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (currentToken) {
        headers.set('Authorization', `Bearer ${currentToken}`);
      }
      return fetch(input, { ...init, headers });
    }
  }
});
