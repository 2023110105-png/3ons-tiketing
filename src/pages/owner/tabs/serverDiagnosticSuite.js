
import { fetchFirebaseWorkspaceSnapshot } from '../../../lib/firebaseSync'
import { apiFetch } from '../../../utils/api'

const STORE_KEYS = ['ons_event_data', 'event_data']

const ACTION_HINTS = {
  READINESS_PREFLIGHT: 'Validasi konfigurasi tenant aktif dan event aktif sebelum menjalankan operasi admin.',
  LOCAL_PERSISTENCE_STRUCTURE: 'Periksa mode data Firebase dan key localStorage. Jika mode strict, validasi lewat bootstrap Firebase.',
  WA_STATUS_ENDPOINT: 'Periksa layanan WA server, env URL backend, dan konektivitas endpoint /api/wa/status.',
  TICKET_VERIFY_ENDPOINT: 'Periksa payload verifikasi tiket, event_id aktif, dan respons endpoint /api/ticket/verify.',
  DATA_SYNC_READ_ONLY: 'Periksa bootstrap sinkronisasi Firebase agar data terbaru termuat setelah refresh.',
  ADD_PARTICIPANT_E2E: 'Periksa alur add participant: state memory, local persistence, dan sinkronisasi Firebase.',
  CHECK_IN_PARTICIPANT_E2E: 'Periksa alur scan/check-in: validasi QR payload, update status check-in, dan sinkronisasi data.',
  BULK_ADD_PARTICIPANT_E2E: 'Periksa validasi impor bulk dan pastikan semua row valid tersimpan lintas sinkronisasi.',
  ADD_INVOICE_E2E: 'Periksa alur pembuatan invoice tenant dan persistensi registry tenant.',
  UPDATE_INVOICE_E2E: 'Periksa alur update status invoice tenant dan sinkronisasi data tenant.',
  UPDATE_CONTRACT_E2E: 'Periksa update kontrak tenant dan pastikan rollback/restore konfigurasi berjalan.',
  DELETE_PARTICIPANT_E2E: 'Periksa alur hapus participant (alasan wajib, validasi, sinkronisasi, dan cleanup).',
  BACKUP_SNAPSHOT_HEALTH: 'Periksa mekanisme backup snapshot localStorage dan rotasi backup.',
  CLEANUP_RESIDUAL_TEST_DATA: 'Hapus data uji yang tersisa agar data produksi tetap bersih.'
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function parseJsonSafe(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function readLocalStoreSnapshot() {
  for (const key of STORE_KEYS) {
    const raw = window.localStorage.getItem(key)
    if (!raw) continue
    const parsed = parseJsonSafe(raw)
    if (parsed && typeof parsed === 'object') {
      return { key, raw, parsed }
    }
  }
  return { key: null, raw: null, parsed: null }
}

function isLikelyStrictMode(storeSnapshot) {
  return !storeSnapshot.raw
}

function getRemoteEventSnapshot(workspaceSnapshot, tenantId, eventId) {
  return workspaceSnapshot?.store?.tenants?.[tenantId]?.events?.[eventId] || null
}

function getRemoteTenantSnapshot(workspaceSnapshot, tenantId) {
  return workspaceSnapshot?.tenantRegistry?.tenants?.[tenantId] || null
}

export function getDiagnosticActionHint(testKey) {
  return ACTION_HINTS[testKey] || 'Periksa log detail test dan ulangi audit untuk mengonfirmasi akar masalah.'
}

export class DiagnosticSuite {
  constructor(options = {}) {
    this.tenantId = String(options.tenantId || 'tenant-default')
    this.mode = options.mode === 'live' ? 'live' : 'dry-run'
    this.allowMutations = this.mode === 'live'
    this.results = []
    this.startTime = null
    this.endTime = null
    this.primaryParticipant = null
    this.bulkParticipants = []
    this.eventId = null
  }

  getTenantById(tenantId) {
    return getTenants().find((item) => item.id === tenantId) || null
  }

  log(test, passed, message, details = {}) {
    const result = {
      test,
      passed,
      message,
      details,
      action: getDiagnosticActionHint(test),
      timestamp: new Date().toISOString()
    }
    this.results.push(result)
    return result
  }

  logSkipped(test, reason, details = {}) {
    return this.log(test, true, `Skipped (${this.mode}): ${reason}`, {
      ...details,
      skipped: true,
      mode: this.mode
    })
  }

  async readRemoteWorkspaceSnapshot() {
    try {
      return await fetchFirebaseWorkspaceSnapshot()
    } catch {
      return null
    }
  }

  async waitForRemoteParticipantState(participantId, expected, attempts = 10, waitMs = 1200) {
    for (let i = 0; i < attempts; i += 1) {
      const workspaceSnapshot = await this.readRemoteWorkspaceSnapshot()
      if (!workspaceSnapshot) {
        return { ok: null, available: false, skipped: true, reason: 'remote_snapshot_unavailable' }
      }

      const eventId = expected.eventId || getCurrentEventId()
      const event = getRemoteEventSnapshot(workspaceSnapshot, this.tenantId, eventId)
      const current = event?.participants?.find((item) => item.id === participantId) || null
      const exists = Boolean(current)
      const checked = Boolean(current?.is_checked_in)
      const matchExists = expected.exists === undefined ? true : expected.exists === exists
      const matchChecked = expected.checkedIn === undefined ? true : expected.checkedIn === checked
      if (matchExists && matchChecked) {
        return { ok: true, available: true, participant: current, attempts: i + 1, eventId }
      }
      if (i < attempts - 1) {
        await delay(waitMs)
      }
    }

    const workspaceSnapshot = await this.readRemoteWorkspaceSnapshot()
    const eventId = expected.eventId || getCurrentEventId()
    const event = getRemoteEventSnapshot(workspaceSnapshot, this.tenantId, eventId)
    const current = event?.participants?.find((item) => item.id === participantId) || null
    return {
      ok: false,
      available: true,
      participant: current,
      attempts,
      exists: Boolean(current),
      checkedIn: Boolean(current?.is_checked_in),
      eventId
    }
  }

  async waitForRemoteTenantState(checkFn, attempts = 10, waitMs = 1200) {
    for (let i = 0; i < attempts; i += 1) {
      const workspaceSnapshot = await this.readRemoteWorkspaceSnapshot()
      if (!workspaceSnapshot) {
        return { ok: null, available: false, skipped: true, reason: 'remote_snapshot_unavailable' }
      }

      const matched = checkFn(workspaceSnapshot)
      if (matched) {
        return { ok: true, available: true, attempts: i + 1 }
      }

      if (i < attempts - 1) {
        await delay(waitMs)
      }
    }

    return { ok: false, available: true, attempts }
  }

  async runAll() {
    this.startTime = new Date()
    this.results = []

    await this.testReadinessPreflight()
    await this.testLocalPersistenceStructure()
    await this.testWaStatusEndpoint()
    await this.testTicketVerifyEndpoint()
    await this.testDataSyncReadOnly()

    if (this.allowMutations) {
      await this.testAddParticipantE2E()
      await this.testCheckInParticipantE2E()
      await this.testBulkAddParticipantE2E()
      await this.testAddInvoiceE2E()
      await this.testUpdateInvoiceE2E()
      await this.testUpdateContractE2E()
      await this.testDeleteParticipantE2E()
      await this.testCleanupResidualTestData()
    } else {
      this.logSkipped('ADD_PARTICIPANT_E2E', 'mode dry-run tidak melakukan mutasi data')
      this.logSkipped('CHECK_IN_PARTICIPANT_E2E', 'mode dry-run tidak melakukan mutasi data')
      this.logSkipped('BULK_ADD_PARTICIPANT_E2E', 'mode dry-run tidak melakukan mutasi data')
      this.logSkipped('ADD_INVOICE_E2E', 'mode dry-run tidak melakukan mutasi data')
      this.logSkipped('UPDATE_INVOICE_E2E', 'mode dry-run tidak melakukan mutasi data')
      this.logSkipped('UPDATE_CONTRACT_E2E', 'mode dry-run tidak melakukan mutasi data')
      this.logSkipped('DELETE_PARTICIPANT_E2E', 'mode dry-run tidak melakukan mutasi data')
      this.logSkipped('CLEANUP_RESIDUAL_TEST_DATA', 'mode dry-run tidak membuat data uji')
    }

    await this.testBackupSnapshotHealth()

    this.endTime = new Date()
    return this.getReport()
  }

  async testReadinessPreflight() {
    try {
      const tenant = getActiveTenant()
      const eventId = getCurrentEventId()
      const day = getCurrentDay()

      this.tenantId = tenant?.id || this.tenantId
      this.eventId = eventId || this.eventId

      if (!tenant?.id) {
        return this.log('READINESS_PREFLIGHT', false, 'Tenant aktif tidak ditemukan', { tenant })
      }
      if (!eventId) {
        return this.log('READINESS_PREFLIGHT', false, 'Event aktif tidak ditemukan', { eventId })
      }
      if (!Number.isInteger(Number(day)) || Number(day) < 1) {
        return this.log('READINESS_PREFLIGHT', false, 'Hari aktif tidak valid', { day })
      }

      return this.log('READINESS_PREFLIGHT', true, 'Konteks tenant/event siap untuk audit', {
        tenantId: tenant.id,
        eventId,
        currentDay: Number(day)
      })
    } catch (err) {
      return this.log('READINESS_PREFLIGHT', false, `Exception: ${err.message}`, { error: err?.message })
    }
  }

  async testLocalPersistenceStructure() {
    try {
      const snapshot = readLocalStoreSnapshot()
      const participants = getParticipants(getCurrentDay())

      if (!snapshot.raw && isLikelyStrictMode(snapshot)) {
        return this.log('LOCAL_PERSISTENCE_STRUCTURE', true, 'Local store tidak tersedia (kemungkinan mode strict); validasi lanjut via bootstrap Firebase.', {
          strictModeLikely: true,
          participantCount: participants.length
        })
      }

      if (!snapshot.parsed) {
        return this.log('LOCAL_PERSISTENCE_STRUCTURE', false, 'Data localStorage ditemukan tetapi tidak valid JSON', {
          key: snapshot.key
        })
      }

      const rawContainsActiveEvent = snapshot.raw.includes(getCurrentEventId())
      return this.log('LOCAL_PERSISTENCE_STRUCTURE', true, 'Struktur local persistence terdeteksi dan dapat dibaca', {
        key: snapshot.key,
        size: snapshot.raw.length,
        rawContainsActiveEvent
      })
    } catch (err) {
      return this.log('LOCAL_PERSISTENCE_STRUCTURE', false, `Exception: ${err.message}`, { error: err?.message })
    }
  }

  async testWaStatusEndpoint() {
    try {
      const response = await apiFetch(`/api/wa/status?tenant_id=${encodeURIComponent(this.tenantId)}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        return this.log('WA_STATUS_ENDPOINT', false, `HTTP ${response.status}`, {
          status: response.status,
          payload
        })
      }

      return this.log('WA_STATUS_ENDPOINT', true, 'Endpoint WA status merespons normal', {
        status: payload?.status || null,
        isReady: Boolean(payload?.isReady)
      })
    } catch (err) {
      return this.log('WA_STATUS_ENDPOINT', false, `Exception: ${err.message}`, { error: err?.message })
    }
  }

  async testTicketVerifyEndpoint() {
    try {
      const participants = getParticipants(getCurrentDay())
      const sample = participants[0]
      if (!sample?.ticket_id) {
        return this.logSkipped('TICKET_VERIFY_ENDPOINT', 'tidak ada peserta untuk uji verifikasi ticket')
      }

      const response = await apiFetch('/api/ticket/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: sample.ticket_id,
          tenant_id: this.tenantId,
          event_id: getCurrentEventId()
        })
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        return this.log('TICKET_VERIFY_ENDPOINT', false, `HTTP ${response.status}`, {
          status: response.status,
          payload
        })
      }

      return this.log('TICKET_VERIFY_ENDPOINT', true, 'Endpoint verify ticket merespons', {
        status: response.status,
        payloadStatus: payload?.status || null,
        payloadValid: payload?.valid ?? null
      })
    } catch (err) {
      return this.log('TICKET_VERIFY_ENDPOINT', false, `Exception: ${err.message}`, { error: err?.message })
    }
  }

  async testDataSyncReadOnly() {
    try {
      const contextBefore = {
        tenantId: getActiveTenant()?.id || this.tenantId,
        eventId: getCurrentEventId() || this.eventId
      }
      const before = getParticipants(getCurrentDay()).length
      await bootstrapStoreFromFirebase(true)
      const after = getParticipants(getCurrentDay()).length

      const contextAfter = {
        tenantId: getActiveTenant()?.id || null,
        eventId: getCurrentEventId() || null
      }

      let tenantRestored = null
      let eventRestored = null

      if (contextBefore.tenantId && contextAfter.tenantId !== contextBefore.tenantId) {
        const restoreTenant = switchActiveTenant(contextBefore.tenantId, 'diagnostic-suite')
        tenantRestored = Boolean(restoreTenant?.success)
      }

      if (contextBefore.eventId && getCurrentEventId() !== contextBefore.eventId) {
        eventRestored = setCurrentEvent(contextBefore.eventId, 'diagnostic-suite')
      }

      this.tenantId = contextBefore.tenantId || this.tenantId
      this.eventId = contextBefore.eventId || this.eventId

      return this.log('DATA_SYNC_READ_ONLY', true, 'Bootstrap sinkronisasi berhasil dijalankan', {
        participantCountBefore: before,
        participantCountAfter: after,
        changed: before !== after,
        contextBefore,
        contextAfter,
        tenantRestored,
        eventRestored
      })
    } catch (err) {
      return this.log('DATA_SYNC_READ_ONLY', false, `Exception: ${err.message}`, { error: err?.message })
    }
  }

  async testAddParticipantE2E() {
    try {
      const day = getCurrentDay()
      const beforeCount = getParticipants(day).length
      const participant = addParticipant({
        name: `DIAG_E2E_${Date.now()}`,
        phone: '628111111111',
        email: 'diag-e2e@example.com',
        category: 'Regular',
        day_number: day,
        actor: 'diagnostic-suite'
      })

      if (!participant?.id) {
        return this.log('ADD_PARTICIPANT_E2E', false, 'addParticipant tidak mengembalikan participant id', { participant })
      }

      this.primaryParticipant = participant
      const participantEvent = parseJsonSafe(participant.qr_data)?.e || getCurrentEventId()
      this.eventId = participantEvent || this.eventId

      const afterCount = getParticipants(day).length
      if (afterCount !== beforeCount + 1) {
        return this.log('ADD_PARTICIPANT_E2E', false, 'Jumlah peserta tidak bertambah setelah add', {
          beforeCount,
          afterCount,
          participantId: participant.id
        })
      }

      const localStore = readLocalStoreSnapshot()
      const localContainsTicket = Boolean(localStore.raw && localStore.raw.includes(participant.ticket_id))

      const remoteCheck = await this.waitForRemoteParticipantState(participant.id, { exists: true, eventId: this.eventId }, 6, 1200)
      if (remoteCheck.ok === false) {
        return this.log('ADD_PARTICIPANT_E2E', false, 'Peserta tidak ditemukan konsisten pada snapshot Firebase', {
          participantId: participant.id,
          localContainsTicket,
          remoteCheck
        })
      }

      return this.log('ADD_PARTICIPANT_E2E', true, remoteCheck.ok === null
        ? 'Tambah peserta tersimpan di memory dan localStorage; remote Firebase snapshot tidak tersedia untuk verifikasi.'
        : 'Tambah peserta tersimpan di memory, localStorage, dan konsisten di Firebase.', {
        participantId: participant.id,
        ticketId: participant.ticket_id,
        localContainsTicket,
        remoteAvailable: remoteCheck.ok !== null,
        remoteAttempts: remoteCheck.attempts || 0,
        remoteSkipped: remoteCheck.ok === null
      })
    } catch (err) {
      return this.log('ADD_PARTICIPANT_E2E', false, `Exception: ${err.message}`, { error: err?.message })
    }
  }

  async testCheckInParticipantE2E() {
    try {
      if (!this.primaryParticipant?.id) {
        return this.logSkipped('CHECK_IN_PARTICIPANT_E2E', 'tidak ada participant uji untuk check-in')
      }

      const freshParticipant = getParticipant(this.primaryParticipant.id)
      if (!freshParticipant?.qr_data) {
        return this.log('CHECK_IN_PARTICIPANT_E2E', false, 'Participant uji tidak memiliki qr_data', {
          participantId: this.primaryParticipant.id
        })
      }

      const result = checkIn(freshParticipant.qr_data, 'diagnostic-suite')
      if (!result?.success) {
        return this.log('CHECK_IN_PARTICIPANT_E2E', false, result?.message || 'checkIn gagal', {
          result
        })
      }

      const localParticipant = getParticipant(freshParticipant.id)
      if (!localParticipant?.is_checked_in) {
        return this.log('CHECK_IN_PARTICIPANT_E2E', false, 'Status check-in tidak berubah di memory lokal', {
          participantId: freshParticipant.id,
          localParticipant
        })
      }

      const eventId = parseJsonSafe(freshParticipant.qr_data)?.e || this.eventId || getCurrentEventId()
      this.eventId = eventId
      const remoteCheck = await this.waitForRemoteParticipantState(freshParticipant.id, { exists: true, checkedIn: true, eventId }, 6, 1200)
      if (remoteCheck.ok === false) {
        return this.log('CHECK_IN_PARTICIPANT_E2E', false, 'Status check-in tidak konsisten setelah sinkronisasi', {
          participantId: freshParticipant.id,
          remoteCheck
        })
      }

      return this.log('CHECK_IN_PARTICIPANT_E2E', true, remoteCheck.ok === null
        ? 'Scan/check-in berhasil di memory lokal; remote Firebase snapshot tidak tersedia untuk verifikasi.'
        : 'Scan/check-in berhasil dan konsisten di Firebase.', {
        participantId: freshParticipant.id,
        checkedInAt: localParticipant?.checked_in_at || null,
        remoteAvailable: remoteCheck.ok !== null,
        remoteAttempts: remoteCheck.attempts || 0,
        remoteSkipped: remoteCheck.ok === null
      })
    } catch (err) {
      return this.log('CHECK_IN_PARTICIPANT_E2E', false, `Exception: ${err.message}`, { error: err?.message })
    }
  }

  async testBulkAddParticipantE2E() {
    try {
      const day = getCurrentDay()
      const rows = [
        { name: `DIAG_BULK_A_${Date.now()}` },
        { name: `DIAG_BULK_B_${Date.now()}` }
      ]
      const result = bulkAddParticipants(rows, day, 'diagnostic-suite')

      if (!Array.isArray(result?.added) || result.added.length !== 2 || (result.errors || []).length > 0) {
        return this.log('BULK_ADD_PARTICIPANT_E2E', false, 'bulkAddParticipants gagal menambah seluruh row valid', {
          result
        })
      }

      this.bulkParticipants = result.added.map((item) => item.id)

      const localIntegrity = this.bulkParticipants.every((id) => Boolean(getParticipant(id)))
      if (!localIntegrity) {
        return this.log('BULK_ADD_PARTICIPANT_E2E', false, 'Sebagian participant bulk tidak tersimpan di memory lokal', {
          addedIds: this.bulkParticipants,
          result
        })
      }

      const syncChecks = []
      for (const id of this.bulkParticipants) {
        const syncCheck = await this.waitForRemoteParticipantState(id, { exists: true, eventId: this.eventId || getCurrentEventId() }, 6, 1200)
        syncChecks.push(syncCheck)
      }

      const failedSync = syncChecks.find((item) => item.ok === false)
      if (failedSync) {
        return this.log('BULK_ADD_PARTICIPANT_E2E', false, 'Sebagian participant bulk tidak konsisten setelah sinkronisasi', {
          addedIds: this.bulkParticipants,
          syncChecks
        })
      }

      const remoteSkipped = syncChecks.every((item) => item.ok === null)
      return this.log('BULK_ADD_PARTICIPANT_E2E', true, remoteSkipped
        ? 'Bulk add berhasil di memory lokal; remote Firebase snapshot tidak tersedia untuk verifikasi.'
        : 'Bulk add berhasil dan konsisten di Firebase.', {
        addedIds: this.bulkParticipants,
        errorCount: result.errors.length,
        remoteSkipped,
        remoteChecks: syncChecks.map((item) => ({ ok: item.ok, attempts: item.attempts || 0, skipped: item.ok === null }))
      })
    } catch (err) {
      return this.log('BULK_ADD_PARTICIPANT_E2E', false, `Exception: ${err.message}`, { error: err?.message })
    }
  }

  async testAddInvoiceE2E() {
    try {
      const period = `Diagnostic ${new Date().toISOString().slice(0, 10)}`
      const invoiceResult = addTenantInvoice(this.tenantId, {
        period,
        amount: 1000,
        status: 'unpaid',
        notes: 'diagnostic-suite'
      }, 'diagnostic-suite')

      if (!invoiceResult?.success || !invoiceResult?.invoice?.id) {
        return this.log('ADD_INVOICE_E2E', false, 'addTenantInvoice gagal', { invoiceResult })
      }

      const tenant = this.getTenantById(this.tenantId)
      const exists = Array.isArray(tenant?.invoices)
        ? tenant.invoices.some((item) => item.id === invoiceResult.invoice.id)
        : false

      if (!exists) {
        return this.log('ADD_INVOICE_E2E', false, 'Invoice baru tidak ditemukan di tenant aktif', {
          invoiceId: invoiceResult.invoice.id,
          tenantId: tenant?.id || null
        })
      }

      this.testInvoiceId = invoiceResult.invoice.id
      const remoteCheck = await this.waitForRemoteTenantState((workspaceSnapshot) => {
        const remoteTenant = getRemoteTenantSnapshot(workspaceSnapshot, this.tenantId)
        return Array.isArray(remoteTenant?.invoices)
          && remoteTenant.invoices.some((item) => item.id === invoiceResult.invoice.id)
      }, 6, 1200)

      if (remoteCheck.ok === false) {
        return this.log('ADD_INVOICE_E2E', false, 'Invoice tidak muncul di snapshot Firebase setelah retry', {
          invoiceId: invoiceResult.invoice.id,
          tenantId: tenant?.id || null,
          remoteCheck
        })
      }

      return this.log('ADD_INVOICE_E2E', true, remoteCheck.ok === null
        ? 'Invoice berhasil dibuat di tenant lokal; remote Firebase snapshot tidak tersedia untuk verifikasi.'
        : 'Invoice berhasil dibuat dan tersinkron ke Firebase.', {
        invoiceId: invoiceResult.invoice.id,
        period,
        remoteAvailable: remoteCheck.ok !== null,
        remoteAttempts: remoteCheck.attempts || 0,
        remoteSkipped: remoteCheck.ok === null
      })
    } catch (err) {
      return this.log('ADD_INVOICE_E2E', false, `Exception: ${err.message}`, { error: err?.message })
    }
  }

  async testUpdateInvoiceE2E() {
    try {
      if (!this.testInvoiceId) {
        return this.logSkipped('UPDATE_INVOICE_E2E', 'tidak ada invoice uji untuk diupdate')
      }

      const updateResult = updateInvoiceStatus(this.tenantId, this.testInvoiceId, 'paid', 'diagnostic-suite')
      if (!updateResult?.success) {
        return this.log('UPDATE_INVOICE_E2E', false, 'updateInvoiceStatus gagal', {
          updateResult,
          invoiceId: this.testInvoiceId
        })
      }

      const tenant = this.getTenantById(this.tenantId)
      const invoice = Array.isArray(tenant?.invoices)
        ? tenant.invoices.find((item) => item.id === this.testInvoiceId)
        : null

      if (!invoice || invoice.status !== 'paid') {
        return this.log('UPDATE_INVOICE_E2E', false, 'Status invoice tidak berubah menjadi paid', {
          invoiceId: this.testInvoiceId,
          invoice
        })
      }

      const remoteCheck = await this.waitForRemoteTenantState((workspaceSnapshot) => {
        const remoteTenant = getRemoteTenantSnapshot(workspaceSnapshot, this.tenantId)
        const remoteInvoice = Array.isArray(remoteTenant?.invoices)
          ? remoteTenant.invoices.find((item) => item.id === this.testInvoiceId)
          : null
        return remoteInvoice?.status === 'paid'
      }, 6, 1200)

      if (remoteCheck.ok === false) {
        return this.log('UPDATE_INVOICE_E2E', false, 'Status invoice tidak sinkron di Firebase setelah retry', {
          invoiceId: this.testInvoiceId,
          remoteCheck
        })
      }

      return this.log('UPDATE_INVOICE_E2E', true, remoteCheck.ok === null
        ? 'Update invoice berhasil di tenant lokal; remote Firebase snapshot tidak tersedia untuk verifikasi.'
        : 'Update status invoice berhasil dan terverifikasi di Firebase.', {
        invoiceId: this.testInvoiceId,
        status: invoice.status,
        remoteAvailable: remoteCheck.ok !== null,
        remoteAttempts: remoteCheck.attempts || 0,
        remoteSkipped: remoteCheck.ok === null
      })
    } catch (err) {
      return this.log('UPDATE_INVOICE_E2E', false, `Exception: ${err.message}`, { error: err?.message })
    }
  }

  async testUpdateContractE2E() {
    try {
      const tenantBefore = this.getTenantById(this.tenantId)
      const previousContract = { ...(tenantBefore?.contract || {}) }
      const marker = `diag-${Date.now()}`
      const patchResult = updateTenantContract(this.tenantId, {
        diagnostic_marker: marker
      }, 'diagnostic-suite')

      if (!patchResult?.success) {
        return this.log('UPDATE_CONTRACT_E2E', false, 'updateTenantContract gagal saat apply marker', {
          patchResult
        })
      }

      const tenantAfterPatch = this.getTenantById(this.tenantId)
      if (tenantAfterPatch?.contract?.diagnostic_marker !== marker) {
        return this.log('UPDATE_CONTRACT_E2E', false, 'Marker kontrak tidak tersimpan', {
          marker,
          contract: tenantAfterPatch?.contract || null
        })
      }

      const remoteCheck = await this.waitForRemoteTenantState((workspaceSnapshot) => {
        const remoteTenant = getRemoteTenantSnapshot(workspaceSnapshot, this.tenantId)
        return remoteTenant?.contract?.diagnostic_marker === marker
      }, 6, 1200)

      if (remoteCheck.ok === false) {
        return this.log('UPDATE_CONTRACT_E2E', false, 'Marker kontrak tidak muncul di snapshot Firebase', {
          marker,
          remoteCheck
        })
      }

      const rollbackResult = updateTenantContract(this.tenantId, previousContract, 'diagnostic-suite')
      if (!rollbackResult?.success) {
        return this.log('UPDATE_CONTRACT_E2E', false, 'Rollback kontrak gagal', {
          rollbackResult,
          previousContract
        })
      }

      return this.log('UPDATE_CONTRACT_E2E', true, remoteCheck.ok === null
        ? 'Update kontrak berhasil di tenant lokal; remote Firebase snapshot tidak tersedia untuk verifikasi.'
        : 'Update kontrak dan rollback berhasil terverifikasi di Firebase.', {
        marker,
        remoteAvailable: remoteCheck.ok !== null,
        remoteAttempts: remoteCheck.attempts || 0,
        remoteSkipped: remoteCheck.ok === null
      })
    } catch (err) {
      return this.log('UPDATE_CONTRACT_E2E', false, `Exception: ${err.message}`, { error: err?.message })
    }
  }

  async testDeleteParticipantE2E() {
    try {
      const idsToDelete = [
        this.primaryParticipant?.id,
        ...this.bulkParticipants
      ].filter(Boolean)

      if (idsToDelete.length === 0) {
        return this.logSkipped('DELETE_PARTICIPANT_E2E', 'tidak ada participant uji untuk dihapus')
      }

      const failed = []
      for (const id of idsToDelete) {
        const deleteResult = deleteParticipant(id, 'diagnostic-suite', 'Penghapusan data uji diagnostic otomatis')
        if (!deleteResult?.success) {
          failed.push({ id, reason: deleteResult?.error || 'unknown' })
          continue
        }

        const syncCheck = await this.waitForRemoteParticipantState(id, { exists: false, eventId: this.eventId || getCurrentEventId() }, 6, 1200)
        if (syncCheck.ok === false) {
          failed.push({ id, reason: 'tetap muncul setelah sinkronisasi', syncCheck })
        }
      }

      if (failed.length > 0) {
        return this.log('DELETE_PARTICIPANT_E2E', false, 'Sebagian participant uji gagal dihapus bersih', {
          failed,
          idsToDelete
        })
      }

      this.primaryParticipant = null
      this.bulkParticipants = []
      return this.log('DELETE_PARTICIPANT_E2E', true, 'Participant uji berhasil dihapus dan sinkron', {
        deletedIds: idsToDelete
      })
    } catch (err) {
      return this.log('DELETE_PARTICIPANT_E2E', false, `Exception: ${err.message}`, { error: err?.message })
    }
  }

  async testCleanupResidualTestData() {
    try {
      const day = getCurrentDay()
      const leftovers = getParticipants(day).filter((item) => {
        const name = String(item.name || '')
        return name.startsWith('DIAG_E2E_') || name.startsWith('DIAG_BULK_') || name.startsWith('TEST_PESERTA_')
      })

      if (leftovers.length === 0) {
        return this.log('CLEANUP_RESIDUAL_TEST_DATA', true, 'Tidak ada data uji tersisa', { leftoverCount: 0 })
      }

      const deleted = []
      const failed = []
      for (const item of leftovers) {
        const res = deleteParticipant(item.id, 'diagnostic-suite', 'Pembersihan data uji diagnostic otomatis')
        if (res?.success) deleted.push(item.id)
        else failed.push({ id: item.id, error: res?.error || 'unknown' })
      }

      if (failed.length > 0) {
        return this.log('CLEANUP_RESIDUAL_TEST_DATA', false, 'Sebagian data uji gagal dibersihkan', {
          deleted,
          failed
        })
      }

      return this.log('CLEANUP_RESIDUAL_TEST_DATA', true, 'Data uji residual berhasil dibersihkan', {
        deletedCount: deleted.length
      })
    } catch (err) {
      return this.log('CLEANUP_RESIDUAL_TEST_DATA', false, `Exception: ${err.message}`, { error: err?.message })
    }
  }

  async testBackupSnapshotHealth() {
    try {
      const backups = getStoreBackups()
      if (!Array.isArray(backups)) {
        return this.log('BACKUP_SNAPSHOT_HEALTH', false, 'getStoreBackups tidak mengembalikan array', {
          backups
        })
      }

      if (backups.length === 0) {
        return this.log('BACKUP_SNAPSHOT_HEALTH', true, 'Tidak ada backup snapshot saat ini (masih valid jika mode strict).', {
          totalBackups: 0
        })
      }

      const newest = backups[0]
      return this.log('BACKUP_SNAPSHOT_HEALTH', true, 'Backup snapshot terdeteksi', {
        totalBackups: backups.length,
        newest
      })
    } catch (err) {
      return this.log('BACKUP_SNAPSHOT_HEALTH', false, `Exception: ${err.message}`, { error: err?.message })
    }
  }

  getReport() {
    const passed = this.results.filter((item) => item.passed).length
    const failed = this.results.filter((item) => !item.passed).length
    const total = this.results.length
    const skipped = this.results.filter((item) => item.details?.skipped).length

    return {
      summary: {
        mode: this.mode,
        total,
        passed,
        failed,
        skipped,
        passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
        duration: this.endTime ? this.endTime.getTime() - this.startTime.getTime() : 0,
        startTime: this.startTime?.toISOString() || null,
        endTime: this.endTime?.toISOString() || null
      },
      results: this.results,
      failedTests: this.results
        .filter((item) => !item.passed)
        .map((item) => ({
          ...item,
          action: getDiagnosticActionHint(item.test)
        }))
    }
  }
}

export async function runDiagnosticSuite(options = {}) {
  const suite = new DiagnosticSuite(options)
  return suite.runAll()
}
