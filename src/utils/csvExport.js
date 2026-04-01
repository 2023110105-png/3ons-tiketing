/**
 * Export data to exact Excel file (.xlsx) format
 */
export async function exportToCSV(participants, dayNumber) {
  try {
    const XLSX = await import('xlsx')
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

    XLSX.writeFile(wb, `Laporan_Peserta_Hari_${dayNumber}_Yamaha_Event.xlsx`)
    return true
  } catch (error) {
    console.error('Error exporting to Excel', error)
    return false
  }
}

/**
 * Export check-in logs to actual Excel (.xlsx) file
 */
export async function exportLogsToCSV(logs, dayNumber) {
  try {
    const XLSX = await import('xlsx')
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

    XLSX.writeFile(wb, `Log_CheckIn_Hari_${dayNumber}_Yamaha_Event.xlsx`)
    return true
  } catch (error) {
    console.error('Error exporting logs to Excel', error)
    return false
  }
}
