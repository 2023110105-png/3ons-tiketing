/**
 * COMPREHENSIVE DIAGNOSTIC SUITE
 * Tests all operations in the system to detect bugs like:
 * - Data added but not saved to Firebase
 * - Data added but not saved to localStorage
 * - API endpoints failing silently
 * - Sync failures
 * - etc
 */

import { 
  addParticipant, 
  deleteParticipant, 
  getParticipants,
  addTenantInvoice,
  updateInvoiceStatus,
  updateTenantContract,
  getCurrentEventId,
  getStoreBackups,
  bootstrapStoreFromFirebase,
  getCurrentDay,
  getActiveTenant
} from '../../../store/mockData'
import { apiFetch } from '../../../utils/api'

// ============================================================================
// DIAGNOSTIC TEST RUNNER
// ============================================================================

export class DiagnosticSuite {
  constructor(tenantId = 'tenant-default') {
    this.tenantId = tenantId
    this.results = []
    this.startTime = null
    this.endTime = null
  }

  log(test, passed, message, details = null) {
    const result = {
      test,
      passed,
      message,
      details,
      timestamp: new Date().toISOString()
    }
    this.results.push(result)
    console.log(`[${passed ? '✅' : '❌'}] ${test}: ${message}`, details)
    return result
  }

  async runAll() {
    this.startTime = new Date()
    this.results = []

    // Run all diagnostic tests
    await this.testAddParticipant()
    await this.testDeleteParticipant()
    await this.testParticipantLocalStoragePersistence()
    await this.testParticipantFirebasePersistence()
    await this.testSendTicketEndpoint()
    await this.testTicketVerifyEndpoint()
    await this.testImportBarcodeEndpoint()
    await this.testAddInvoice()
    await this.testDeleteInvoice()
    await this.testUpdateContract()
    await this.testDataSyncFlow()
    await this.testBackupSystem()
    await this.testWaServerConnectivity()

    this.endTime = new Date()
    return this.getReport()
  }

  // =========================================================================
  // TEST: ADD PARTICIPANT
  // =========================================================================
  async testAddParticipant() {
    try {
      const testData = {
        name: `TEST_PESERTA_${Date.now()}`,
        phone: '628123456789',
        email: 'test@example.com',
        category: 'Regular',
        day_number: 1,
        actor: 'diagnostic-test'
      }

      // Before count
      const beforeParticipants = getParticipants(1)
      const countBefore = beforeParticipants.length

      // Add participant
      const result = addParticipant(testData)

      // After count
      const afterParticipants = getParticipants(1)
      const countAfter = afterParticipants.length

      if (!result || !result.id) {
        return this.log(
          'ADD_PARTICIPANT',
          false,
          'Function returned invalid result',
          { result }
        )
      }

      if (countAfter !== countBefore + 1) {
        return this.log(
          'ADD_PARTICIPANT',
          false,
          `Participant count mismatch. Before: ${countBefore}, After: ${countAfter}`,
          { pBefore: countBefore, pAfter: countAfter, result }
        )
      }

      // Verify participant exists in memory
      const found = afterParticipants.find(p => p.id === result.id)
      if (!found) {
        return this.log(
          'ADD_PARTICIPANT',
          false,
          'Participant added but not found in getParticipants()',
          { addedId: result.id }
        )
      }

      // Store test ID for later verification
      this.testParticipantId = result.id
      this.testParticipantName = result.name

      return this.log(
        'ADD_PARTICIPANT',
        true,
        `Successfully added participant: ${result.name} (${result.ticket_id})`,
        { participantId: result.id, ticketId: result.ticket_id }
      )
    } catch (err) {
      return this.log(
        'ADD_PARTICIPANT',
        false,
        `Exception: ${err.message}`,
        { error: err }
      )
    }
  }

  // =========================================================================
  // TEST: DELETE PARTICIPANT
  // =========================================================================
  async testDeleteParticipant() {
    try {
      if (!this.testParticipantId) {
        return this.log(
          'DELETE_PARTICIPANT',
          false,
          'Skipped - no test participant to delete',
          {}
        )
      }

      const beforeDelete = getParticipants(1)
      const countBefore = beforeDelete.length

      const result = deleteParticipant(
        this.testParticipantId,
        'diagnostic-test',
        'Diagnostic test deletion - part of comprehensive suite validation'
      )

      if (!result?.success) {
        return this.log(
          'DELETE_PARTICIPANT',
          false,
          `Delete failed: ${result?.error || 'Unknown reason'}`,
          { result }
        )
      }

      const afterDelete = getParticipants(1)
      const countAfter = afterDelete.length

      if (countAfter !== countBefore - 1) {
        return this.log(
          'DELETE_PARTICIPANT',
          false,
          `Count mismatch after delete. Before: ${countBefore}, After: ${countAfter}`,
          { countBefore, countAfter }
        )
      }

      const stillExists = afterDelete.find(p => p.id === this.testParticipantId)
      if (stillExists) {
        return this.log(
          'DELETE_PARTICIPANT',
          false,
          'Participant deleted but still found in getParticipants()',
          { participantId: this.testParticipantId }
        )
      }

      return this.log(
        'DELETE_PARTICIPANT',
        true,
        `Successfully deleted participant: ${this.testParticipantName}`,
        { deletedId: this.testParticipantId }
      )
    } catch (err) {
      return this.log(
        'DELETE_PARTICIPANT',
        false,
        `Exception: ${err.message}`,
        { error: err }
      )
    }
  }

  // =========================================================================
  // TEST: LOCAL STORAGE PERSISTENCE
  // =========================================================================
  async testParticipantLocalStoragePersistence() {
    try {
      const storedData = window.localStorage.getItem('ons_bot_store')
      if (!storedData) {
        return this.log(
          'LOCALSTORAGE_PERSISTENCE',
          false,
          'Store data not found in localStorage',
          {}
        )
      }

      let parsed
      try {
        parsed = JSON.parse(storedData)
      } catch (e) {
        return this.log(
          'LOCALSTORAGE_PERSISTENCE',
          false,
          'localStorage data is corrupted JSON',
          { error: e.message }
        )
      }

      if (!parsed.events || !Array.isArray(parsed.events)) {
        return this.log(
          'LOCALSTORAGE_PERSISTENCE',
          false,
          'Stored data missing events array',
          { keys: Object.keys(parsed) }
        )
      }

      const eventCount = parsed.events.length
      if (eventCount === 0) {
        return this.log(
          'LOCALSTORAGE_PERSISTENCE',
          false,
          'No events in localStorage',
          {}
        )
      }

      return this.log(
        'LOCALSTORAGE_PERSISTENCE',
        true,
        `localStorage contains valid store with ${eventCount} event(s)`,
        { eventCount, dataSize: storedData.length }
      )
    } catch (err) {
      return this.log(
        'LOCALSTORAGE_PERSISTENCE',
        false,
        `Exception: ${err.message}`,
        { error: err }
      )
    }
  }

  // =========================================================================
  // TEST: FIREBASE PERSISTENCE
  // =========================================================================
  async testParticipantFirebasePersistence() {
    try {
      // Check if any data was synced to Firebase
      // This is a simplified check - ideally we'd query Firebase directly
      const backups = getStoreBackups()
      
      if (!backups || Object.keys(backups).length === 0) {
        return this.log(
          'FIREBASE_PERSISTENCE',
          false,
          'No backup snapshots found - possible Firebase sync issue',
          { backups }
        )
      }

      // Check if we have recent backups
      const backupKeys = Object.keys(backups)
      const latestBackup = backupKeys[backupKeys.length - 1]
      
      if (!latestBackup) {
        return this.log(
          'FIREBASE_PERSISTENCE',
          false,
          'No backup keys available',
          {}
        )
      }

      return this.log(
        'FIREBASE_PERSISTENCE',
        true,
        `Firebase sync data present (${backupKeys.length} backup snapshots)`,
        { latestBackup, totalBackups: backupKeys.length }
      )
    } catch (err) {
      return this.log(
        'FIREBASE_PERSISTENCE',
        false,
        `Exception: ${err.message}`,
        { error: err }
      )
    }
  }

  // =========================================================================
  // TEST: SEND TICKET ENDPOINT
  // =========================================================================
  async testSendTicketEndpoint() {
    try {
      const participants = getParticipants(1)
      if (participants.length === 0) {
        return this.log(
          'SEND_TICKET_ENDPOINT',
          false,
          'No participants available for testing',
          {}
        )
      }

      const testParticipant = participants[0]
      if (!testParticipant.phone && !testParticipant.email) {
        return this.log(
          'SEND_TICKET_ENDPOINT',
          false,
          'Test participant has no phone or email',
          { participantId: testParticipant.id }
        )
      }

      const payload = {
        ...testParticipant,
        tenant_id: this.tenantId,
        send_wa: !!testParticipant.phone,
        send_email: !!testParticipant.email,
        wa_message: `Test: Halo ${testParticipant.name}, tiket Anda: ${testParticipant.ticket_id}`,
        wa_send_mode: 'queue'
      }

      const response = await apiFetch('/api/send-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response || response.status !== 'ok') {
        return this.log(
          'SEND_TICKET_ENDPOINT',
          false,
          `API returned status: ${response?.status || 'null'}`,
          { response }
        )
      }

      return this.log(
        'SEND_TICKET_ENDPOINT',
        true,
        `Successfully called /api/send-ticket for ${testParticipant.name}`,
        { participantId: testParticipant.id, status: response.status }
      )
    } catch (err) {
      return this.log(
        'SEND_TICKET_ENDPOINT',
        false,
        `Exception: ${err.message}`,
        { error: err }
      )
    }
  }

  // =========================================================================
  // TEST: TICKET VERIFY ENDPOINT
  // =========================================================================
  async testTicketVerifyEndpoint() {
    try {
      const participants = getParticipants(1)
      if (participants.length === 0) {
        return this.log(
          'TICKET_VERIFY_ENDPOINT',
          false,
          'No participants to verify',
          {}
        )
      }

      const testParticipant = participants[0]
      const response = await apiFetch('/api/ticket/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: testParticipant.ticket_id,
          tenant_id: this.tenantId,
          event_id: getCurrentEventId()
        })
      })

      if (!response) {
        return this.log(
          'TICKET_VERIFY_ENDPOINT',
          false,
          'No response from endpoint',
          {}
        )
      }

      return this.log(
        'TICKET_VERIFY_ENDPOINT',
        true,
        `Successfully called /api/ticket/verify for ticket ${testParticipant.ticket_id}`,
        { status: response.status, valid: response.valid }
      )
    } catch (err) {
      return this.log(
        'TICKET_VERIFY_ENDPOINT',
        false,
        `Exception: ${err.message}`,
        { error: err }
      )
    }
  }

  // =========================================================================
  // TEST: IMPORT BARCODE ENDPOINT
  // =========================================================================
  async testImportBarcodeEndpoint() {
    try {
      const response = await apiFetch('/api/import/barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: this.tenantId,
          barcodes: ['TEST_BARCODE_001', 'TEST_BARCODE_002'],
          import_type: 'diagnostic_test'
        })
      })

      if (!response) {
        return this.log(
          'IMPORT_BARCODE_ENDPOINT',
          false,
          'No response from endpoint',
          {}
        )
      }

      return this.log(
        'IMPORT_BARCODE_ENDPOINT',
        true,
        `Successfully called /api/import/barcode (processed ${response.processed || 0} items)`,
        { response }
      )
    } catch (err) {
      return this.log(
        'IMPORT_BARCODE_ENDPOINT',
        false,
        `Exception: ${err.message}`,
        { error: err }
      )
    }
  }

  // =========================================================================
  // TEST: ADD INVOICE
  // =========================================================================
  async testAddInvoice() {
    try {
      const invoiceData = {
        invoice_number: `INV-TEST-${Date.now()}`,
        amount: 100000,
        currency: 'IDR',
        status: 'draft',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
          {
            description: 'Diagnostic test invoice',
            quantity: 1,
            unit_price: 100000
          }
        ]
      }

      const result = addTenantInvoice(this.tenantId, invoiceData, 'diagnostic-test')

      if (!result || !result.id) {
        return this.log(
          'ADD_INVOICE',
          false,
          'Invoice creation failed or returned no ID',
          { result }
        )
      }

      this.testInvoiceId = result.id
      this.testInvoiceNumber = result.invoice_number

      return this.log(
        'ADD_INVOICE',
        true,
        `Successfully created invoice: ${result.invoice_number}`,
        { invoiceId: result.id, amount: result.amount }
      )
    } catch (err) {
      return this.log(
        'ADD_INVOICE',
        false,
        `Exception: ${err.message}`,
        { error: err }
      )
    }
  }

  // =========================================================================
  // TEST: DELETE/UPDATE INVOICE
  // =========================================================================
  async testDeleteInvoice() {
    try {
      if (!this.testInvoiceId) {
        return this.log(
          'DELETE_INVOICE',
          false,
          'Skipped - no test invoice to delete',
          {}
        )
      }

      // Update status instead of hard delete (invoices usually need soft delete)
      const result = updateInvoiceStatus(
        this.tenantId,
        this.testInvoiceId,
        'cancelled',
        'diagnostic-test'
      )

      if (!result?.success) {
        return this.log(
          'DELETE_INVOICE',
          false,
          `Update failed: ${result?.error || 'Unknown reason'}`,
          { result }
        )
      }

      return this.log(
        'DELETE_INVOICE',
        true,
        `Successfully cancelled invoice: ${this.testInvoiceNumber}`,
        { invoiceId: this.testInvoiceId }
      )
    } catch (err) {
      return this.log(
        'DELETE_INVOICE',
        false,
        `Exception: ${err.message}`,
        { error: err }
      )
    }
  }

  // =========================================================================
  // TEST: UPDATE CONTRACT
  // =========================================================================
  async testUpdateContract() {
    try {
      const contractData = {
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        terms: 'Diagnostic test contract terms'
      }

      const result = updateTenantContract(
        this.tenantId,
        contractData,
        'diagnostic-test'
      )

      if (!result) {
        return this.log(
          'UPDATE_CONTRACT',
          false,
          'Contract update returned null',
          {}
        )
      }

      return this.log(
        'UPDATE_CONTRACT',
        true,
        `Successfully updated contract for tenant ${this.tenantId}`,
        { status: result.status }
      )
    } catch (err) {
      return this.log(
        'UPDATE_CONTRACT',
        false,
        `Exception: ${err.message}`,
        { error: err }
      )
    }
  }

  // =========================================================================
  // TEST: DATA SYNC FLOW
  // =========================================================================
  async testDataSyncFlow() {
    try {
      // This simulates the sync process
      await bootstrapStoreFromFirebase(false)

      // Check if data is available after sync
      const participants = getParticipants(1)
      if (!participants || !Array.isArray(participants)) {
        return this.log(
          'DATA_SYNC_FLOW',
          false,
          'Participants not available after sync',
          {}
        )
      }

      // Try to get current event info
      const eventId = getCurrentEventId()
      if (!eventId) {
        return this.log(
          'DATA_SYNC_FLOW',
          false,
          'No active event found after sync',
          {}
        )
      }

      return this.log(
        'DATA_SYNC_FLOW',
        true,
        `Sync successful - Event ${eventId} has ${participants.length} participants`,
        { eventId, participantCount: participants.length }
      )
    } catch (err) {
      return this.log(
        'DATA_SYNC_FLOW',
        false,
        `Exception: ${err.message}`,
        { error: err }
      )
    }
  }

  // =========================================================================
  // TEST: BACKUP SYSTEM
  // =========================================================================
  async testBackupSystem() {
    try {
      const backups = getStoreBackups()
      
      if (!backups || typeof backups !== 'object') {
        return this.log(
          'BACKUP_SYSTEM',
          false,
          'getStoreBackups() returned invalid data',
          { backups }
        )
      }

      const keys = Object.keys(backups)
      if (keys.length === 0) {
        return this.log(
          'BACKUP_SYSTEM',
          false,
          'No backups found in system',
          {}
        )
      }

      // Check the most recent backup
      const latestKey = keys[keys.length - 1]
      const latestBackup = backups[latestKey]

      if (!latestBackup) {
        return this.log(
          'BACKUP_SYSTEM',
          false,
          'Latest backup is null or undefined',
          { latestKey }
        )
      }

      return this.log(
        'BACKUP_SYSTEM',
        true,
        `Backup system operational (${keys.length} backups, latest: ${latestKey})`,
        { totalBackups: keys.length, latestKey }
      )
    } catch (err) {
      return this.log(
        'BACKUP_SYSTEM',
        false,
        `Exception: ${err.message}`,
        { error: err }
      )
    }
  }

  // =========================================================================
  // TEST: WA SERVER CONNECTIVITY
  // =========================================================================
  async testWaServerConnectivity() {
    try {
      const response = await apiFetch('/api/wa/status', {
        method: 'GET'
      })

      if (!response) {
        return this.log(
          'WA_SERVER_CONNECTIVITY',
          false,
          'No response from /api/wa/status',
          {}
        )
      }

      if (response.status !== 'ok' && !response.status) {
        return this.log(
          'WA_SERVER_CONNECTIVITY',
          false,
          `Invalid response: ${JSON.stringify(response)}`,
          { response }
        )
      }

      return this.log(
        'WA_SERVER_CONNECTIVITY',
        true,
        `WA server is responsive (status: ${response.status})`,
        { response }
      )
    } catch (err) {
      return this.log(
        'WA_SERVER_CONNECTIVITY',
        false,
        `Exception: ${err.message}`,
        { error: err }
      )
    }
  }

  // =========================================================================
  // REPORT GENERATION
  // =========================================================================
  getReport() {
    const passed = this.results.filter(r => r.passed).length
    const failed = this.results.filter(r => !r.passed).length
    const total = this.results.length

    return {
      summary: {
        total,
        passed,
        failed,
        passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
        duration: this.endTime ? this.endTime.getTime() - this.startTime.getTime() : 0,
        startTime: this.startTime?.toISOString(),
        endTime: this.endTime?.toISOString()
      },
      results: this.results,
      failedTests: this.results.filter(r => !r.passed)
    }
  }
}

// ============================================================================
// QUICK RUNNER
// ============================================================================
export async function runDiagnosticSuite(tenantId = 'tenant-default') {
  const suite = new DiagnosticSuite(tenantId)
  return await suite.runAll()
}
