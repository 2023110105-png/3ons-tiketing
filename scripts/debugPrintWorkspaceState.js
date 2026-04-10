// Debug utility: print raw workspace_state row from Supabase
import { supabase } from '../src/lib/supabase.js';

const WORKSPACE_TABLE = 'workspace_state';
const WORKSPACE_ID = 'default';

async function main() {
  const { data, error } = await supabase
    .from(WORKSPACE_TABLE)
    .select('*')
    .eq('id', WORKSPACE_ID)
    .maybeSingle();
  if (error) {
    console.error('Supabase query error:', error.message);
    process.exit(1);
  }
  if (!data) {
    console.error('No workspace_state row found for id=default');
    process.exit(2);
  }
  console.log('Raw workspace_state row:', JSON.stringify(data, null, 2));
  process.exit(0);
}

main();
