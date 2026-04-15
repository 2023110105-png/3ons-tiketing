import { useState } from 'react'
import { Building2, Plus, Edit2, Trash2, Users } from 'lucide-react'

export default function OwnerTenants() {
  const [tenants, setTenants] = useState([
    { id: 'tenant-default', name: '3oNs Digital', brand: 'Yamaha Music', users: 3, status: 'active' }
  ])
  const [showForm, setShowForm] = useState(false)
  const [editingTenant, setEditingTenant] = useState(null)
  const [formData, setFormData] = useState({ name: '', brand: '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editingTenant) {
      setTenants(tenants.map(t => t.id === editingTenant.id ? { ...t, ...formData } : t))
    } else {
      const newTenant = {
        id: `tenant-${Date.now()}`,
        name: formData.name,
        brand: formData.brand,
        users: 0,
        status: 'active'
      }
      setTenants([...tenants, newTenant])
    }
    setShowForm(false)
    setEditingTenant(null)
    setFormData({ name: '', brand: '' })
  }

  const handleEdit = (tenant) => {
    setEditingTenant(tenant)
    setFormData({ name: tenant.name, brand: tenant.brand })
    setShowForm(true)
  }

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this tenant?')) {
      setTenants(tenants.filter(t => t.id !== id))
    }
  }

  return (
    <div className="owner-tenants">
      <div className="owner-section-header">
        <h3>Tenant Management</h3>
        <button className="owner-btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Add Tenant
        </button>
      </div>

      {showForm && (
        <div className="owner-form-card">
          <h4>{editingTenant ? 'Edit Tenant' : 'Add New Tenant'}</h4>
          <form onSubmit={handleSubmit}>
            <div className="owner-form-group">
              <label>Tenant Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Yamaha Music School"
                required
              />
            </div>
            <div className="owner-form-group">
              <label>Brand Name</label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="e.g., Yamaha"
                required
              />
            </div>
            <div className="owner-form-actions">
              <button type="button" className="owner-btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="owner-btn-primary">
                {editingTenant ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="owner-table-container">
        <table className="owner-table">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Brand</th>
              <th>Users</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(tenant => (
              <tr key={tenant.id}>
                <td>
                  <div className="owner-table-cell">
                    <Building2 size={16} />
                    <span>{tenant.name}</span>
                  </div>
                </td>
                <td>{tenant.brand}</td>
                <td>
                  <div className="owner-table-cell">
                    <Users size={14} />
                    <span>{tenant.users}</span>
                  </div>
                </td>
                <td>
                  <span className={`owner-badge ${tenant.status}`}>{tenant.status}</span>
                </td>
                <td>
                  <div className="owner-table-actions">
                    <button className="owner-btn-icon" onClick={() => handleEdit(tenant)} title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button className="owner-btn-icon danger" onClick={() => handleDelete(tenant.id)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
