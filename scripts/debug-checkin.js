/* eslint-env node */
/* global process */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jmttblccfmqnqwoyzazc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptdHRibGNjZm1xbnF3b3l6YXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDMzMTUsImV4cCI6MjA5MTMxOTMxNX0.ZmcmcnJYDca8_F2QvhDVLcrUcGd9gss8_T9EoZ8JERQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false }
});

async function debug() {
  console.log('=== DEBUG CHECK-IN DATA ===\n');
  
  // 1. Ambil semua workspace rows
  const { data: rows, error } = await supabase
    .from('workspace_state')
    .select('id, updated_at, store')
    .limit(5);
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log(`Found ${rows.length} workspace rows:\n`);
  
  rows.forEach((row, i) => {
    console.log(`Row ${i + 1}:`);
    console.log(`  ID: ${row.id}`);
    console.log(`  Updated: ${row.updated_at}`);
    
    const store = row.store;
    if (store?.tenants?.['tenant-default']?.events?.['event-default']) {
      const event = store.tenants['tenant-default'].events['event-default'];
      const logs = event.checkInLogs || [];
      const day1Logs = logs.filter(l => l.day === 1);
      const day2Logs = logs.filter(l => l.day === 2);
      
      console.log(`  Total check-in logs: ${logs.length}`);
      console.log(`  Day 1 logs: ${day1Logs.length}`);
      console.log(`  Day 2 logs: ${day2Logs.length}`);
      
      if (day1Logs.length > 0) {
        console.log(`  Sample Day 1: ${day1Logs[0].name} (${day1Logs[0].ticket_id})`);
      }
    } else {
      console.log('  No event data found');
    }
    console.log('');
  });
}

debug().catch(console.error);
