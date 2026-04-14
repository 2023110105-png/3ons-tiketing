import { useState, useEffect } from 'react'
import { Building2, Plus, Edit2, Trash2, Users, Camera, MonitorSmartphone, ShieldCheck, ChevronDown, ChevronRight, UserPlus } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { syncTenantUpsert, syncTenantDelete } from '../../../lib/dataSync'

// Mock data - in real implementation, fetch from Supabase
const MOCK_USERS = [
  { id: 'user-1', username: 'operator1', name: 'Operator Satu', email: 'operator1@example.com', role: 'operator', is_active: true, gatePermissions: { front: true, back: false } },
  { id: 'user-2', username: 'zakialhakim16', name: 'Zaki Alhakim', email: 'zakialhakim16@admin.com', role: 'admin', is_active: true, gatePermissions: { front: true, back: true } }
]

export default function AdminTenants() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedTenant, setExpandedTenant] = useState(null)
  const [showTenantForm, setShowTenantForm] = useState(false)
  const [showUserForm, setShowUserForm] = useState(false)
  const [editingTenant, setEditingTenant] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [selectedTenantForUser, setSelectedTenantForUser] = useState(null)
  const [tenantFormData, setTenantFormData] = useState({ name: '', brand: '' })
  const [userFormData, setUserFormData] = useState({ 
    username: '', 
    name: '', 
    email: '', 
    password: '', 
    role: 'operator',
    gateFront: true,
    gateBack: false
  })

  // Load tenants from Supabase on mount
  useEffect(() => {
    fetchTenants()
  }, [])

  const fetchTenants = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from('tenants').select('*')
      if (error) throw error
      
      // Load gate users for each tenant
      const tenantsWithUsers = await Promise.all(
        (data || []).map(async (tenant) => {
          const { data: users } = await supabase
            .from('gate_users')
            .select('*')
            .eq('tenant_id', tenant.id)
          return { ...tenant, userList: users || [] }
        })
      )
      
      setTenants(tenantsWithUsers)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Tenant CRUD
  const handleTenantSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingTenant) {
        const { error } = await supabase
          .from('tenants')
          .update({ 
            name: tenantFormData.name, 
            brand: tenantFormData.brand,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTenant.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('tenants')
          .insert({
            name: tenantFormData.name,
            brand: tenantFormData.brand,
            status: 'active'
          })
          .select()
        if (error) throw error
        // Sync tenant to workspace_state for gate access
        if (data && data[0]) {
          await syncTenantUpsert({ id: data[0].id, name: data[0].name, brand: data[0].brand })
        }
      }
      await fetchTenants()
      closeTenantForm()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleEditTenant = (tenant) => {
    setEditingTenant(tenant)
    setTenantFormData({ name: tenant.name, brand: tenant.brand })
    setShowTenantForm(true)
  }

  const handleDeleteTenant = async (id) => {
    if (!confirm('Are you sure you want to delete this tenant?')) return
    try {
      const { error } = await supabase.from('tenants').delete().eq('id', id)
      if (error) throw error
      // Sync tenant deletion to workspace_state
      await syncTenantDelete(id)
      await fetchTenants()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const closeTenantForm = () => {
    setShowTenantForm(false)
    setEditingTenant(null)
    setTenantFormData({ name: '', brand: '' })
  }

  // User CRUD - Gate Users
  const handleUserSubmit = async (e) => {
    e.preventDefault()
    try {
      const gateAssignment = userFormData.gateFront && userFormData.gateBack 
        ? 'both' 
        : userFormData.gateFront ? 'front' : 'back'

      if (editingUser) {
        const { error } = await supabase
          .from('gate_users')
          .update({
            username: userFormData.username,
            full_name: userFormData.name,
            gate_assignment: gateAssignment,
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingUser.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('gate_users')
          .insert({
            tenant_id: selectedTenantForUser,
            username: userFormData.username,
            full_name: userFormData.name,
            gate_assignment: gateAssignment,
            is_active: true
          })
        if (error) throw error
      }
      await fetchTenants()
      closeUserForm()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm('Delete this gate user?')) return
    try {
      const { error } = await supabase.from('gate_users').delete().eq('id', userId)
      if (error) throw error
      await fetchTenants()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleAddUser = (tenantId) => {
    setSelectedTenantForUser(tenantId)
    setEditingUser(null)
    setUserFormData({
      username: '',
      name: '',
      email: '',
      password: '',
      role: 'operator',
      gateFront: true,
      gateBack: false
    })
    setShowUserForm(true)
  }

  const handleEditUser = (tenantId, user) => {
    setSelectedTenantForUser(tenantId)
    setEditingUser(user)
    setUserFormData({
      username: user.username,
      name: user.full_name,
      email: user.email || '',
      password: '',
      role: 'operator',
      gateFront: user.gate_assignment === 'front' || user.gate_assignment === 'both',
      gateBack: user.gate_assignment === 'back' || user.gate_assignment === 'both'
    })
    setShowUserForm(true)
  }

  const closeUserForm = () => {
    setShowUserForm(false)
    setEditingUser(null)
    setSelectedTenantForUser(null)
    setUserFormData({
      username: '',
      name: '',
      email: '',
      password: '',
      role: 'operator',
      gateFront: true,
      gateBack: false
    })
  }

  const toggleExpandTenant = (tenantId) => {
    setExpandedTenant(expandedTenant === tenantId ? null : tenantId)
  }

  const getRoleBadgeClass = (role) => {
    return role === 'admin' ? 'admin-badge' : 'operator-badge'
  }

  return (
    <div className="admin-tenants">
      {/* Toolbar */}
      <div className="owner-toolbar" style={{ marginBottom: '24px' }}>
        <div>
          <span className="owner-section-kicker">Manajemen</span>
          <h3 className="owner-section-title-sm">Daftar Tenant & Pengguna</h3>
        </div>
        <button className="admin-btn-primary" onClick={() => setShowTenantForm(true)}>
          <Plus size={18} /> Tambah Tenant
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && <div className="admin-loading">Loading tenants...</div>}
      {error && <div className="admin-error">Error: {error}</div>}

      {/* Tenant Form */}
      {showTenantForm && (
        <div className="admin-form-card">
          <h4>{editingTenant ? 'Edit Tenant' : 'Add New Tenant'}</h4>
          <form onSubmit={handleTenantSubmit}>
            <div className="admin-form-group">
              <label>Tenant Name</label>
              <input
                type="text"
                value={tenantFormData.name}
                onChange={(e) => setTenantFormData({ ...tenantFormData, name: e.target.value })}
                placeholder="e.g., Yamaha Music School"
                required
              />
            </div>
            <div className="admin-form-group">
              <label>Brand Name</label>
              <input
                type="text"
                value={tenantFormData.brand}
                onChange={(e) => setTenantFormData({ ...tenantFormData, brand: e.target.value })}
                placeholder="e.g., Yamaha"
                required
              />
            </div>
            <div className="admin-form-actions">
              <button type="button" className="admin-btn-secondary" onClick={closeTenantForm}>
                Cancel
              </button>
              <button type="submit" className="admin-btn-primary">
                {editingTenant ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User Form */}
      {showUserForm && (
        <div className="admin-form-card">
          <h4>{editingUser ? 'Edit User' : 'Add New User'}</h4>
          <p className="admin-form-subtitle">
            Tenant: {tenants.find(t => t.id === selectedTenantForUser)?.name}
          </p>
          <form onSubmit={handleUserSubmit}>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={userFormData.username}
                  onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                  placeholder="e.g., operator1"
                  required
                />
              </div>
              <div className="admin-form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  placeholder="e.g., Operator Satu"
                  required
                />
              </div>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  placeholder="e.g., operator@example.com"
                  required
                />
              </div>
              <div className="admin-form-group">
                <label>Password {editingUser && '(leave blank to keep current)'}</label>
                <input
                  type="password"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder={editingUser ? '••••••••' : 'Enter password'}
                  {...(!editingUser && { required: true })}
                />
              </div>
            </div>
            <div className="admin-form-group">
              <label>Role</label>
              <select
                value={userFormData.role}
                onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
              >
                <option value="operator">Operator (Access to Operator Panel + Gate)</option>
                <option value="admin">Admin (Access to Admin Panel - All Tenants)</option>
              </select>
            </div>
            
            {userFormData.role === 'operator' && (
              <div className="admin-form-group">
                <label>Gate Access Permissions</label>
                <div className="admin-checkbox-group">
                  <label className="admin-checkbox-label">
                    <input
                      type="checkbox"
                      checked={userFormData.gateFront}
                      onChange={(e) => setUserFormData({ ...userFormData, gateFront: e.target.checked })}
                    />
                    <Camera size={16} />
                    <span>Front Gate (Scan QR)</span>
                  </label>
                  <label className="admin-checkbox-label">
                    <input
                      type="checkbox"
                      checked={userFormData.gateBack}
                      onChange={(e) => setUserFormData({ ...userFormData, gateBack: e.target.checked })}
                    />
                    <MonitorSmartphone size={16} />
                    <span>Back Gate (Monitor)</span>
                  </label>
                </div>
              </div>
            )}

            <div className="admin-form-actions">
              <button type="button" className="admin-btn-secondary" onClick={closeUserForm}>
                Cancel
              </button>
              <button type="submit" className="admin-btn-primary">
                {editingUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tenants List */}
      <div className="admin-tenant-list">
        {tenants.map(tenant => (
          <div key={tenant.id} className="admin-tenant-card">
            <div className="admin-tenant-header" onClick={() => toggleExpandTenant(tenant.id)}>
              <div className="admin-tenant-info">
                <div className="admin-tenant-icon">
                  <Building2 size={20} />
                </div>
                <div className="admin-tenant-details">
                  <h4>{tenant.name}</h4>
                  <span className="admin-tenant-brand">{tenant.brand}</span>
                </div>
              </div>
              <div className="admin-tenant-meta">
                <span className={`admin-badge ${tenant.status}`}>{tenant.status}</span>
                <div className="admin-tenant-users">
                  <Users size={14} />
                  <span>{tenant.userList?.length || 0} users</span>
                </div>
                <button 
                  className="admin-btn-icon" 
                  onClick={(e) => { e.stopPropagation(); handleAddUser(tenant.id); }}
                  title="Add User"
                >
                  <UserPlus size={14} />
                </button>
                <button 
                  className="admin-btn-icon" 
                  onClick={(e) => { e.stopPropagation(); handleEditTenant(tenant); }}
                  title="Edit Tenant"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  className="admin-btn-icon danger" 
                  onClick={(e) => { e.stopPropagation(); handleDeleteTenant(tenant.id); }}
                  title="Delete Tenant"
                >
                  <Trash2 size={14} />
                </button>
                {expandedTenant === tenant.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
            </div>

            {/* Expanded Users List */}
            {expandedTenant === tenant.id && (
              <div className="admin-tenant-users-list">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Gate Access</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenant.userList?.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="admin-empty-row">No users in this tenant</td>
                      </tr>
                    ) : (
                      tenant.userList?.map(user => (
                        <tr key={user.id}>
                          <td>
                            <div className="admin-user-cell">
                              <div className="admin-user-avatar">{user.name.charAt(0)}</div>
                              <div className="admin-user-info">
                                <span className="admin-user-name">{user.name}</span>
                                <span className="admin-user-username">@{user.username}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`admin-role-badge ${getRoleBadgeClass(user.role)}`}>
                              {user.role === 'admin' ? <ShieldCheck size={12} /> : <Users size={12} />}
                              {user.role}
                            </span>
                          </td>
                          <td>
                            {user.role === 'operator' ? (
                              <div className="admin-gate-permissions">
                                {user.gatePermissions?.front && (
                                  <span className="admin-gate-badge front">
                                    <Camera size={12} /> Front
                                  </span>
                                )}
                                {user.gatePermissions?.back && (
                                  <span className="admin-gate-badge back">
                                    <MonitorSmartphone size={12} /> Back
                                  </span>
                                )}
                                {!user.gatePermissions?.front && !user.gatePermissions?.back && (
                                  <span className="admin-gate-badge none">No gate access</span>
                                )}
                              </div>
                            ) : (
                              <span className="admin-gate-badge all">All Access</span>
                            )}
                          </td>
                          <td>
                            <span className={`admin-badge ${user.is_active ? 'active' : 'inactive'}`}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div className="admin-table-actions">
                              <button 
                                className="admin-btn-icon" 
                                onClick={() => handleEditUser(tenant.id, user)}
                                title="Edit User"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                className="admin-btn-icon danger" 
                                onClick={() => handleDeleteUser(tenant.id, user.id)}
                                title="Delete User"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
