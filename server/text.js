export const words = (text = '') => text.trim() ? text.trim().split(/\s+/).length : 0;

export function sentences(text = '') {
  return (text.match(/[^.!?]+(?:[.!?]+["'”’)]*|$)/g) || [])
    .map(value => value.trim()).filter(Boolean);
}

export function splitDocument(text, limit = 1000) {
  if (words(text) <= limit) return [text.trim()].filter(Boolean);
  const paragraphs = text.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  const sections = [];
  let current = [];
  const flush = () => { if (current.length) sections.push(current.join('\n\n')); current = []; };
  for (const paragraph of paragraphs) {
    if (words(paragraph) > limit) {
      flush();
      let chunk = [];
      for (const sentence of sentences(paragraph)) {
        if (words([...chunk, sentence].join(' ')) > limit) { if (chunk.length) sections.push(chunk.join(' ')); chunk = []; }
        if (words(sentence) > limit) {
          const tokens = sentence.split(/\s+/);
          while (tokens.length) sections.push(tokens.splice(0, limit).join(' '));
        } else chunk.push(sentence);
      }
      if (chunk.length) sections.push(chunk.join(' '));
    } else if (words([...current, paragraph].join('\n\n')) > limit) {
      flush(); current.push(paragraph);
    } else current.push(paragraph);
  }
  flush();
  return sections;
}

export function truncateSample(text, limit = 3000) {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return { text: tokens.slice(0, limit).join(' '), truncated: tokens.length > limit, originalWords: tokens.length };
}

export function assertTransformInput(input, style) {
  const inputWords = words(input);
  if (!inputWords) throw Object.assign(new Error('Original text is required.'), { status: 400 });
  if (inputWords > 1000) throw Object.assign(new Error('This section exceeds 1,000 words. Split it before transforming.'), { status: 400 });
  if (words(style) < inputWords * 2) throw Object.assign(new Error(`Style sample is too short. It needs at least ${inputWords * 2} words for this ${inputWords}-word section.`), { status: 400 });
}

export function normalizeResult(value, input, style) {
  const inputSentences = sentences(input);
  if (!value || !Array.isArray(value.mappings) || value.mappings.length === 0) throw new Error('Provider returned no sentence mappings.');
  for (const [index, mapping] of value.mappings.entries()) {
    if (!mapping.inputSentence || !mapping.styleSentence || !mapping.template || !mapping.transformedSentence) {
      throw new Error(`Mapping ${index + 1} is incomplete.`);
    }
    if (!style.includes(mapping.styleSentence)) throw new Error(`Mapping ${index + 1} is not traceable to the style sample.`);
  }
  const finalOutput = value.finalOutput || value.mappings.map(x => x.transformedSentence).join(' ');
  return { ...value, inputSentenceCount: inputSentences.length, finalOutput };
}

export function basicValidation(input, output) {
  const inputWords = words(input), outputWords = words(output);
  const ratio = inputWords ? outputWords / inputWords : 0;
  return { inputWords, outputWords, lengthRatio: Number(ratio.toFixed(3)), lengthPass: ratio >= .9 && ratio <= 1.1 };
}
