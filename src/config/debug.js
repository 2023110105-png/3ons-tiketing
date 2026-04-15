// Debug Configuration - Control console output

const DEBUG_CONFIG = {
  // Suppress verbose logs in production
  QUIET_MODE: import.meta.env?.PROD || false,
  
  // Log levels
  LOG_LEVELS: {
    ERROR: true,
    WARN: true,
    INFO: false,  // Suppress info logs
    DEBUG: false  // Suppress debug logs
  },
  
  // Specific module suppression
  SUPPRESS_MODULES: [
    'react-dom-client.development',  // React StrictMode noise
    'scheduler.development',
    'RealTimeChannel',
    'channel.js',
    'push.js'
  ],
  
  // Max repeated log count
  DEDUPLICATE_LOGS: true
};

// Store for tracking logged messages
const loggedMessages = new Set();

// Enhanced console wrapper
export const debug = {
  error: (msg, ...args) => {
    if (DEBUG_CONFIG.LOG_LEVELS.ERROR) {
      console.error(`[ERROR] ${msg}`, ...args);
    }
  },
  
  warn: (msg, ...args) => {
    if (DEBUG_CONFIG.LOG_LEVELS.WARN && shouldLog(msg)) {
      console.warn(`[WARN] ${msg}`, ...args);
    }
  },
  
  info: (msg, ...args) => {
    if (DEBUG_CONFIG.LOG_LEVELS.INFO && shouldLog(msg)) {
      console.info(`[INFO] ${msg}`, ...args);
    }
  },
  
  log: (msg, ...args) => {
    if (DEBUG_CONFIG.LOG_LEVELS.DEBUG && shouldLog(msg)) {
      console.log(`[DEBUG] ${msg}`, ...args);
    }
  }
};

// Check if message should be logged (deduplication)
function shouldLog(msg) {
  if (!DEBUG_CONFIG.DEDUPLICATE_LOGS) return true;
  
  const key = String(msg).slice(0, 100); // First 100 chars
  if (loggedMessages.has(key)) {
    return false;
  }
  
  // Keep only last 100 messages
  if (loggedMessages.size > 100) {
    loggedMessages.clear();
  }
  
  loggedMessages.add(key);
  return true;
}

// Install global error handlers
export function installErrorHandlers() {
  // Suppress specific React warnings
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const message = args[0] || '';
    
    // Filter out React development noise
    if (typeof message === 'string') {
      // Skip React StrictMode double-render warnings
      if (message.includes('react-dom-client.development') || 
          message.includes('StrictMode') ||
          message.includes('doubleInvokeEffects')) {
        return;
      }
      
      // Skip Supabase channel internal logs
      if (message.includes('RealtimeChannel') ||
          message.includes('channel.js') ||
          message.includes('push.js')) {
        return;
      }
    }
    
    originalConsoleError.apply(console, args);
  };
  
  // Suppress specific warnings
  const originalConsoleWarn = console.warn;
  console.warn = function(...args) {
    const message = args[0] || '';
    
    if (typeof message === 'string') {
      // Skip specific warnings
      if (message.includes('[DataSync] realtime unavailable') && 
          args[1] === 'TIMED_OUT') {
        // Only log once - handled by dataSync.js
        return;
      }
    }
    
    originalConsoleWarn.apply(console, args);
  };
}

// Initialize
debug.install = installErrorHandlers;

export default debug;
