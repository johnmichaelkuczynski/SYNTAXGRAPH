import { describe, expect, it } from 'vitest';
import { assertTransformInput, basicValidation, normalizeResult, splitDocument, truncateSample, words } from '../server/text.js';

describe('document rules', () => {
  it('divides texts over 1,000 words without losing text or exceeding the limit', () => {
    const text = Array.from({ length: 2300 }, (_, i) => `word${i}`).join(' ');
    const chunks = splitDocument(text);
    expect(chunks.length).toBe(3);
    expect(chunks.every(x => words(x) <= 1000)).toBe(true);
    expect(chunks.reduce((n, x) => n + words(x), 0)).toBe(2300);
  });
  it('truncates samples after 3,000 words and reports it', () => {
    const result = truncateSample('word '.repeat(3002));
    expect(result.truncated).toBe(true); expect(words(result.text)).toBe(3000);
  });
  it('rejects insufficient style samples', () => {
    expect(() => assertTransformInput('one two three', 'four five six seven five')).toThrow(/too short/i);
  });
  it('calculates mandatory 90–110% length bounds', () => {
    expect(basicValidation('one two three four', 'a b c d').lengthPass).toBe(true);
    expect(basicValidation('one two three four', 'a b').lengthPass).toBe(false);
  });
});

describe('traceability', () => {
  it('requires every transformed sentence to map to a real sample sentence and template', () => {
    const style = 'Although rain fell, the parade continued. A second sufficiently long sentence follows.';
    const value = { mappings: [{ inputSentence: 'Sales fell.', styleSentence: 'Although rain fell, the parade continued.', template: 'Although [condition], [main clause].', transformedSentence: 'Although demand weakened, sales continued.', validation: { preserved: true } }] };
    expect(normalizeResult(value, 'Sales fell.', style).finalOutput).toContain('sales continued');
    expect(() => normalizeResult({ ...value, mappings: [{ ...value.mappings[0], styleSentence: 'Invented sentence.' }] }, 'Sales fell.', style)).toThrow(/not traceable/i);
  });
});
