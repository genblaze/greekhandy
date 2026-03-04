import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://rwggwqnddoturgcyluuo.supabase.co';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_tkTy4XLRcY6AP6T-PPIVNg_HDI7Z0J5';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
