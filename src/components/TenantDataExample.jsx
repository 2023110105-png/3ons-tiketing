// Example: Using Tenant-Isolated Data with Realtime
import React from 'react';
import { useParticipants, useCheckIns, useTenantStats } from '../hooks/useTenantData';

export function ParticipantsList({ day = 1 }) {
  const { participants, loading, error, addParticipant, removeParticipant } = useParticipants(day);

  if (loading) return <div>Loading participants...</div>;
  if (error) return <div>Error: {error}</div>;

  const handleAdd = async () => {
    await addParticipant({
      ticket_id: 'TICKET-001',
      name: 'John Doe',
      phone: '+628123456789',
      category: 'VIP',
      day: day
    });
  };

  return (
    <div>
      <h2>Participants (Day {day})</h2>
      <p>Count: {participants.length} | Auto-updates in realtime!</p>
      <button onClick={handleAdd}>Add Test Participant</button>
      
      <ul>
        {participants.map(p => (
          <li key={p.id}>
            {p.name} - {p.ticket_id}
            <button onClick={() => removeParticipant(p.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CheckInMonitor({ day = 1 }) {
  const { checkIns, loading, addCheckIn } = useCheckIns(day);
  const { stats } = useTenantStats(day);

  if (loading) return <div>Loading check-ins...</div>;

  const handleCheckIn = async () => {
    await addCheckIn('TICKET-001', {
      gate_id: 'gate-1',
      gate_name: 'Front Gate',
      day: day
    });
  };

  return (
    <div>
      <h2>Live Check-ins</h2>
      
      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
        <div style={{ padding: 20, background: '#f0f0f0', borderRadius: 8 }}>
          <h3>{stats.total}</h3>
          <p>Total Participants</p>
        </div>
        <div style={{ padding: 20, background: '#d4edda', borderRadius: 8 }}>
          <h3>{stats.checkedIn}</h3>
          <p>Checked In</p>
        </div>
        <div style={{ padding: 20, background: '#f8d7da', borderRadius: 8 }}>
          <h3>{stats.notCheckedIn}</h3>
          <p>Not Checked In</p>
        </div>
        <div style={{ padding: 20, background: '#d1ecf1', borderRadius: 8 }}>
          <h3>{stats.percentage}%</h3>
          <p>Attendance Rate</p>
        </div>
      </div>

      <button onClick={handleCheckIn}>Simulate Check-in</button>

      <h3>Recent Check-ins (Auto-updating)</h3>
      <ul>
        {checkIns.slice(0, 10).map(c => (
          <li key={c.id}>
            {c.ticket_id} at {new Date(c.checked_in_at).toLocaleTimeString()}
            via {c.gate_name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default { ParticipantsList, CheckInMonitor };
