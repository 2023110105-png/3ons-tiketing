import { supabase } from '../src/lib/supabase.js';
import process from 'process';

const WORKSPACE_TABLE = 'workspace_state';
const WORKSPACE_ID = 'default';

async function main() {
  if (!supabase) {
    console.error('Supabase belum dikonfigurasi. Cek src/lib/supabase.js');
    process.exit(1);
  }

  const snapshot = {
    tenantRegistry: {
      activeTenantId: 'tenant-default',
      tenants: {
        'tenant-default': {
          id: 'tenant-default',
          brandName: 'Platform',
          eventName: 'Platform Event',
          status: 'active',
          expires_at: null,
          created_at: new Date().toISOString(),
          activeEventId: 'event-default',
          contract: {
            package: 'starter',
            start_at: new Date().toISOString(),
            payment_status: 'paid',
            amount: 0
          },
          quota: {
            maxParticipants: 500,
            maxGateDevices: 3,
            maxActiveEvents: 1
          },
          users: [
            {
              id: 'admin_eventplatform',
              username: 'admin_eventplatform',
              email: 'admin@platform.com',
              password: 'admin123',
              name: 'Admin Platform',
              role: 'admin_client',
              tenantId: 'tenant-default',
              is_active: true
            }
          ],
          branding: { primaryColor: '#0ea5e9' },
          invoices: []
        }
      }
    },
    store: {
      tenants: {
        'tenant-default': {
          activeEventId: 'event-default',
          events: {
            'event-default': {
              id: 'event-default',
              name: 'Platform Event',
              isArchived: false,
              created_at: new Date().toISOString(),
              currentDay: 1,
              participants: [],
              checkInLogs: [],
              adminLogs: [],
              pendingCheckIns: [],
              offlineQueueHistory: [],
              offlineConfig: { maxPendingAttempts: 5 },
              waTemplate: null,
              waSendMode: 'message_only'
            }
          }
        }
      }
    }
  };

  const { error } = await supabase
    .from(WORKSPACE_TABLE)
    .upsert({
      id: WORKSPACE_ID,
      tenant_registry: snapshot.tenantRegistry,
      store: snapshot.store,
      updated_at: new Date().toISOString()
    });
  if (error) {
    console.error('Gagal seed workspace_state:', error.message);
    process.exit(1);
  }
  console.log('Seed workspace_state tenant-default sukses!');
  process.exit(0);
}

main();
