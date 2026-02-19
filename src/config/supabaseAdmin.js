// config/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use the SERVICE ROLE key, not the Anon key
);

export default supabaseAdmin;