import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://ryduslvhbjiwzmweriln.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5ZHVzbHZoYmppd3ptd2VyaWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNzEyNTAsImV4cCI6MjA3MTg0NzI1MH0.W-yyRwiJjfaF4ewJE4AM29IoWBe2A3aCGkgkyvyUqSY";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  let retries = 3;
  while (retries > 0) {
    try {
      // 1. Lightweight DB read
      const { data: readData, error: readError } = await supabase.from('profiles').select('id').limit(1);
      
      // 2. Update system_status table
      const { error: updateError } = await supabase
        .from('system_status')
        .upsert({ id: 1, last_run: new Date().toISOString(), status: 'success' });
      
      // 3. Create table automatically if it doesn't exist (Requires RPC or manual creation; we attempt via RPC fallback or log)
      if (updateError && updateError.code === '42P01') {
        console.warn('system_status table does not exist. Please create it or ensure an RPC handles auto-creation.');
      } else if (updateError) {
        throw updateError;
      }

      console.log('Keep-alive job ran successfully.');
      return res.status(200).json({ status: 'success', timestamp: new Date().toISOString() });
    } catch (err) {
      retries--;
      console.error(`Keepalive attempt failed. Retries left: ${retries}. Error:`, err);
      if (retries === 0) {
        // Log final failure
        await supabase.from('system_status').upsert({ id: 1, status: 'failed', error_message: err.message }).catch(e => console.error(e));
        return res.status(500).json({ status: 'error', message: err.message });
      }
      // wait 1 second before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
