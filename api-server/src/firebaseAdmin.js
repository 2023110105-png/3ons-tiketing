import admin from 'firebase-admin'

let app = null

function normalizePrivateKey(value) {
  // Railway/Vercel often store multiline keys as "\n" escaped.
  return String(value || '').replace(/\\n/g, '\n')
}

export function initFirebaseAdmin({ projectId, clientEmail, privateKey }) {
  if (app) return app

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: normalizePrivateKey(privateKey)
    })
  })

  return app
}

export function getAuth() {
  return admin.auth()
}

export function getFirestore() {
  return admin.firestore()
}

