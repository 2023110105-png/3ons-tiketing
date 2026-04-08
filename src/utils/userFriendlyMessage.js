/**
 * Mengubah pesan error/teknis dari API, jaringan, atau runtime
 * menjadi bahasa yang mudah dipahami pengguna akhir (Bahasa Indonesia).
 */

const HTTP_STATUS_ID = {
  400: 'Permintaan tidak dapat diproses. Coba lagi atau hubungi administrator.',
  401: 'Sesi habis atau Anda belum masuk. Silakan masuk lagi.',
  403: 'Akses ditolak untuk tindakan ini.',
  404: 'Layanan atau data tidak ditemukan.',
  408: 'Permintaan habis waktu. Coba lagi.',
  409: 'Data bentrok dengan data yang ada. Segarkan halaman lalu coba lagi.',
  413: 'Data terlalu besar untuk dikirim.',
  422: 'Data yang dikirim tidak valid.',
  429: 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.',
  500: 'Server sedang bermasalah. Coba lagi nanti.',
  502: 'Layanan sementara tidak terjangkau.',
  503: 'Layanan sedang sibuk. Coba lagi nanti.',
  504: 'Server tidak merespons tepat waktu.'
}

function stripHttpPrefix(text) {
  const m = String(text || '').match(/^HTTP\s+(\d{3})\b/i)
  return m ? m[1] : null
}

/**
 * @param {unknown} input
 * @param {{ fallback?: string }} [options]
 * @returns {string}
 */
export function humanizeUserMessage(input, options = {}) {
  const fallback = options.fallback || 'Terjadi kesalahan. Silakan coba lagi.'
  if (input == null) return fallback

  let text = String(input).trim()
  if (!text) return fallback

  const lower = text.toLowerCase()

  // HTTP status (plain or embedded)
  const codeFromPrefix = stripHttpPrefix(text)
  if (codeFromPrefix && HTTP_STATUS_ID[codeFromPrefix]) {
    return HTTP_STATUS_ID[codeFromPrefix]
  }

  const statusMatch = lower.match(/\b(?:status|kode)\s*:?\s*(\d{3})\b/) || lower.match(/\b(\d{3})\b/)
  if (statusMatch && HTTP_STATUS_ID[statusMatch[1]]) {
    return HTTP_STATUS_ID[statusMatch[1]]
  }

  // Network / browser
  if (/failed to fetch|networkerror|network request failed|load failed|err_connection|connection refused|net::/i.test(text)) {
    return 'Tidak ada sambungan ke server. Periksa internet atau coba lagi.'
  }

  if (/abort|timed?\s*out|timeout/i.test(text)) {
    return 'Permintaan habis waktu. Coba lagi.'
  }

  // English fragments often returned by APIs
  if (/^unauthorized$/i.test(text)) return HTTP_STATUS_ID[401]
  if (/^forbidden$/i.test(text)) return HTTP_STATUS_ID[403]
  if (/^not found$/i.test(text)) return HTTP_STATUS_ID[404]

  if (lower.includes('invalid json') || lower.includes('unexpected token')) {
    return 'Format data dari server tidak dikenali. Coba lagi.'
  }

  if (lower.includes('firebase') || lower.includes('firestore')) {
    return 'Layanan data sedang bermasalah. Coba lagi beberapa saat.'
  }

  if (lower.includes('api key') || lower.includes('permission denied')) {
    return 'Akses ditolak oleh sistem. Hubungi administrator.'
  }

  // Sudah berbahasa Indonesia — biarkan jika tidak menyisipkan istilah teknis jelas
  if (
    /tidak|gagal|berhasil|periksa|hubungi|coba|masuk|sand|valid|data|server|koneksi|akun|pengguna/i.test(text) &&
    !/http\s*\d|json|endpoint|undefined|null|stack trace|error:/i.test(text)
  ) {
    return text
  }

  if (/^(error|typeerror|referenceerror|syntaxerror)\s*:/i.test(text)) {
    return fallback
  }

  if (/undefined|null|nan|\[object object\]/i.test(text)) {
    return fallback
  }

  return text
}

export default humanizeUserMessage
