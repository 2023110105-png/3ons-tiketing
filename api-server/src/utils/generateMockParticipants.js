const fs = require('fs');
const parse = require('csv-parse/sync').parse;

/**
 * Membaca data peserta dari file CSV dan mengembalikan array peserta.
 * @param {string} filePath - Path ke file CSV
 * @returns {Array<{nama: string, telepon: string, kategori: string, hari: string}>}
 */
function readParticipantsFromCSV(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  // Normalisasi kolom dan hasilkan array peserta
  return records.map(row => ({
    nama: row.nama,
    telepon: row.telepon,
    kategori: row.kategori,
    hari: row.hari,
  }));
}

/**
 * Menghasilkan array peserta dari dua file CSV (day 1 dan day 2)
 * @param {string} day1Path - Path ke file CSV hari 1
 * @param {string} day2Path - Path ke file CSV hari 2
 * @returns {Array<{nama: string, telepon: string, kategori: string, hari: string}>}
 */
function generateMockParticipants(day1Path, day2Path) {
  const participantsDay1 = readParticipantsFromCSV(day1Path);
  const participantsDay2 = readParticipantsFromCSV(day2Path);
  return [...participantsDay1, ...participantsDay2];
}



// Otomatis baca file CSV dari folder data project (agar bisa di-deploy)
const path = require('path');
const pathDay1 = path.join(__dirname, '../../data/day_1.csv');
const pathDay2 = path.join(__dirname, '../../data/day2.csv');
let allParticipants = [];
try {
  allParticipants = generateMockParticipants(pathDay1, pathDay2);
} catch (err) {
  // Jika file tidak ditemukan atau error, allParticipants tetap array kosong
  console.error('Gagal membaca file peserta:', err.message);
}

module.exports = {
  readParticipantsFromCSV,
  generateMockParticipants,
  allParticipants,
};
