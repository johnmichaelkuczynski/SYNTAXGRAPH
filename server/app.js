import express from 'express';
import cors from 'cors';
import multer from 'multer';
import mammoth from 'mammoth';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import WordExtractor from 'word-extractor';
import { createDatabase } from './db.js';
import { callProvider, providerList } from './providers.js';
import { analyzeGPTZero } from './gptzero.js';
import { assertTransformInput, basicValidation, normalizeResult, splitDocument, truncateSample, words } from './text.js';
import { revisionPrompt, system, transformPrompt, validatePrompt } from './prompts.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const authorizedByInstructions = text => /(?:use|include|draw from|incorporate)\s+(?:the\s+)?(?:content source|box d)/i.test(text || '');

export function createApp({ db = createDatabase(), providerCall = callProvider, gptzeroCall = analyzeGPTZero } = {}) {
  const app = express();
  app.use(cors()); app.use(express.json({ limit: '5mb' }));
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/providers', (_req, res) => res.json(providerList));

  app.get('/api/samples', (req, res) => {
    const q = `%${req.query.q || ''}%`;
    res.json(db.prepare('SELECT * FROM style_samples WHERE name LIKE ? OR author LIKE ? OR text LIKE ? ORDER BY datetime(created_at) DESC').all(q, q, q));
  });
  app.post('/api/samples', (req, res) => {
    const { author, name } = req.body; const truncated = truncateSample(req.body.text || '');
    if (!author?.trim() || !name?.trim() || !truncated.text) return res.status(400).json({ error: 'Author, sample name, and text are required.' });
    const info = db.prepare('INSERT INTO style_samples(author,name,text,word_count) VALUES(?,?,?,?)').run(author.trim(), name.trim(), truncated.text, words(truncated.text));
    res.status(201).json({ ...db.prepare('SELECT * FROM style_samples WHERE id=?').get(info.lastInsertRowid), truncated: truncated.truncated, originalWords: truncated.originalWords });
  });
  app.put('/api/samples/:id', (req, res) => {
    const truncated = truncateSample(req.body.text || '');
    if (!req.body.author?.trim() || !req.body.name?.trim() || !truncated.text) return res.status(400).json({ error: 'Author, sample name, and text are required.' });
    const info = db.prepare('UPDATE style_samples SET author=?,name=?,text=?,word_count=? WHERE id=?').run(req.body.author.trim(), req.body.name.trim(), truncated.text, words(truncated.text), req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'Sample not found.' });
    res.json({ ...db.prepare('SELECT * FROM style_samples WHERE id=?').get(req.params.id), truncated: truncated.truncated });
  });
  app.delete('/api/samples/:id', (req, res) => { db.prepare('DELETE FROM style_samples WHERE id=?').run(req.params.id); res.status(204).end(); });

  app.post('/api/extract', upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Choose a file.' });
      const ext = req.file.originalname.toLowerCase().split('.').pop(); let text;
      if (ext === 'txt') text = req.file.buffer.toString('utf8');
      else if (ext === 'docx') text = (await mammoth.extractRawText({ buffer: req.file.buffer })).value;
      else if (ext === 'pdf') text = (await pdf(req.file.buffer)).text;
      else if (ext === 'doc') text = (await new WordExtractor().extract(req.file.buffer)).getBody();
      else return res.status(415).json({ error: 'Supported files: TXT, PDF, DOC, and DOCX.' });
      res.json({ text, sections: splitDocument(text), wordCount: words(text) });
    } catch (e) { next(e); }
  });

  async function independentValidation(provider, input, output, content, authorized) {
    const report = await providerCall(provider, 'You are a strict semantic equivalence auditor. JSON only.', validatePrompt({ input, output, content, authorized }));
    const length = basicValidation(input, output);
    report.length = { inputWords: length.inputWords, outputWords: length.outputWords, ratio: length.lengthRatio, pass: length.lengthPass };
    report.pass = report.alignmentPercent >= 95 && !(report.contradictions?.length) && !(report.unauthorizedAdditions?.length) && length.lengthPass;
    return report;
  }

  app.post('/api/transform', async (req, res, next) => {
    try {
      const { input = '', style = '', content = '', instructions = '', provider = 'perplexity' } = req.body;
      assertTransformInput(input, style); const authorized = authorizedByInstructions(instructions);
      let result, report, feedback = '';
      for (let attempt = 1; attempt <= 3; attempt++) {
        result = normalizeResult(await providerCall(provider, system, transformPrompt({ input, style, content, instructions, authorized, feedback })), input, style);
        report = await independentValidation(provider, input, result.finalOutput, content, authorized);
        if (report.pass) break;
        feedback = JSON.stringify(report);
      }
      if (!report.pass) return res.status(422).json({ error: 'The generated result failed mandatory meaning or length validation after 3 attempts.', report });
      result.overallValidation = report;
      db.prepare('INSERT INTO history(provider,operation,input,output,metadata) VALUES(?,?,?,?,?)').run(provider, 'transform', input, result.finalOutput, JSON.stringify(result));
      res.json(result);
    } catch (e) { next(e); }
  });
  app.post('/api/validate', async (req, res, next) => {
    try { const a = authorizedByInstructions(req.body.instructions); res.json(await independentValidation(req.body.provider || 'perplexity', req.body.input, req.body.output, req.body.content, a)); } catch (e) { next(e); }
  });
  app.post('/api/revise', async (req, res, next) => {
    try {
      const { provider = 'perplexity', input, output, instruction = '', mode = 'retransform', content = '', instructions = '', report: defects } = req.body;
      const authorized = authorizedByInstructions(instructions); let candidate = output, report;
      for (let i = 0; i < 3; i++) {
        const value = await providerCall(provider, system, revisionPrompt({ original: input, current: candidate, instruction, mode, report: defects || report }));
        candidate = value.finalOutput; if (!candidate) throw new Error('Provider returned no revised output.');
        report = await independentValidation(provider, input, candidate, content, authorized); if (report.pass) break;
      }
      if (!report.pass) return res.status(422).json({ error: 'Revision failed mandatory validation after 3 attempts.', report });
      db.prepare('INSERT INTO history(provider,operation,input,output,metadata) VALUES(?,?,?,?,?)').run(provider, mode, input, candidate, JSON.stringify(report));
      res.json({ finalOutput: candidate, overallValidation: report });
    } catch (e) { next(e); }
  });
  app.post('/api/gptzero', async (req, res) => res.json(await gptzeroCall(req.body.text)));
  app.get('/api/history', (_req, res) => res.json(db.prepare('SELECT id,provider,operation,input,output,created_at FROM history ORDER BY id DESC LIMIT 50').all()));
  app.use((error, _req, res, _next) => { console.error(error); res.status(error.status || 500).json({ error: error.message || 'Unexpected server error.' }); });
  return app;
}
