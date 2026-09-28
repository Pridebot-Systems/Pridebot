/**
 * Total commits on a repository's default branch.
 *
 * V1 paged through the entire history 100 commits at a time and stopped when a
 * page had length 0. A GitHub error (bad token, rate limit) returns an object with
 * no `length`, so the loop never ended — it kept fetching forever, and every
 * /stats call or GitHub webhook started another one. This makes one request with
 * per_page=1: the "last" page number in the Link header IS the commit count.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

async function getTotalCommits(repoOwner, repoName, githubToken) {
  const key = `${repoOwner}/${repoName}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.count;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(repoOwner)}/${encodeURIComponent(repoName)}/commits?per_page=1`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
        },
      }
    );
    if (!response.ok) {
      console.warn(`[GITHUB] Commit count for ${key} failed: HTTP ${response.status}`);
      return hit?.count ?? 0;
    }

    const last = response.headers.get("link")?.match(/[?&]page=(\d+)>;\s*rel="last"/);
    const count = last ? Number(last[1]) : (await response.json()).length || 0;
    cache.set(key, { count, at: Date.now() });
    return count;
  } catch (err) {
    console.warn(`[GITHUB] Commit count for ${key} failed:`, err.message);
    return hit?.count ?? 0;
  }
}

module.exports = { getTotalCommits };
