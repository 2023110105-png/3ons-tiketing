// Tenant Utility Functions - Shared across admin-tenant pages
// This file contains common functions to avoid duplication across pages

import { fetchWorkspaceSnapshot } from './dataSync';

let _workspaceSnapshot = null;

// Get active tenant ID from various sources
export function getActiveTenantId() {
  if (typeof window !== 'undefined' && window.currentUser?.tenant_id) {
    return window.currentUser.tenant_id;
  }
  try {
    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (session.user?.tenant_id) return session.user.tenant_id;
    if (session.user?.tenant?.id) return session.user.tenant.id;
  } catch { /* ignore */ }
  if (_workspaceSnapshot?.store?.tenants) {
    const firstTenant = Object.keys(_workspaceSnapshot.store.tenants)[0];
    if (firstTenant) return firstTenant;
  }
  return 'default';
}

// Bootstrap workspace data from server
export async function bootstrapStoreFromServer() {
  _workspaceSnapshot = await fetchWorkspaceSnapshot();
  return _workspaceSnapshot;
}

// Get current workspace snapshot
export function getWorkspaceSnapshot() {
  return _workspaceSnapshot;
}

// Set workspace snapshot (for testing or manual updates)
export function setWorkspaceSnapshot(snapshot) {
  _workspaceSnapshot = snapshot;
}

// Get active tenant data
export function getActiveTenant() {
  const tenantId = getActiveTenantId();
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { id: tenantId };
  return _workspaceSnapshot.store.tenants?.[tenantId] || { id: tenantId };
}

// Get participants for a specific day
export function getParticipants(day) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = getActiveTenantId();
  const eventId = 'event-default';
  const participants =
    _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.participants || [];
  if (typeof day === 'number') {
    return participants.filter((p) => Number(p.day) === Number(day) || Number(p.day_number) === Number(day));
  }
  return participants;
}

// Get check-in logs for a specific day
export function getCheckInLogs(day) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = getActiveTenantId();
  const eventId = 'event-default';
  // Support both field names for backward compatibility
  const event = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId];
  const logs = event?.checkInLogs || event?.checkin_logs || [];
  return logs.filter(l => !day || Number(l.day) === Number(day) || Number(l.day_number) === Number(day));
}

// Get available days from participant data
export function getAvailableDays() {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [1];
  const tenantId = getActiveTenantId();
  const eventId = 'event-default';
  const participants = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.participants || [];
  const days = [...new Set(participants.map(p => p.day_number || p.day || 1))];
  return days.length > 0 ? days.sort((a, b) => a - b) : [1];
}

// Get current day setting
export function getCurrentDay() {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return 1;
  const tenantId = getActiveTenantId();
  return _workspaceSnapshot.store.tenants?.[tenantId]?.currentDay || 1;
}

// Set current day
export function setCurrentDay(day) {
  const tenantId = getActiveTenantId();
  if (_workspaceSnapshot?.store?.tenants?.[tenantId]) {
    _workspaceSnapshot.store.tenants[tenantId].currentDay = day;
  }
}

// Get stats for a specific day
export function getStats(day) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { total: 0, checkedIn: 0, notCheckedIn: 0, percentage: 0, byCategory: {} };
  
  const participants = getParticipants(day);
  const checkInLogs = getCheckInLogs(day);
  const checkedInTicketIds = new Set(checkInLogs.map(log => String(log.ticket_id || '').trim().toLowerCase()));
  
  const total = participants.length;
  const checkedIn = participants.filter(p => checkedInTicketIds.has(String(p.ticket_id || '').trim().toLowerCase())).length;
  const notCheckedIn = total - checkedIn;
  const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
  
  // Build byCategory stats
  const byCategory = {};
  participants.forEach(p => {
    const cat = p.category || 'Regular';
    if (!byCategory[cat]) byCategory[cat] = { total: 0, checkedIn: 0 };
    byCategory[cat].total++;
    if (checkedInTicketIds.has(String(p.ticket_id || '').trim().toLowerCase())) byCategory[cat].checkedIn++;
  });
  
  return { total, checkedIn, notCheckedIn, percentage, byCategory };
}

// Get pending check-ins (offline queue)
export function getPendingCheckIns() {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = getActiveTenantId();
  const eventId = 'event-default';
  return _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.pending_checkins || [];
}

// Get offline queue history
export function getOfflineQueueHistory(limit) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = getActiveTenantId();
  const eventId = 'event-default';
  const arr = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.offline_queue_history || [];
  return typeof limit === 'number' ? arr.slice(0, limit) : arr;
}

// Get admin logs
export function getAdminLogs(limit) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = getActiveTenantId();
  const eventId = 'event-default';
  const arr = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.admin_logs || [];
  return typeof limit === 'number' ? arr.slice(0, limit) : arr;
}

// Get WA template
export function getWaTemplate() {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return '';
  const tenantId = getActiveTenantId();
  const eventId = 'event-default';
  return _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.waTemplate || '';
}

// Get all event data (for backup/export)
export function getAllEventData() {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return null;
  const tenantId = getActiveTenantId();
  const eventId = 'event-default';
  const event = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId];
  if (!event) return null;
  
  return {
    event: {
      id: eventId,
      name: event.name || 'Event Default',
      exportDate: new Date().toISOString(),
      currentDay: event.currentDay || 1,
      waTemplate: event.waTemplate || '',
    },
    participants: event.participants || [],
    checkInLogs: event.checkInLogs || event.checkin_logs || [],
    adminLogs: event.adminLogs || [],
    stats: getStats()
  };
}
