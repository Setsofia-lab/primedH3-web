/**
 * Strip code fences / chat preambles around a JSON payload returned by
 * a Bedrock-hosted LLM. Returns parsed JSON or `null` on failure;
 * callers re-validate with their own zod schema.
 */
export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = /```(?:json)?\s*([\s\S]+?)\s*```/m.exec(trimmed);
  const raw = fence ? fence[1] : trimmed;
  try {
    return JSON.parse(raw ?? '');
  } catch {
    const m = /\{[\s\S]+\}/.exec(raw ?? '');
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}
