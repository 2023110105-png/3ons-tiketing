// Reports Page v2.0 - Modern UI Styles
export const reportsStyles = {
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
    background: 'linear-gradient(135deg, rgba(245,158,11,0.03) 0%, rgba(59,130,246,0.03) 50%, rgba(16,185,129,0.03) 100%)',
    animation: 'gradientShift 15s ease infinite',
  },
  floatingShape1: {
    position: 'absolute',
    top: '5%',
    right: '15%',
    width: '350px',
    height: '350px',
    background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)',
    borderRadius: '50%',
    animation: 'float 10s ease-in-out infinite',
  },
  floatingShape2: {
    position: 'absolute',
    bottom: '15%',
    left: '10%',
    width: '250px',
    height: '250px',
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
    color: '#f59e0b',
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
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 20px rgba(0,0,0,0.05)',
    border: '1px solid rgba(0,0,0,0.04)',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
  },
  statCardBlue: {
    borderLeft: '4px solid #3b82f6',
  },
  statCardGreen: {
    borderLeft: '4px solid #10b981',
  },
  statCardOrange: {
    borderLeft: '4px solid #f59e0b',
  },
  statCardPurple: {
    borderLeft: '4px solid #8b5cf6',
  },
  statIconWrap: {
    width: '52px',
    height: '52px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '26px',
    background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.05) 100%)',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#1f2937',
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '14px',
    color: '#6b7280',
    fontWeight: 500,
  },

  // Export Cards
  exportGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px',
    position: 'relative',
    zIndex: 1,
  },
  exportCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    border: '1px solid rgba(0,0,0,0.04)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  exportIconWrap: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportIconRed: {
    background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
    color: '#ef4444',
  },
  exportIconGreen: {
    background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
    color: '#10b981',
  },
  exportIconBlue: {
    background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
    color: '#3b82f6',
  },
  exportIconOrange: {
    background: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 100%)',
    color: '#f59e0b',
  },
  exportContent: {
    flex: 1,
  },
  exportTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '2px',
  },
  exportDesc: {
    fontSize: '12px',
    color: '#6b7280',
  },
};

// Animation keyframes
export const reportsAnimations = `
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

export default reportsStyles;
