// QRGenerateStyles.js - v2.0 Modern UI/UX Styles
// Separated from QRGenerate.jsx for maintainability

export const qrStyles = {
  // Page container
  pageContainer: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)',
    padding: '24px',
  },
  
  // Header styles
  pageHeader: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    borderRadius: '16px',
    padding: '24px 32px',
    marginBottom: '24px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },
  
  pageTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '8px',
  },
  
  pageSubtitle: {
    fontSize: '14px',
    color: '#94a3b8',
  },
  
  pageKicker: {
    display: 'inline-block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#0ea5e9',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '12px',
  },
  
  // Card styles
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
  },
  
  cardHeader: {
    padding: '20px 24px',
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
  
  // Toolbar styles
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 24px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    flexWrap: 'wrap',
  },
  
  toolbarSelect: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    background: '#ffffff',
    fontSize: '14px',
    color: '#374151',
    cursor: 'pointer',
    minWidth: '180px',
  },
  
  // Search styles
  searchContainer: {
    position: 'relative',
    marginBottom: '16px',
  },
  
  searchInput: {
    width: '100%',
    padding: '12px 16px 12px 44px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    fontSize: '14px',
    color: '#1e293b',
    transition: 'all 0.2s',
  },
  
  searchIcon: {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#94a3b8',
  },
  
  // Participant list styles
  participantList: {
    maxHeight: '600px',
    overflowY: 'auto',
  },
  
  participantItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #f1f5f9',
    cursor: 'pointer',
    transition: 'all 0.2s',
    ':hover': {
      background: '#f8fafc',
    },
  },
  
  participantItemActive: {
    background: '#eff6ff',
    borderLeft: '3px solid #3b82f6',
  },
  
  participantAvatar: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: '600',
    marginRight: '16px',
  },
  
  participantInfo: {
    flex: 1,
  },
  
  participantName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '4px',
  },
  
  participantMeta: {
    fontSize: '13px',
    color: '#64748b',
  },
  
  participantActions: {
    display: 'flex',
    gap: '8px',
  },
  
  // QR Preview styles
  qrPreviewCard: {
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    borderRadius: '20px',
    padding: '32px',
    textAlign: 'center',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  
  qrImage: {
    width: '200px',
    height: '200px',
    borderRadius: '12px',
    background: '#ffffff',
    padding: '16px',
    marginBottom: '20px',
  },
  
  qrPreviewTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '8px',
  },
  
  qrPreviewSubtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    marginBottom: '24px',
  },
  
  // Tab styles
  tabContainer: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    background: '#f1f5f9',
    padding: '6px',
    borderRadius: '12px',
  },
  
  tab: {
    padding: '10px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#64748b',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  
  tabActive: {
    background: '#ffffff',
    color: '#0ea5e9',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  },
  
  // Button styles
  btnPrimary: {
    padding: '10px 20px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    ':hover': {
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 12px rgba(14, 165, 233, 0.4)',
    },
  },
  
  btnSecondary: {
    padding: '10px 20px',
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
    transition: 'all 0.2s',
  },
  
  btnGhost: {
    padding: '8px',
    borderRadius: '8px',
    background: 'transparent',
    color: '#64748b',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
    ':hover': {
      background: '#f1f5f9',
      color: '#0ea5e9',
    },
  },
  
  // Badge styles
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
  },
  
  badgeBlue: {
    background: '#dbeafe',
    color: '#1d4ed8',
  },
  
  badgeGreen: {
    background: '#d1fae5',
    color: '#047857',
  },
  
  badgeRed: {
    background: '#fee2e2',
    color: '#dc2626',
  },
  
  // Empty state
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    color: '#64748b',
  },
  
  emptyStateIcon: {
    width: '64px',
    height: '64px',
    margin: '0 auto 16px',
    color: '#cbd5e1',
  },
  
  // Modal styles
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    backdropFilter: 'blur(4px)',
  },
  
  modal: {
    background: '#ffffff',
    borderRadius: '20px',
    width: '90%',
    maxWidth: '480px',
    maxHeight: '90vh',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0',
  },
  
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1e293b',
  },
  
  modalBody: {
    padding: '24px',
  },
  
  modalFooter: {
    display: 'flex',
    gap: '12px',
    padding: '20px 24px',
    borderTop: '1px solid #e2e8f0',
    justifyContent: 'flex-end',
  },
  
  // Progress bar
  progressBar: {
    width: '100%',
    height: '8px',
    background: '#e2e8f0',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #0ea5e9 0%, #06b6d4 100%)',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  
  // Mobile styles
  mobileHeader: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    padding: '20px',
    borderRadius: '0 0 20px 20px',
    marginBottom: '16px',
  },
  
  mobileTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '4px',
  },
  
  mobileSubtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    marginTop: '4px',
  },
  
  mobileCard: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '12px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  },
  
  mobileKicker: {
    display: 'inline-block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#60a5fa',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px',
  },
}

// Animations
export const qrAnimations = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .animate-fade-in {
    animation: fadeIn 0.3s ease-out forwards;
  }
  
  .animate-scale-in {
    animation: scaleIn 0.3s ease-out forwards;
  }
  
  .animate-slide-in {
    animation: slideIn 0.3s ease-out forwards;
  }
  
  .animate-pulse {
    animation: pulse 2s ease-in-out infinite;
  }
`

export default qrStyles
