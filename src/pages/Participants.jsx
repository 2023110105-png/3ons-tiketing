import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Participants() {
  const [peserta, setPeserta] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPeserta() {
      setLoading(true);
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .order('nama', { ascending: true });
      if (error) {
        alert('Gagal fetch data: ' + error.message);
      } else {
        setPeserta(data);
      }
      setLoading(false);
    }
    fetchPeserta();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Daftar Peserta</h2>
      <ul>
        {peserta.map((p) => (
          <li key={p.nama + p.telepon}>
            {p.nama} ({p.kategori}, Hari {p.hari})
          </li>
        ))}
      </ul>
    </div>
  );
}
