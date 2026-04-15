// AnalyticsStyles.js - v2.0 Modern Dashboard UI
export const analyticsStyles = {
  pageContainer: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
    padding: '24px',
  },
  
  pageHeader: {
    background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
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
    color: '#ddd6fe',
  },
  
  // Stats Grid
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  
  statCard: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  },
  
  statIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  
  statValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: '4px',
  },
  
  statLabel: {
    fontSize: '14px',
    color: '#64748b',
  },
  
  statChange: {
    fontSize: '13px',
    fontWeight: '600',
    marginTop: '8px',
  },
  
  // Chart Card
  chartCard: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    marginBottom: '24px',
  },
  
  chartHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  
  chartTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1e293b',
  },
  
  // Category breakdown
  categoryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  
  categoryItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px',
    background: '#f8fafc',
    borderRadius: '12px',
  },
  
  categoryBar: {
    height: '8px',
    borderRadius: '4px',
    background: '#e2e8f0',
    overflow: 'hidden',
    flex: 1,
    margin: '0 16px',
  },
  
  categoryFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  
  // Heatmap
  heatmapContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(12, 1fr)',
    gap: '4px',
  },
  
  heatmapCell: {
    aspectRatio: '1',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '600',
  },
  
  // Time selector
  timeSelector: {
    display: 'flex',
    gap: '8px',
    background: '#f1f5f9',
    padding: '4px',
    borderRadius: '10px',
  },
  
  timeButton: {
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  
  timeButtonActive: {
    background: '#ffffff',
    color: '#7c3aed',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  },
}

export const analyticsAnimations = `
  @keyframes count-up {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes bar-fill {
    from { width: 0; }
  }
  
  .animate-count {
    animation: count-up 0.5s ease-out forwards;
  }
  
  .animate-bar {
    animation: bar-fill 0.8s ease-out forwards;
  }
  
  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }
`

export default analyticsStyles
