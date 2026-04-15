// ConnectDeviceStyles.js - v2.0 Modern UI/UX
export const deviceStyles = {
  pageContainer: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
    padding: '24px',
  },
  
  pageHeader: {
    background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)',
    borderRadius: '16px',
    padding: '32px',
    marginBottom: '24px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  },
  
  pageTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '8px',
  },
  
  pageSubtitle: {
    fontSize: '14px',
    color: '#bae6fd',
  },
  
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  
  cardHeader: {
    padding: '24px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1e293b',
  },
  
  cardBody: {
    padding: '24px',
  },
  
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
  },
  
  statusConnected: {
    background: '#dcfce7',
    color: '#166534',
  },
  
  statusDisconnected: {
    background: '#fee2e2',
    color: '#991b1b',
  },
  
  btnPrimary: {
    padding: '12px 24px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
  },
  
  btnSecondary: {
    padding: '12px 24px',
    borderRadius: '10px',
    background: '#f1f5f9',
    color: '#475569',
    fontSize: '14px',
    fontWeight: '600',
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  
  deviceCard: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  
  deviceIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#2563eb',
  },
  
  deviceInfo: {
    flex: 1,
  },
  
  deviceName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '4px',
  },
  
  deviceMeta: {
    fontSize: '13px',
    color: '#64748b',
  },
}

export const deviceAnimations = `
  @keyframes pulse-ring {
    0% { transform: scale(0.8); opacity: 0.5; }
    100% { transform: scale(1.2); opacity: 0; }
  }
  
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-slide-up {
    animation: slide-up 0.4s ease-out forwards;
  }
  
  .status-pulse::before {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.3;
    animation: pulse-ring 2s ease-out infinite;
  }
`

export default deviceStyles
