import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContextSaaS'
import { supabase } from '../../lib/supabase'

export default function GateUsers() {
  const { user } = useAuth()
  const [gateUsers, setGateUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    password: '',
    gate_assignment: 'front'
  })

  async function refreshGateUsers() {
    if (!user?.tenant_id) return
    
    setLoading(true)
    const { data, error } = await supabase
      .from('gate_users')
      .select('*')
      .eq('tenant_id', user.tenant_id)
      .eq('is_active', true)
      .order('name')
    
    if (!error) {
      setGateUsers(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    refreshGateUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.tenant_id])

  async function handleSubmit(e) {
    e.preventDefault()
    
    const userData = {
      tenant_id: user.tenant_id,
      username: formData.username.toLowerCase().trim(),
      name: formData.name.trim(),
      password_hash: formData.password,
      gate_assignment: formData.gate_assignment,
      is_active: true
    }
    
    if (editingUser) {
      const { error } = await supabase
        .from('gate_users')
        .update({
          name: userData.name,
          gate_assignment: userData.gate_assignment,
          ...(formData.password && { password_hash: formData.password })
        })
        .eq('id', editingUser.id)
      
      if (!error) {
        setShowModal(false)
        setEditingUser(null)
        refreshGateUsers()
      }
    } else {
      const { error } = await supabase
        .from('gate_users')
        .insert([userData])
      
      if (!error) {
        setShowModal(false)
        refreshGateUsers()
      }
    }
  }

  async function handleDelete(id) {
    if (!confirm('Yakin ingin menghapus petugas gate ini?')) return
    
    const { error } = await supabase
      .from('gate_users')
      .update({ is_active: false })
      .eq('id', id)
    
    if (!error) {
      refreshGateUsers()
    }
  }

  function openModal(user = null) {
    if (user) {
      setEditingUser(user)
      setFormData({
        username: user.username,
        name: user.name,
        password: '',
        gate_assignment: user.gate_assignment
      })
    } else {
      setEditingUser(null)
      setFormData({
        username: '',
        name: '',
        password: '',
        gate_assignment: 'front'
      })
    }
    setShowModal(true)
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gate Users</h1>
          <p className="text-gray-600">Kelola petugas gate untuk check-in</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Tambah Gate User
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">Username</th>
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Gate Assignment</th>
                <th className="px-4 py-3 text-left">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {gateUsers.map(gu => (
                <tr key={gu.id} className="border-t">
                  <td className="px-4 py-3">{gu.username}</td>
                  <td className="px-4 py-3">{gu.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-sm ${
                      gu.gate_assignment === 'front' ? 'bg-green-100 text-green-800' :
                      gu.gate_assignment === 'back' ? 'bg-blue-100 text-blue-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {gu.gate_assignment}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button 
                      onClick={() => openModal(gu)}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(gu.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">
              {editingUser ? 'Edit Gate User' : 'Tambah Gate User'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  disabled={editingUser}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Nama</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Password {editingUser && '(kosongkan jika tidak diubah)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                  required={!editingUser}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Gate Assignment</label>
                <select
                  value={formData.gate_assignment}
                  onChange={e => setFormData({...formData, gate_assignment: e.target.value})}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="front">Front Gate Only</option>
                  <option value="back">Back Gate Only</option>
                  <option value="both">Both Gates</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
