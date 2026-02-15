import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rmbwfolhnzbiddwdrnbt.supabase.co'; // From Supabase dashboard
const supabaseAnonKey = 'sb_publishable_54Fb9cgNY46YuVSvTR-rcg_D5aXqFD2'; // From Supabase dashboard

export const supabase = createClient(supabaseUrl, supabaseAnonKey);