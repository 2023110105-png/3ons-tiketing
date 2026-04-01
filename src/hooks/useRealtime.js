import { useState, useEffect, useRef } from 'react'
import { subscribeToCheckIns } from '../store/mockData'

export function useRealtime() {
  const [events, setEvents] = useState([])
  const [lastEvent, setLastEvent] = useState(null)

  useEffect(() => {
    const unsubscribe = subscribeToCheckIns((event) => {
      setLastEvent(event)
      setEvents(prev => [event, ...prev].slice(0, 50))
    })
    return unsubscribe
  }, [])

  return { events, lastEvent }
}

export function useSound() {
  const audioCtxRef = useRef(null)

  const getCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    // Resume if suspended (browser autoplay policy)
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
    return audioCtxRef.current
  }

  const playSuccess = () => {
    try {
      const ctx = getCtx()
      // Triple ascending chime — premium "ding ding ding"
      const notes = [523, 659, 784] // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12)
        gain.gain.setValueAtTime(0.35, ctx.currentTime + i * 0.12)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + 0.5)
        osc.start(ctx.currentTime + i * 0.12)
        osc.stop(ctx.currentTime + i * 0.12 + 0.5)
      })
    } catch { /* silent */ }
  }

  const playError = () => {
    try {
      const ctx = getCtx()
      // Harsh buzz — two low descending tones
      const notes = [330, 220]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'square'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15)
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3)
        osc.start(ctx.currentTime + i * 0.15)
        osc.stop(ctx.currentTime + i * 0.15 + 0.3)
      })
    } catch { /* silent */ }
  }

  const playNotification = () => {
    try {
      const ctx = getCtx()
      // Two-tone ding
      const frequencies = [523, 659]
      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15)
        gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.15)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.5)
        osc.start(ctx.currentTime + i * 0.15)
        osc.stop(ctx.currentTime + i * 0.15 + 0.5)
      })
    } catch { /* silent */ }
  }

  // VIP Alert — special fanfare sound
  const playVIPAlert = () => {
    try {
      const ctx = getCtx()
      // Grand fanfare: C-E-G-C (octave up)
      const notes = [523, 659, 784, 1047]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15)
        gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.15)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.7)
        osc.start(ctx.currentTime + i * 0.15)
        osc.stop(ctx.currentTime + i * 0.15 + 0.7)
      })

      // Add a second harmonic layer
      setTimeout(() => {
        const notes2 = [784, 1047]
        notes2.forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.type = 'triangle'
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1)
          gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.1)
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.5)
          osc.start(ctx.currentTime + i * 0.1)
          osc.stop(ctx.currentTime + i * 0.1 + 0.5)
        })
      }, 500)
    } catch { /* silent */ }
  }

  // Warning beep for wrong day
  const playWarning = () => {
    try {
      const ctx = getCtx()
      const notes = [440, 440, 440]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.2)
        gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.2)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.15)
        osc.start(ctx.currentTime + i * 0.2)
        osc.stop(ctx.currentTime + i * 0.2 + 0.15)
      })
    } catch { /* silent */ }
  }

  return { playSuccess, playError, playNotification, playVIPAlert, playWarning }
}
