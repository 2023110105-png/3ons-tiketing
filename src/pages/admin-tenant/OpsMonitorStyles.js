// OpsMonitor Page v2.0 - Modern UI Styles
export const opsMonitorStyles = {
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
    background: 'linear-gradient(135deg, rgba(16,185,129,0.03) 0%, rgba(59,130,246,0.03) 50%, rgba(245,158,11,0.03) 100%)',
    animation: 'gradientShift 15s ease infinite',
  },
  floatingShape1: {
    position: 'absolute',
    top: '8%',
    right: '12%',
    width: '320px',
    height: '320px',
    background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)',
    borderRadius: '50%',
    animation: 'float 10s ease-in-out infinite',
  },
  floatingShape2: {
    position: 'absolute',
    bottom: '18%',
    left: '8%',
    width: '220px',
    height: '220px',
    background: 'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)',
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
    color: '#10b981',
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

  // Actions
  actionsWrap: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  daySelect: {
    padding: '10px 16px',
    fontSize: '14px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    outline: 'none',
    background: 'white',
    cursor: 'pointer',
    fontWeight: 500,
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  btnSecondary: {
    background: 'white',
    color: '#374151',
    border: '2px solid #e5e7eb',
  },

  // Live Badge
  liveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: 'rgba(16,185,129,0.1)',
    color: '#10b981',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '20px',
  },
  liveDot: {
    width: '10px',
    height: '10px',
    background: '#10b981',
    borderRadius: '50%',
    animation: 'pulse 2s infinite',
  },

  // Stats Grid
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
    position: 'relative',
    zIndex: 1,
  },
  statCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 20px rgba(0,0,0,0.05)',
    border: '1px solid rgba(0,0,0,0.04)',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
  },
  statCardGreen: {
    borderLeft: '4px solid #10b981',
  },
  statCardBlue: {
    borderLeft: '4px solid #3b82f6',
  },
  statCardOrange: {
    borderLeft: '4px solid #f59e0b',
  },
  statCardRed: {
    borderLeft: '4px solid #ef4444',
  },
  statIconWrap: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  statIconGreen: {
    background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
    color: '#10b981',
  },
  statIconBlue: {
    background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
    color: '#3b82f6',
  },
  statIconOrange: {
    background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)',
    color: '#f59e0b',
  },
  statIconRed: {
    background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
    color: '#ef4444',
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#1f2937',
    marginBottom: '6px',
  },
  statLabel: {
    fontSize: '14px',
    color: '#6b7280',
    fontWeight: 500,
  },
  statTime: {
    fontSize: '13px',
    color: '#9ca3af',
    marginTop: '8px',
  },

  // Grid Layout
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
    position: 'relative',
    zIndex: 1,
  },

  // Card
  card: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 20px rgba(0,0,0,0.05)',
    border: '1px solid rgba(0,0,0,0.04)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid #f3f4f6',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2937',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: '20px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  badgeGray: {
    background: 'rgba(107,114,128,0.1)',
    color: '#6b7280',
  },

  // Gate Status
  gateList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  gateItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: '#f9fafb',
    borderRadius: '12px',
    border: '2px solid transparent',
    transition: 'all 0.2s ease',
  },
  gateIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
  },
  gateInfo: {
    flex: 1,
  },
  gateName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '4px',
  },
  gateStatus: {
    fontSize: '13px',
    color: '#6b7280',
  },
  gateBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: '20px',
  },

  // Activity List
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  activityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: '#f9fafb',
    borderRadius: '10px',
  },
  activityAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '2px',
  },
  activityMeta: {
    fontSize: '12px',
    color: '#6b7280',
  },
  activityTime: {
    fontSize: '12px',
    color: '#9ca3af',
  },

  // Status Colors
  statusOk: {
    background: 'rgba(16,185,129,0.1)',
    color: '#10b981',
    borderColor: 'rgba(16,185,129,0.2)',
  },
  statusWarn: {
    background: 'rgba(245,158,11,0.1)',
    color: '#f59e0b',
    borderColor: 'rgba(245,158,11,0.2)',
  },
  statusBad: {
    background: 'rgba(239,68,68,0.1)',
    color: '#ef4444',
    borderColor: 'rgba(239,68,68,0.2)',
  },
};

// Animation keyframes
export const opsMonitorAnimations = `
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
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }
`;

export default opsMonitorStyles;
