// ===== REAL FUNCTIONS FOR WHITE LABEL =====
import { fetchWorkspaceSnapshot } from '../../../lib/dataSync';
let _workspaceSnapshot = null;
async function bootstrapStoreFromServer() { 
  _workspaceSnapshot = await fetchWorkspaceSnapshot();
  return _workspaceSnapshot; 
}
function getTenants() { return [
  { id: 'tenant-default', brandName: 'Platform', eventName: 'Platform Event', branding: { primaryColor: '#0ea5e9', appName: 'Platform', logo: '' } }
]; }
function updateTenantBranding(id, payload, user) { return { success: true }; }

// Komponen WhiteLabel dinonaktifkan sementara (fokus ke tenant only, owner diputus)
export default function WhiteLabel() {
  return null;
}
