// Derive a model name + traffic profile number from a file's name/path.
// Tolerant by design: the matcher accepts any letter (incl. unseen "L") and
// either folder-segment or bare-filename forms, with "_" or spaces as
// separators. Never hard-codes the shipped A-K set.

export interface SweepIdentity {
  model: string;
  profile: number;
  inferred: boolean;
}

const PATTERN = /model[ _]+([a-z0-9]+)[ _]+profile[ _]+(\d+)/i;

/**
 * @param relPath  webkitRelativePath if available (e.g.
 *                 "Model_A_profile_1/Model A profile 1.xlsx"), else "".
 * @param fileName the bare file name.
 */
export function deriveIdentity(relPath: string, fileName: string): SweepIdentity {
  // Try the folder segment first (most reliable), then the bare name.
  const candidates = [relPath, fileName].filter(Boolean);
  for (const c of candidates) {
    const m = c.match(PATTERN);
    if (m) {
      return { model: m[1].toUpperCase(), profile: parseInt(m[2], 10), inferred: false };
    }
  }

  // Fallback: strip extension, use the cleaned base name as the model label and
  // profile 1, flagged so the UI can prompt the user to confirm.
  const base = (fileName || relPath || 'Unknown').replace(/\.[^.]+$/, '').trim();
  return { model: base || 'Unknown', profile: 1, inferred: true };
}
