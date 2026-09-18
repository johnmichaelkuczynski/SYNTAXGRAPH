const configs = {
  openai: { key: 'OPENAI_API_KEY', model: 'OPENAI_MODEL', fallback: 'gpt-4o-mini', url: 'https://api.openai.com/v1/chat/completions', kind: 'openai' },
  deepseek: { key: 'DEEPSEEK_API_KEY', model: 'DEEPSEEK_MODEL', fallback: 'deepseek-chat', url: 'https://api.deepseek.com/chat/completions', kind: 'openai' },
  grok: { key: 'GROK_API_KEY', model: 'GROK_MODEL', fallback: 'grok-3-mini', url: 'https://api.x.ai/v1/chat/completions', kind: 'openai' },
  perplexity: { key: 'PERPLEXITY_API_KEY', model: 'PERPLEXITY_MODEL', fallback: 'sonar', url: 'https://api.perplexity.ai/chat/completions', kind: 'openai' },
  venice: { key: 'VENICE_API_KEY', model: 'VENICE_MODEL', fallback: 'llama-3.3-70b', url: 'https://api.venice.ai/api/v1/chat/completions', kind: 'openai' },
  anthropic: { key: 'ANTHROPIC_API_KEY', model: 'ANTHROPIC_MODEL', fallback: 'claude-3-5-sonnet-latest', url: 'https://api.anthropic.com/v1/messages', kind: 'anthropic' }
};

export const providerList = Object.entries(configs).map(([id, c]) => ({ id, model: process.env[c.model] || c.fallback, configured: Boolean(process.env[c.key]) }));

function extractJson(text) {
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('AI provider returned invalid structured data.');
  }
}

export async function callProvider(provider, system, prompt, { timeout = Number(process.env.REQUEST_TIMEOUT_MS) || 90000 } = {}) {
  const config = configs[provider];
  if (!config) throw Object.assign(new Error(`Unknown provider: ${provider}`), { status: 400 });
  const key = process.env[config.key];
  if (!key) throw Object.assign(new Error(`${provider} is unavailable: ${config.key} is not configured on the server.`), { status: 503 });
  const model = process.env[config.model] || config.fallback;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const headers = { 'content-type': 'application/json' };
  let body;
  if (config.kind === 'anthropic') {
    Object.assign(headers, { 'x-api-key': key, 'anthropic-version': '2023-06-01' });
    body = { model, max_tokens: 8000, system, messages: [{ role: 'user', content: prompt }] };
  } else {
    headers.authorization = `Bearer ${key}`;
    body = { model, temperature: 0.15, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] };
  }
  try {
    const response = await fetch(config.url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(`${provider} request failed (${response.status}): ${payload.error?.message || 'No usable response'}`), { status: 502 });
    const text = config.kind === 'anthropic' ? payload.content?.[0]?.text : payload.choices?.[0]?.message?.content;
    if (!text) throw Object.assign(new Error(`${provider} returned an empty response.`), { status: 502 });
    return extractJson(text);
  } catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error(`${provider} request timed out.`), { status: 504 });
    throw error;
  } finally { clearTimeout(timer); }
}
