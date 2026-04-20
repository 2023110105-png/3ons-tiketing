import { useState } from 'react'

// WA Status polling disabled - server offline
export function useWaStatus() {
  // Return offline status without making API calls
  // This prevents CORS errors when WA server is down
  const [wa] = useState({ status: 'offline', isReady: false })
  return wa
}

