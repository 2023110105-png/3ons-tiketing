# MULTI-TENANT ISOLATION FIX

## Problem: Data Tenant Bisa Tercampur

## Solusi: 3 Layer Isolation

### Layer 1: Database Schema (SQL)
```sql
-- Add tenant_id ke semua tabel data
ALTER TABLE participants ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE events ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE checkin_logs ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- Index untuk performance
CREATE INDEX idx_participants_tenant ON participants(tenant_id);
CREATE INDEX idx_events_tenant ON events(tenant_id);
```

### Layer 2: RLS Policies (Row Level Security)
```sql
-- Participants isolation
CREATE POLICY "tenant_isolation" ON participants
FOR ALL TO authenticated
USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### Layer 3: Application Code
- Set tenant_id saat insert
- Filter by tenant_id saat select
- Realtime channel per tenant

## File yang Perlu Diupdate:
1. dataSync.js - Add tenant_id ke semua sync
2. tenantUtils.js - Current tenant helper
3. All admin pages - Pass tenant_id
4. Realtime subscription - Filter by tenant

## Checklist Implementasi:
- [ ] SQL Schema updates
- [ ] RLS policies
- [ ] dataSync.js updates
- [ ] Frontend tenant context
- [ ] Realtime tenant channels
- [ ] Testing multi-tenant

## Testing:
1. Login Tenant A - Create participant
2. Login Tenant B - Verify participant A not visible
3. Check database - Confirm tenant_id correct
4. Realtime - Update in Tenant A, verify Tenant B tidak terpengaruh
