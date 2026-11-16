export function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

// Whisper supplies segment boundaries, not exact word timing. Unaligned text
// is deliberately left untimed rather than assigning invented timestamps.
export function alignSegments(result, duration) {
  const text = result.text.trim();
  const chunks = result.chunks || [];
  const segments = [];
  let cursor = 0, lastEnd = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const content = chunk.text?.trim();
    if (!content) continue;
    const startIndex = text.indexOf(content, cursor);
    if (startIndex < 0) continue;
    cursor = startIndex + content.length;
    const start = chunk.timestamp?.[0];
    const rawEnd = chunk.timestamp?.[1] ?? chunks[i + 1]?.timestamp?.[0] ?? duration;
    if (!Number.isFinite(start) || !Number.isFinite(rawEnd)) continue;
    const end = Math.min(duration, rawEnd);
    if (start < lastEnd || start < 0 || start >= end) continue;
    segments.push({text: content, start, end, startIndex, endIndex: cursor});
    lastEnd = end;
  }
  return {text, segments};
}

export function attachTimes(result, segments) {
  return {...result, evidence: result.evidence.map(item => {
    const segment = segments.find(s => item.matchStart >= s.startIndex && item.matchStart < s.endIndex);
    return {...item, timestamp: segment?.start ?? null, timestampPrecision: segment ? 'approximate segment start' : null};
  })};
}

export function revealAt(text, segments, time) {
  let end = 0;
  for (const segment of segments) if (segment.end <= time + 0.03) end = Math.max(end, segment.endIndex);
  return text.slice(0, end);
}

export function hasFullTimeline(text, segments) {
  if (!segments.length) return false;
  let cursor = 0;
  for (const segment of segments) {
    if (text.slice(cursor, segment.startIndex).trim()) return false;
    cursor = segment.endIndex;
  }
  return !text.slice(cursor).trim();
}
