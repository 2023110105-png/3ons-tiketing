import * as XLSX from 'xlsx'

/**
 * Export data to exact Excel file (.xlsx) format
 */
export function exportToCSV(participants, dayNumber) {
  try {
    const headers = ['No', 'Ticket ID', 'Nama', 'Telepon', 'Kategori', 'Hari', 'Status', 'Waktu Check-in']

    const templateData = participants.map((p, i) => ({
      No: i + 1,
      'Ticket ID': p.ticket_id,
      Nama: p.name,
      Telepon: p.phone || '-',
      Kategori: p.category,
      Hari: `Hari ${p.day_number}`,
      Status: p.is_checked_in ? 'Hadir' : 'Belum Hadir',
      'Waktu Check-in': p.checked_in_at ? new Date(p.checked_in_at).toLocaleString('id-ID') : '-'
    }))

    const ws = XLSX.utils.json_to_sheet(templateData, { header: headers })
    
    const wscols = [
      { wch: 5 },  // No
      { wch: 15 }, // Ticket ID
      { wch: 25 }, // Nama
      { wch: 15 }, // Telepon
      { wch: 12 }, // Kategori
      { wch: 8 },  // Hari
      { wch: 12 }, // Status
      { wch: 20 }, // Waktu Check-in
    ]
    ws['!cols'] = wscols

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Peserta Hari ${dayNumber}`)

    XLSX.writeFile(wb, `Laporan_Peserta_Hari_${dayNumber}.xlsx`)
    return true
  } catch (error) {
    console.error('Error exporting to Excel', error)
    return false
  }
}

/**
 * Export check-in logs to actual Excel (.xlsx) file
 */
export function exportLogsToCSV(logs, dayNumber) {
  try {
    const headers = ['No', 'Waktu', 'Nama Peserta', 'Ticket ID', 'Kategori', 'Aksi', 'Scanned By']

    const templateData = logs.map((log, i) => ({
      No: i + 1,
      Waktu: new Date(log.timestamp).toLocaleString('id-ID'),
      'Nama Peserta': log.participant_name,
      'Ticket ID': log.participant_ticket,
      Kategori: log.participant_category,
      Aksi: log.action === 'check_in' ? 'Check-in' : log.action,
      'Scanned By': log.scanned_by
    }))

    const ws = XLSX.utils.json_to_sheet(templateData, { header: headers })

    const wscols = [
      { wch: 5 },  // No
      { wch: 20 }, // Waktu
      { wch: 25 }, // Nama Peserta
      { wch: 15 }, // Ticket ID
      { wch: 12 }, // Kategori
      { wch: 12 }, // Aksi
      { wch: 15 }, // Scanned By
    ]
    ws['!cols'] = wscols

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Log Check-in Hari ${dayNumber}`)

    XLSX.writeFile(wb, `Log_CheckIn_Hari_${dayNumber}.xlsx`)
    return true
  } catch (error) {
    console.error('Error exporting logs to Excel', error)
    return false
  }
}

/**
 * Export admin audit logs to Excel (.xlsx) file
 */
export function exportAdminLogsToCSV(logs) {
  try {
    const headers = ['No', 'Waktu', 'Actor', 'Severity', 'Aksi', 'Deskripsi']

    const templateData = logs.map((log, i) => ({
      No: i + 1,
      Waktu: new Date(log.timestamp).toLocaleString('id-ID'),
      Actor: log.actor || '-',
      Severity: (log.severity || '-').toUpperCase(),
      Aksi: log.action,
      Deskripsi: log.description
    }))

    const ws = XLSX.utils.json_to_sheet(templateData, { header: headers })

    ws['!cols'] = [
      { wch: 5 },
      { wch: 20 },
      { wch: 18 },
      { wch: 12 },
      { wch: 24 },
      { wch: 60 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Log Admin')

    XLSX.writeFile(wb, 'Audit_Log_Admin.xlsx')
    return true
  } catch (error) {
    console.error('Error exporting admin logs to Excel', error)
    return false
  }
}

/**
 * Export offline queue status + history to Excel (.xlsx)
 */
export function exportOfflineQueueReportToCSV(pendingItems, historyItems) {
  try {
    const wsPending = XLSX.utils.json_to_sheet(
      pendingItems.map((item, i) => ({
        No: i + 1,
        'Queue ID': item.id,
        Dibuat: new Date(item.created_at).toLocaleString('id-ID'),
        Diupdate: new Date(item.updated_at || item.created_at).toLocaleString('id-ID'),
        Source: item.source || '-',
        'Scanned By': item.scanned_by || '-',
        Attempts: item.attempts || 0,
        'Last Error': item.last_error || '-'
      }))
    )

    const wsHistory = XLSX.utils.json_to_sheet(
      historyItems.map((item, i) => ({
        No: i + 1,
        Waktu: new Date(item.timestamp).toLocaleString('id-ID'),
        Tipe: item.type,
        'Queue ID': item.payload?.queue_id || '-',
        Status: item.payload?.status || '-',
        Pesan: item.payload?.message || item.payload?.reason || '-',
        Attempts: item.payload?.attempts ?? '-'
      }))
    )

    wsPending['!cols'] = [
      { wch: 5 }, { wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 40 }
    ]
    wsHistory['!cols'] = [
      { wch: 5 }, { wch: 20 }, { wch: 22 }, { wch: 40 }, { wch: 12 }, { wch: 40 }, { wch: 10 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsPending, 'Pending Queue')
    XLSX.utils.book_append_sheet(wb, wsHistory, 'Queue History')

    XLSX.writeFile(wb, 'Offline_Queue_PostMortem.xlsx')
    return true
  } catch (error) {
    console.error('Error exporting offline queue report', error)
    return false
  }
}
