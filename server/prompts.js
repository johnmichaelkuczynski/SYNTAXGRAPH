export const system = `You are the SyntaxGraph engine. Return JSON only. You perform syntactic graphing, never generic style imitation. The style sample supplies abstract syntax only and absolutely no facts, claims, names, numbers, terminology, symbols, metaphors, or distinctive content phrases. Preserve every proposition, entity, number, quotation, qualification, negation, relationship, and certainty degree in the original. Do not add facts. Preserve sentence order. Output length must be 90–110% of original. Never copy more than eight consecutive content words from the style sample.`;

export function transformPrompt({ input, style, instructions = '', content = '', authorized = false, feedback = '' }) {
  return `Process the ORIGINAL sentence-by-sentence using actual sentences from STYLE SAMPLE. For each sentence: inventory its meaning, select one suitable sample sentence, abstract that sentence into a content-neutral template, fill it only with original meaning, and verify it. Reject and retry failures.

ORIGINAL:\n${input}\n\nSTYLE SAMPLE:\n${style}
${authorized ? `\nAUTHORIZED CONTENT SOURCE (use only as requested):\n${content}` : '\nContent source is NOT authorized and must be ignored.'}
\nOPTIONAL INSTRUCTIONS (cannot override safeguards):\n${instructions || 'None'}
${feedback ? `\nVALIDATOR FEEDBACK TO CORRECT:\n${feedback}` : ''}
\nReturn this schema: {"mappings":[{"inputSentence":"exact original sentence","meaningInventory":{"propositions":[],"qualifications":[],"negations":[],"relationships":[],"namedEntities":[],"numbers":[],"certainty":[]},"styleSentence":"exact sentence selected verbatim from sample","template":"content-neutral syntactic template with slots","transformedSentence":"...","validation":{"preserved":true,"unauthorizedAdditions":[],"notes":"..."}}],"finalOutput":"...","overallValidation":{"preservationPercent":number,"contradictions":[],"unauthorizedAdditions":[],"authorizedAdditions":[],"lengthPass":boolean,"pass":boolean}}.`;
}

export function validatePrompt({ input, output, content = '', authorized = false }) {
  return `Independently compare ORIGINAL and OUTPUT. You have not received and must not infer any style sample. Identify atomic propositions strictly. Authorized additions can only come from the provided source when authorization is true.
ORIGINAL:\n${input}\n\nOUTPUT:\n${output}\n\nAUTHORIZED=${authorized}\nCONTENT SOURCE:\n${authorized ? content : '(not available)'}
Return {"alignmentPercent":number,"preservedPropositions":[],"missingPropositions":[],"alteredPropositions":[],"contradictions":[],"unauthorizedAdditions":[],"authorizedAdditions":[],"length":{"inputWords":number,"outputWords":number,"ratio":number,"pass":boolean},"pass":boolean}. Pass only at >=95% preservation, zero contradictions, zero unauthorized additions, and 0.9–1.1 length ratio.`;
}

export function revisionPrompt({ original, current, instruction, mode, report }) {
  return `${mode === 'naturalize' ? 'Make only the smallest grammatical and lexical changes necessary for natural reading, retaining as much grafted syntax as possible.' : 'Perform a limited second syntactic transformation.'} Preserve every original proposition, sentence order, factual detail, and 90–110% length. Add nothing. ${instruction || ''}
ORIGINAL:\n${original}\nCURRENT:\n${current}\n${report ? `DEFECTS:\n${JSON.stringify(report)}` : ''}
Return {"finalOutput":"..."}.`;
}
