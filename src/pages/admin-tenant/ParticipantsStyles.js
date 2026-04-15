// Participants Page v2.0 - Modern UI Styles
export const participantsStyles = {
  // Page Layout
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    padding: '24px',
    position: 'relative',
    overflow: 'hidden',
  },
  
  // Animated Background
  bgDecorative: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: 0,
  },
  bgGradient: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(135deg, rgba(239,68,68,0.02) 0%, rgba(59,130,246,0.02) 50%, rgba(16,185,129,0.02) 100%)',
    animation: 'gradientShift 15s ease infinite',
  },
  floatingShape1: {
    position: 'absolute',
    top: '5%',
    right: '10%',
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(239,68,68,0.05) 0%, transparent 70%)',
    borderRadius: '50%',
    animation: 'float 10s ease-in-out infinite',
  },
  floatingShape2: {
    position: 'absolute',
    bottom: '10%',
    left: '5%',
    width: '300px',
    height: '300px',
    background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)',
    borderRadius: '50%',
    animation: 'float2 12s ease-in-out infinite',
  },

  // Header
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
    position: 'relative',
    zIndex: 1,
  },
  headerLeft: {
    flex: 1,
  },
  kicker: {
    fontSize: '13px',
    color: '#ef4444',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
    display: 'block',
  },
  title: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#1f2937',
    marginBottom: '8px',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '15px',
    color: '#6b7280',
    maxWidth: '600px',
  },

  // Stats Cards
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
    position: 'relative',
    zIndex: 1,
  },
  statCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 20px rgba(0,0,0,0.05)',
    border: '1px solid rgba(0,0,0,0.04)',
  },
  statIconWrap: {
    width: '48px',
    height: '48px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
  },
  statIconBlue: {
    background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
  },
  statIconGreen: {
    background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
  },
  statIconOrange: {
    background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)',
  },
  statIconPurple: {
    background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0.05) 100%)',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1f2937',
    marginBottom: '2px',
  },
  statLabel: {
    fontSize: '13px',
    color: '#6b7280',
    fontWeight: 500,
  },

  // Toolbar
  toolbar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    flexWrap: 'wrap',
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
    background: 'white',
    padding: '16px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  searchBox: {
    flex: 1,
    minWidth: '280px',
    position: 'relative',
  },
  searchInput: {
    width: '100%',
    padding: '12px 16px 12px 44px',
    fontSize: '14px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box',
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#9ca3af',
    pointerEvents: 'none',
  },
  filterSelect: {
    padding: '12px 16px',
    fontSize: '14px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    outline: 'none',
    background: 'white',
    cursor: 'pointer',
    minWidth: '140px',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
  },
  btnSecondary: {
    background: 'white',
    color: '#374151',
    border: '2px solid #e5e7eb',
  },
  btnSuccess: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
  },

  // Table
  tableContainer: {
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHead: {
    background: '#f9fafb',
    borderBottom: '2px solid #e5e7eb',
  },
  tableHeadCell: {
    padding: '14px 16px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    textAlign: 'left',
  },
  tableRow: {
    borderBottom: '1px solid #f3f4f6',
    transition: 'background 0.2s ease',
  },
  tableRowHover: {
    background: '#f9fafb',
  },
  tableCell: {
    padding: '16px',
    fontSize: '14px',
    color: '#374151',
  },
  ticketId: {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#6b7280',
    background: '#f3f4f6',
    padding: '4px 8px',
    borderRadius: '6px',
  },
  categoryBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: '20px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  badgeVIP: {
    background: 'rgba(239,68,68,0.1)',
    color: '#ef4444',
  },
  badgeDealer: {
    background: 'rgba(59,130,246,0.1)',
    color: '#3b82f6',
  },
  badgeMedia: {
    background: 'rgba(245,158,11,0.1)',
    color: '#f59e0b',
  },
  badgeRegular: {
    background: 'rgba(107,114,128,0.1)',
    color: '#6b7280',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: '20px',
  },
  statusChecked: {
    background: 'rgba(16,185,129,0.1)',
    color: '#10b981',
  },
  statusUnchecked: {
    background: 'rgba(107,114,128,0.1)',
    color: '#6b7280',
  },
  actionButtons: {
    display: 'flex',
    gap: '6px',
  },
  actionBtnSmall: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    background: 'transparent',
  },

  // Empty State
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    textAlign: 'center',
  },
  emptyIcon: {
    width: '80px',
    height: '80px',
    background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
    color: '#9ca3af',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '14px',
    color: '#6b7280',
  },

  // Summary
  summary: {
    marginTop: '16px',
    padding: '12px 16px',
    background: 'white',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#6b7280',
    textAlign: 'center',
    position: 'relative',
    zIndex: 1,
  },
};

// Animation keyframes for inline styles
export const participantsAnimations = `
  @keyframes gradientShift {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.6; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0) translateX(0); }
    50% { transform: translateY(-20px) translateX(10px); }
  }
  @keyframes float2 {
    0%, 100% { transform: translateY(0) translateX(0); }
    50% { transform: translateY(15px) translateX(-10px); }
  }
`;

export default participantsStyles;
