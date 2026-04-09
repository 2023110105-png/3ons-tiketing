import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT = 768

function readIsMobile() {
  if (typeof window === 'undefined') return false
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth
  return viewportWidth <= MOBILE_BREAKPOINT
}

export function useIsMobileLayout() {
  const [isMobile, setIsMobile] = useState(readIsMobile)

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const sync = () => setIsMobile(readIsMobile())

    // Immediate sync to handle devtools device toggle timing.
    sync()

    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    window.visualViewport?.addEventListener('resize', sync)
    media.addEventListener?.('change', sync)

    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      window.visualViewport?.removeEventListener('resize', sync)
      media.removeEventListener?.('change', sync)
    }
  }, [])

  return isMobile
}
