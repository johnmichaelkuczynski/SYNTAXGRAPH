import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const api = async (url, options = {}) => {
  const response = await fetch(`/api${url}`, { headers: options.body instanceof FormData ? {} : { 'content-type': 'application/json' }, ...options });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || `Request failed (${response.status})`), { body });
  return body;
};
const count = text => text.trim() ? text.trim().split(/\s+/).length : 0;
const providerNames = { perplexity: 'Perplexity', openai: 'OpenAI', anthropic: 'Anthropic', deepseek: 'DeepSeek', grok: 'Grok', venice: 'Venice AI' };

function Detector({ value, immediate = false }) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!value.trim()) { setResult(null); return; }
    const timer = setTimeout(() => api('/gptzero', { method: 'POST', body: JSON.stringify({ text: value }) }).then(setResult).catch(e => setResult({ status: 'failed', message: e.message })), immediate ? 0 : 2000);
    return () => clearTimeout(timer);
  }, [value, immediate]);
  const score = result?.result?.documents?.[0]?.completely_generated_prob;
  return <span className={`detector ${result?.status || ''}`}><i /> GPTZero: {!result ? (value ? 'waiting…' : '—') : result.status === 'complete' ? (Number.isFinite(score) ? `${Math.round(score * 100)}% AI` : 'analysis complete') : result.message}</span>;
}

function Metrics({ value, generated }) {
  return <div className="metrics"><span>{count(value).toLocaleString()} words</span><span>{value.length.toLocaleString()} characters</span><Detector value={value} immediate={generated} /></div>;
}

function DropArea({ label, value, onChange, onFile, placeholder, generated = false, children }) {
  const input = useRef();
  return <section className="box" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) onFile?.(file); else onChange(e.dataTransfer.getData('text')); }}>
    <div className="box-label"><span>{label}</span>{onFile && <button className="text-button" onClick={() => input.current.click()}>↑ Upload</button>}</div>
    {children}
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} spellCheck="true" />
    {onFile && <input ref={input} hidden type="file" accept=".txt,.pdf,.doc,.docx" onChange={e => e.target.files[0] && onFile(e.target.files[0])} />}
    <Metrics value={value} generated={generated} />
  </section>;
}

function Report({ report, onClose, onCorrect, busy }) {
  const row = (name, value, bad) => <div className="report-row"><strong>{name}</strong><div className={bad ? 'bad' : ''}>{Array.isArray(value) ? (value.length ? value.join(' · ') : 'None') : value}</div></div>;
  return <div className="modal-backdrop"><div className="modal report"><button className="close" onClick={onClose}>×</button><span className={`status-pill ${report.pass ? 'pass' : 'fail'}`}>{report.pass ? 'PASS' : 'FAIL'}</span><h2>Meaning identity</h2><div className="alignment"><b>{report.alignmentPercent}%</b><span>semantic alignment</span></div>
    {row('Preserved propositions', report.preservedPropositions)}{row('Missing propositions', report.missingPropositions, report.missingPropositions?.length)}{row('Altered propositions', report.alteredPropositions, report.alteredPropositions?.length)}{row('Contradictions', report.contradictions, report.contradictions?.length)}{row('Unauthorized additions', report.unauthorizedAdditions, report.unauthorizedAdditions?.length)}{row('Authorized additions from Box D', report.authorizedAdditions)}{row('Length comparison', `${report.length?.inputWords} → ${report.length?.outputWords} words (${Math.round((report.length?.ratio || 0) * 100)}%)`, !report.length?.pass)}
    {!report.pass && <button className="primary full" disabled={busy} onClick={onCorrect}>{busy ? 'CORRECTING…' : 'CORRECT AND REGENERATE'}</button>}
  </div></div>;
}

function SampleLibrary({ selected, onSelect, onStyle }) {
  const empty = { author: '', name: '', text: '' }; const [samples, setSamples] = useState([]); const [form, setForm] = useState(empty); const [editing, setEditing] = useState(null); const [query, setQuery] = useState(''); const [notice, setNotice] = useState('');
  const load = () => api(`/samples?q=${encodeURIComponent(query)}`).then(setSamples).catch(e => setNotice(e.message));
  useEffect(load, [query]);
  const save = async () => { try { const result = await api(editing ? `/samples/${editing}` : '/samples', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) }); setNotice(result.truncated ? 'Saved. Text was truncated to the first 3,000 words.' : 'Sample saved.'); setForm(empty); setEditing(null); load(); } catch (e) { setNotice(e.message); } };
  return <div className="library">
    <div className="sample-form"><input placeholder="Author name" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })}/><input placeholder="Sample name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/><textarea placeholder="Paste or type a style sample to save…" value={form.text} onChange={e => setForm({ ...form, text: e.target.value })}/><button className="secondary" onClick={save}>{editing ? 'UPDATE SAMPLE' : 'SAVE TO LIBRARY'}</button>{editing && <button className="text-button" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</button>}</div>
    {notice && <p className="notice">{notice}</p>}<div className="search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search saved samples" /></div>
    <div className="sample-list">{!samples.length && <div className="empty">No saved samples yet.</div>}{samples.map(s => <article className={selected === s.id ? 'selected' : ''} key={s.id}><div><b>{s.name}</b><span>by {s.author}</span></div><p>{s.text}</p><small>{s.word_count} words · {new Date(s.created_at + 'Z').toLocaleDateString()}</small><div className="sample-actions"><button onClick={() => { onSelect(s.id); onStyle(s.text); }}>SELECT</button><button onClick={() => { setEditing(s.id); setForm({ author: s.author, name: s.name, text: s.text }); }}>EDIT</button><button onClick={async () => { if (confirm(`Delete “${s.name}”?`)) { await api(`/samples/${s.id}`, { method: 'DELETE' }); if (selected === s.id) onSelect(null); load(); } }}>DELETE</button></div></article>)}</div>
  </div>;
}

function App() {
  const [original, setOriginal] = useState(''); const [output, setOutput] = useState(''); const [style, setStyle] = useState(''); const [content, setContent] = useState(''); const [instructions, setInstructions] = useState(''); const [reInstruction, setReInstruction] = useState(''); const [provider, setProvider] = useState('perplexity'); const [providers, setProviders] = useState([]); const [sections, setSections] = useState([]); const [section, setSection] = useState(0); const [selected, setSelected] = useState(null); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [result, setResult] = useState(null); const [report, setReport] = useState(null); const [details, setDetails] = useState(false);
  useEffect(() => { api('/providers').then(setProviders).catch(() => {}); }, []);
  const extract = async file => { setError(''); setBusy('extract'); try { const fd = new FormData(); fd.append('file', file); const data = await api('/extract', { method: 'POST', body: fd }); setSections(data.sections); setSection(0); setOriginal(data.sections[0] || ''); if (data.sections.length > 1) setError(`Document divided into ${data.sections.length} sections (maximum 1,000 words each).`); } catch (e) { setError(e.message); } finally { setBusy(''); } };
  const run = async () => { if (busy) return; setBusy('transform'); setError(''); try { const data = await api('/transform', { method: 'POST', body: JSON.stringify({ input: original, style, content, instructions, provider }) }); setResult(data); setOutput(data.finalOutput); setReport(null); } catch (e) { setError(e.message); if (e.body?.report) setReport(e.body.report); } finally { setBusy(''); } };
  const validate = async () => { if (!output) return; setBusy('validate'); setError(''); try { setReport(await api('/validate', { method: 'POST', body: JSON.stringify({ input: original, output, content, instructions, provider }) })); } catch (e) { setError(e.message); } finally { setBusy(''); } };
  const revise = async (mode, defects) => { setBusy(mode); setError(''); try { const data = await api('/revise', { method: 'POST', body: JSON.stringify({ provider, input: original, output, instruction: reInstruction, mode, content, instructions, report: defects }) }); setOutput(data.finalOutput); setReport(data.overallValidation); } catch (e) { setError(e.message); if (e.body?.report) setReport(e.body.report); } finally { setBusy(''); } };
  const changeSection = i => { setSection(i); setOriginal(sections[i]); setOutput(''); setResult(null); };
  return <><header><div className="brand"><span className="mark">S<span>G</span></span><div><h1>SYNTAXGRAPH</h1><p>MEANING, RESTRUCTURED.</p></div></div><div className="provider"><label>AI PROVIDER</label><select value={provider} onChange={e => setProvider(e.target.value)}>{Object.keys(providerNames).map(id => <option key={id} value={id}>{providerNames[id]} {providers.find(p => p.id === id)?.configured === false ? '· not configured' : ''}</option>)}</select><i className={providers.find(p => p.id === provider)?.configured ? 'online' : ''}/></div></header>
    <main><div className="intro"><div><span className="eyebrow">SYNTACTIC GRAPHING WORKSPACE</span><h2>Keep the meaning.<br/><em>Change the architecture.</em></h2></div><p>SyntaxGraph extracts abstract sentence structures from a separate sample, then rebuilds your text—without importing the sample’s subject matter.</p></div>
    {error && <div className="alert"><span>!</span>{error}<button onClick={() => setError('')}>×</button></div>}
    {sections.length > 1 && <div className="sections"><b>DOCUMENT SECTIONS</b>{sections.map((_, i) => <button className={i === section ? 'active' : ''} onClick={() => changeSection(i)} key={i}>{i + 1}</button>)}<span>Transform individually in order.</span></div>}
    <div className="action-grid"><div><button className="primary" disabled={Boolean(busy)} onClick={run}>{busy === 'transform' ? <><i className="spinner"/> GRAPHING…</> : 'TRANSFORM →'}</button></div><div className="output-actions"><button disabled={!output || Boolean(busy)} onClick={validate}>MEANING IDENTITY</button><button disabled={!output || Boolean(busy)} onClick={() => revise('retransform')}>RETRANSFORM</button><button disabled={!output || Boolean(busy)} onClick={() => revise('naturalize')}>NATURALIZE</button><input value={reInstruction} onChange={e => setReInstruction(e.target.value)} placeholder="Optional retransform instruction"/></div></div>
    <div className="workspace"><div className="primary-workspace"><DropArea label="A — ORIGINAL TEXT" value={original} onChange={v => { setOriginal(v); setSections([]); }} onFile={extract} placeholder="Type, paste, drop, or upload your source text…"/><DropArea label="B — TRANSFORMED TEXT" value={output} onChange={setOutput} generated placeholder="Your validated transformation will appear here…">{result && <button className="details-button" onClick={() => setDetails(!details)}>{details ? 'HIDE DETAILS' : 'DETAILS'} <span>{result.mappings?.length}</span></button>}</DropArea></div>
      <section className="box style-box"><div className="box-label"><span>C — STYLE SAMPLE</span><b>Syntax only · 3,000-word maximum</b></div><p className="help">Select a saved sample, or upload, paste, type, or drag and drop a new one. Samples persist after restart.</p><DropArea label="ACTIVE SAMPLE" value={style} onChange={setStyle} onFile={async f => { const fd = new FormData(); fd.append('file', f); try { const d = await api('/extract', { method: 'POST', body: fd }); setStyle(d.text.split(/\s+/).slice(0, 3000).join(' ')); } catch(e) { setError(e.message); } }} placeholder="Active style sample…"/><SampleLibrary selected={selected} onSelect={setSelected} onStyle={setStyle}/></section>
      <div className="supporting-workspace"><DropArea label="D — CONTENT SOURCE · OPTIONAL" value={content} onChange={setContent} onFile={async f => { const fd = new FormData(); fd.append('file', f); try { const d = await api('/extract', { method: 'POST', body: fd }); setContent(d.text); } catch(e) { setError(e.message); } }} placeholder="Supporting material only. Ignored unless Box E explicitly says to use Box D."><p className="help">This material cannot affect a transformation unless explicitly authorized below.</p></DropArea>
      <section className="box instructions"><div className="box-label"><span>E — TRANSFORMATION INSTRUCTIONS · OPTIONAL</span><b>Safeguards always apply</b></div><textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Qualify tone or terminology, or explicitly authorize use of Box D…"/><Metrics value={instructions}/></section></div>
    </div>
    {details && result && <section className="mapping"><div className="mapping-head"><span className="eyebrow">AUDIT TRAIL</span><h2>Sentence mapping</h2><p>Every transformed sentence is traceable to the actual sample sentence and abstract template used.</p></div>{result.mappings.map((m, i) => <article key={i}><div className="map-num">{String(i + 1).padStart(2, '0')}</div><div><label>INPUT SENTENCE</label><p>{m.inputSentence}</p><label>SELECTED STYLE SENTENCE</label><p className="muted">{m.styleSentence}</p><label>ABSTRACT TEMPLATE</label><code>{m.template}</code><label>TRANSFORMED SENTENCE</label><p className="result-text">{m.transformedSentence}</p><span className={m.validation?.preserved ? 'verified' : 'failed'}>{m.validation?.preserved ? '✓ Meaning verified' : '× Validation failed'}</span></div></article>)}</section>}
    </main><footer><span>SYNTAXGRAPH</span><p>Style supplies structure. Your text supplies everything else.</p><b>v1.0</b></footer>
    {report && <Report report={report} busy={Boolean(busy)} onClose={() => setReport(null)} onCorrect={() => revise('correct', report)}/>}</>;
}

createRoot(document.getElementById('root')).render(<App/>);
