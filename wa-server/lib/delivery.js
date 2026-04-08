async function withRetry(task, {
  retries = 2,
  baseDelayMs = 400,
  timeoutMs = 20000
} = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await Promise.race([
        task(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
      ]);
    } catch (err) {
      lastErr = err;
      if (attempt >= retries) break;
      const jitter = Math.floor(Math.random() * 120);
      const delay = baseDelayMs * (attempt + 1) + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr || new Error('Failed after retries');
}

module.exports = {
  withRetry
};
