// WaDeliveryStyles.js - v2.0 Modern UI/UX
export const waStyles = {
  pageContainer: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    padding: '24px',
  },
  
  pageHeader: {
    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
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
    color: '#bbf7d0',
  },
  
  // Stats
  statsBar: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  
  statPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    background: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  },
  
  statValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#166534',
  },
  
  statLabel: {
    fontSize: '13px',
    color: '#64748b',
  },
  
  // Toolbar
  toolbar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  
  searchBox: {
    position: 'relative',
    flex: 1,
    minWidth: '280px',
  },
  
  searchInput: {
    width: '100%',
    padding: '12px 16px 12px 44px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    fontSize: '14px',
    color: '#1e293b',
  },
  
  // Filter chips
  filterContainer: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '20px',
  },
  
  filterChip: {
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '500',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  
  filterChipActive: {
    background: '#16a34a',
    color: '#ffffff',
    borderColor: '#16a34a',
  },
  
  // Table
  tableContainer: {
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr 1fr 1fr 120px',
    gap: '16px',
    padding: '16px 24px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '13px',
    fontWeight: '600',
    color: '#64748b',
  },
  
  tableRow: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr 1fr 1fr 120px',
    gap: '16px',
    padding: '16px 24px',
    borderBottom: '1px solid #f1f5f9',
    alignItems: 'center',
    transition: 'background 0.2s',
  },
  
  // Status badges
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
  },
  
  statusSent: {
    background: '#dcfce7',
    color: '#166534',
  },
  
  statusPending: {
    background: '#fef3c7',
    color: '#92400e',
  },
  
  statusFailed: {
    background: '#fee2e2',
    color: '#991b1b',
  },
  
  // Action buttons
  actionBtn: {
    padding: '8px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  
  actionBtnPrimary: {
    background: '#16a34a',
    color: '#ffffff',
  },
  
  actionBtnSecondary: {
    background: '#f1f5f9',
    color: '#64748b',
  },
  
  // Progress bar
  progressContainer: {
    width: '100%',
    height: '6px',
    background: '#e2e8f0',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #16a34a 0%, #22c55e 100%)',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
}

export const waAnimations = `
  @keyframes slide-in-right {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  
  @keyframes pulse-green {
    0%, 100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(22, 163, 74, 0); }
  }
  
  .animate-slide-in {
    animation: slide-in-right 0.3s ease-out forwards;
  }
  
  .sending-pulse {
    animation: pulse-green 1.5s ease-out infinite;
  }
  
  .table-row:hover {
    background: #f8fafc;
  }
`

export default waStyles
