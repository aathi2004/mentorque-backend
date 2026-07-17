/**
 * Text embeddings for semantic matching between mentor descriptions and
 * user call-request descriptions.
 *
 * Uses the free Hugging Face Inference API (sentence-transformers/all-MiniLM-L6-v2)
 * when HF_API_TOKEN is set. If it's not set, or the call fails for any reason
 * (rate limit, cold model, offline), we fall back to a lightweight local
 * bag-of-words hashing embedding so the recommendation pipeline still works
 * end-to-end without any external dependency. This keeps the "vector-less
 * approach is fine" allowance from the assignment brief a real fallback,
 * not just a claim.
 */

const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_API_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${HF_MODEL}`;
const LOCAL_EMBEDDING_DIM = 256;

function meanPool(vectors) {
  if (!Array.isArray(vectors) || vectors.length === 0) return [];
  // token embeddings: number[][] -> mean pool to a single vector
  if (Array.isArray(vectors[0])) {
    const dim = vectors[0].length;
    const out = new Array(dim).fill(0);
    for (const v of vectors) {
      for (let i = 0; i < dim; i++) out[i] += v[i];
    }
    return out.map((x) => x / vectors.length);
  }
  // already a single flat vector
  return vectors;
}

/**
 * Deterministic local fallback: hash each token into a fixed-size vector
 * (a simple "hashing trick" bag-of-words embedding). Not as good as a real
 * sentence embedding, but captures shared-vocabulary similarity reasonably
 * well for short mentor/user descriptions, with zero external dependency.
 */
function localHashEmbedding(text) {
  const vec = new Array(LOCAL_EMBEDDING_DIM).fill(0);
  const tokens = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
    }
    const idx = hash % LOCAL_EMBEDDING_DIM;
    vec[idx] += 1;
  }

  const norm = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

/**
 * Compute an embedding for a piece of text. Tries the HF Inference API first
 * (if HF_API_TOKEN is configured), falls back to the local hashing embedding
 * on any failure.
 */
export async function embedText(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return [];

  const token = process.env.HF_API_TOKEN;
  if (token) {
    try {
      const res = await fetch(HF_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: trimmed, options: { wait_for_model: true } }),
      });
      if (res.ok) {
        const data = await res.json();
        const pooled = meanPool(data);
        if (Array.isArray(pooled) && pooled.length > 0) return pooled;
      } else {
        console.warn("[embeddings] HF API returned", res.status, "- falling back to local embedding");
      }
    } catch (err) {
      console.warn("[embeddings] HF API call failed - falling back to local embedding:", err?.message || err);
    }
  }

  return localHashEmbedding(trimmed);
}

/**
 * Cosine similarity between two vectors. Returns 0 if dimensions mismatch
 * or either vector is empty (e.g. HF embedding vs. local-fallback embedding
 * computed at different times - we treat that as "no signal" rather than
 * throwing, since the tag/domain filters still carry most of the matching
 * logic).
 */
export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return 0;
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
