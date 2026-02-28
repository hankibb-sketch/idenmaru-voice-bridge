import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
        params: {
            events_per_second: 10,
        },
    },
});

export const SESSION_ID = process.env.NEXT_PUBLIC_SESSION_ID || 'TEST_SESSION_001';
