export async function analyzeGPTZero(text, timeout = 20000) {
  if (!text?.trim()) return { status: 'empty', message: 'Enter text to analyze.' };
  const key = process.env.GPTZERO_API_KEY;
  if (!key) return { status: 'unavailable', message: 'GPTZERO_API_KEY is not configured on the server.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch('https://api.gptzero.me/v2/predict/text', {
      method: 'POST', signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key }, body: JSON.stringify({ document: text })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { status: 'failed', message: `GPTZero request failed (${response.status}).`, detail: payload.error || null };
    return { status: 'complete', result: payload };
  } catch (error) {
    return { status: 'failed', message: error.name === 'AbortError' ? 'GPTZero request timed out.' : `GPTZero request failed: ${error.message}` };
  } finally { clearTimeout(timer); }
}
