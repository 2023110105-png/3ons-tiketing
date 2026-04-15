// Settings Page v2.0 - Modern UI Styles
export const settingsStyles = {
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
    background: 'linear-gradient(135deg, rgba(139,92,246,0.03) 0%, rgba(59,130,246,0.03) 50%, rgba(16,185,129,0.03) 100%)',
    animation: 'gradientShift 15s ease infinite',
  },
  floatingShape1: {
    position: 'absolute',
    top: '10%',
    right: '5%',
    width: '300px',
    height: '300px',
    background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
    borderRadius: '50%',
    animation: 'float 10s ease-in-out infinite',
  },
  floatingShape2: {
    position: 'absolute',
    bottom: '20%',
    left: '10%',
    width: '200px',
    height: '200px',
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
    color: '#8b5cf6',
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

  // Settings Grid
  settingsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
    marginBottom: '32px',
    position: 'relative',
    zIndex: 1,
  },

  // Setting Card
  settingCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 4px 20px rgba(0,0,0,0.05)',
    border: '1px solid rgba(0,0,0,0.04)',
    transition: 'all 0.3s ease',
  },
  settingCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid #f3f4f6',
  },
  settingIconWrap: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
  },
  settingIconPurple: {
    background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0.05) 100%)',
  },
  settingIconBlue: {
    background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
  },
  settingIconGreen: {
    background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
  },
  settingIconRed: {
    background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
  },
  settingTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '2px',
  },
  settingDesc: {
    fontSize: '13px',
    color: '#6b7280',
  },

  // Form Elements
  formGroup: {
    marginBottom: '20px',
  },
  formLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '8px',
  },
  formInput: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box',
  },
  formTextarea: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box',
    minHeight: '120px',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  formSelect: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    outline: 'none',
    background: 'white',
    cursor: 'pointer',
    boxSizing: 'border-box',
  },

  // Toggle Switch
  toggleWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    background: '#f9fafb',
    borderRadius: '12px',
    marginBottom: '12px',
  },
  toggleLabel: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
  },
  toggleDesc: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '2px',
  },

  // Action Buttons
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    width: '100%',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
  },
  btnSecondary: {
    background: 'white',
    color: '#374151',
    border: '2px solid #e5e7eb',
  },
  btnDanger: {
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
  },
  btnSuccess: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
  },

  // Info Box
  infoBox: {
    display: 'flex',
    gap: '12px',
    padding: '16px',
    background: 'linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(59,130,246,0.02) 100%)',
    borderRadius: '12px',
    border: '1px solid rgba(59,130,246,0.1)',
    marginBottom: '20px',
  },
  infoIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(59,130,246,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#3b82f6',
    flexShrink: 0,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '4px',
  },
  infoText: {
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: '1.5',
  },

  // Danger Zone
  dangerZone: {
    background: 'linear-gradient(135deg, rgba(239,68,68,0.05) 0%, rgba(239,68,68,0.02) 100%)',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid rgba(239,68,68,0.2)',
  },
  dangerTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#ef4444',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  dangerDesc: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '20px',
  },
};

// Animation keyframes
export const settingsAnimations = `
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

export default settingsStyles;
