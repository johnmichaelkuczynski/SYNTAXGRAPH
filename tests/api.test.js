import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { createDatabase } from '../server/db.js';

const input = 'Mara delivered 12 parcels on Tuesday.';
const styleSentence = 'Although the winter was bitter, the expedition carried onward.';
const style = `${styleSentence} ${'Neutral structural material continues here. '.repeat(20)}`;
const validReport = { alignmentPercent: 100, preservedPropositions: ['Mara delivered 12 parcels on Tuesday'], missingPropositions: [], alteredPropositions: [], contradictions: [], unauthorizedAdditions: [], authorizedAdditions: [] };
const graph = { mappings: [{ inputSentence: input, meaningInventory: { propositions: ['Mara delivered 12 parcels on Tuesday'], namedEntities: ['Mara'], numbers: ['12'] }, styleSentence, template: 'Although [subordinate clause], [main clause].', transformedSentence: input, validation: { preserved: true, unauthorizedAdditions: [] }], finalOutput: input };
const make = providerCall => createApp({ db: createDatabase(':memory:'), providerCall, gptzeroCall: async () => ({ status: 'unavailable', message: 'not configured' }) });

afterEach(() => vi.restoreAllMocks());
describe('transformation API', () => {
  it('preserves facts, imports no sample content, remains in range, and exposes traceability', async () => {
    const provider = vi.fn().mockResolvedValueOnce(graph).mockResolvedValueOnce(validReport);
    const response = await request(make(provider)).post('/api/transform').send({ input, style, provider: 'openai' }).expect(200);
    expect(response.body.finalOutput).toContain('Mara'); expect(response.body.finalOutput).toContain('12');
    expect(response.body.finalOutput).not.toMatch(/winter|expedition|bitter/);
    expect(response.body.overallValidation.length.pass).toBe(true);
    expect(response.body.mappings[0]).toMatchObject({ styleSentence, template: expect.any(String) });
  });
  it('naturalization is separately validated and introduces no propositions', async () => {
    const provider = vi.fn().mockResolvedValueOnce({ finalOutput: input }).mockResolvedValueOnce(validReport);
    const response = await request(make(provider)).post('/api/revise').send({ input, output: input, mode: 'naturalize', provider: 'openai' }).expect(200);
    expect(response.body.finalOutput).toBe(input); expect(response.body.overallValidation.unauthorizedAdditions).toEqual([]);
  });
  it('returns an honest unavailable GPTZero result', async () => {
    const response = await request(make(vi.fn())).post('/api/gptzero').send({ text: input }).expect(200);
    expect(response.body).toEqual({ status: 'unavailable', message: 'not configured' });
  });
  it('returns external failures instead of invented output', async () => {
    const provider = vi.fn().mockRejectedValue(Object.assign(new Error('provider timed out'), { status: 504 }));
    const response = await request(make(provider)).post('/api/transform').send({ input, style, provider: 'openai' }).expect(504);
    expect(response.body.error).toBe('provider timed out'); expect(response.body.finalOutput).toBeUndefined();
  });
});

describe('server security and persistence', () => {
  it('never exposes provider API keys from provider metadata', async () => {
    process.env.OPENAI_API_KEY = 'super-secret-value';
    const response = await request(make(vi.fn())).get('/api/providers').expect(200);
    expect(JSON.stringify(response.body)).not.toContain('super-secret-value');
    delete process.env.OPENAI_API_KEY;
  });
  it('persists full saved sample metadata and supports selection data', async () => {
    const app = make(vi.fn());
    const saved = await request(app).post('/api/samples').send({ author: 'A. Author', name: 'Cadence', text: style }).expect(201);
    expect(saved.body).toMatchObject({ author: 'A. Author', name: 'Cadence', word_count: expect.any(Number) });
    const list = await request(app).get('/api/samples?q=Cadence').expect(200);
    expect(list.body[0].text).toBe(style.trim()); expect(list.body[0].created_at).toBeTruthy();
  });
});
