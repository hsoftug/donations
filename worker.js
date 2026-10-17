/**
 * MunoWatch API Proxy Worker
 *
 * Routes:
 *   GET  /dashboard              → dashboard sections + movies
 *   GET  /search?q=<query>       → search results (grouped by series when possible)
 *   GET  /series                 → all series grouped by series_code
 *   GET  /series/{code}          → all episodes for a series_code
 *   GET  /movie/{id}             → full movie/episode metadata
 *   GET  /movie/{id}/play        → 302 redirect to playingurl
 *
 * Auth: forces uid=3 on all /api/download calls (subscriber bypass)
 * Token: auto-refreshes the JWT when it expires
 */

const BASE_URL   = "https://munoapi.com/api";
const DOWNLOAD   = "https://munowatch.org/api/download";
const USER_ID    = "1361323";
const FORCED_UID = "3";
const USER_AGENT = "Android IOS v3.0";

// Hardcoded API key (leaked token from Cloudflare Worker source)
let API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkFuZHJvaWQgVFYiLCJhcHBuYW1lIjoiTXVub3dhdGNoIFRWIiwiaG9zdCI6Im11bm93eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Ik11bm9XYXRjaCIsImFwcG5hbWUiOiJNdW5vV2F0Y2giLCJob3N0IjoibXVub3dhdGNoLm9yZyIsImFwcHNlY3JldCI6IjE2NTU5NDUzZGYzOTcyZWM4NjA4MmViNDdmMWY2ZTFiIiwiYWN0aXZhdGVkIjoiMSIsImV4cCI6MTcxNTgzMjAwMH0.fY0_HiHkWXJE1ENUakr9MIzYCHf0Xi9kZCBPTpbLrEY";

// Cache the session token (5 min lifetime)
let SESSION = { token: null, expiresAt: 0 };

// ---------- Auth ----------
async function getToken() {
  const now = Date.now();
  if (SESSION.token && now < SESSION.expiresAt - 30_000) {
    return SESSION.token;
  }

  const rand = Math.floor(Math.random() * 900000) + 100000;
  const body = new URLSearchParams({
    oauth_uid:      `u_auto_${rand}`,
    oauth_provider: "google",
    first_name:     "Auto",
    last_name:      "User",
    email:          `auto${rand}@mailinator.com`,
    version:        "4.6",
    device_info:    "Android",
  });

  const resp = await fetch(`${BASE_URL}/v2/auth/firebase`, {
    method: "POST",
    headers: {
      "X-Api-Key":   API_KEY,
      "User-Agent":  USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`auth failed: ${resp.status} - ${errText}`);
  }

  const data = await resp.json();
  if (!data.access_token) {
    throw new Error(`auth failed: ${JSON.stringify(data)}`);
  }

  SESSION.token = data.access_token;
  SESSION.expiresAt = now + 4 * 60 * 1000; // 4 min — refresh before expiry
  return SESSION.token;
}

// ---------- Helpers ----------
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "Content-Type":  "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function errorResponse(message, status = 500) {
  return jsonResponse({ error: message }, status);
}

// ---------- MunoWatch API calls ----------
async function fetchDashboard() {
  const token = await getToken();
  const resp = await fetch(`${BASE_URL}/protected/dashboard/${USER_ID}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "X-Api-Key":     API_KEY,
      "User-Agent":    USER_AGENT,
    },
  });
  if (!resp.ok) throw new Error(`dashboard failed: ${resp.status}`);
  return await resp.json();
}

async function fetchSearch(query) {
  const token = await getToken();
  const enc = encodeURIComponent(query);
  const resp = await fetch(`${BASE_URL}/protected/search/${enc}/${USER_ID}/0`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "X-Api-Key":     API_KEY,
      "User-Agent":    USER_AGENT,
    },
  });
  if (!resp.ok) throw new Error(`search failed: ${resp.status}`);
  return await resp.json();
}

async function fetchDownloadUrl(vid) {
  const token = await getToken();
  const body = `uid=${FORCED_UID}&vid=${encodeURIComponent(vid)}&state=on`;
  const resp = await fetch(DOWNLOAD, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "X-Api-Key":     API_KEY,
      "User-Agent":    USER_AGENT,
      "Content-Type":  "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!resp.ok) throw new Error(`download failed: ${resp.status}`);
  const text = await resp.text();
  try { return JSON.parse(text); } catch { return null; }
}

// ---------- Series grouping ----------
// Enrich search results (which lack series_code) by fetching each full record.
// For /series we scan a configurable ID range and group by series_code.
async function enrichWithSeriesCode(items, max = 50) {
  const slice = items.slice(0, max);
  const results = [];

  // Parallel fetch (bounded)
  const CHUNK = 10;
  for (let i = 0; i < slice.length; i += CHUNK) {
    const chunk = slice.slice(i, i + CHUNK);
    const records = await Promise.all(
      chunk.map(async (item) => {
        try {
          const dl = await fetchDownloadUrl(item.id);
          if (!dl) return null;
          return {
            id:          dl.id,
            title:       dl.title,
            series_code: dl.series_code,
            type:        (dl.series_code === dl.id) ? "MOVIE" : "SERIES",
            category_id: dl.category_id,
            image:       dl.image,
            size:        dl.size,
            vj:          dl.vj,
            playingurl:  dl.playingurl,
          };
        } catch {
          return null;
        }
      })
    );
    results.push(...records.filter(Boolean));
  }
  return results;
}

// ---------- Routes ----------

// GET /dashboard
async function handleDashboard() {
  try {
    const data = await fetchDashboard();
    // Flatten to a list of unique movies
    const seen = new Set();
    const movies = [];
    for (const cat of data) {
      for (const m of cat.movies) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          movies.push(m);
        }
      }
    }
    return jsonResponse({
      sections: data.map((c) => ({
        id:       c.id,
        category: c.category,
        count:    c.movies.length,
      })),
      unique_movies: movies.length,
      movies,
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

// GET /search?q=...
async function handleSearch(url) {
  const q = url.searchParams.get("q");
  if (!q) return errorResponse("missing ?q=", 400);

  try {
    const results = await fetchSearch(q);
    if (!Array.isArray(results)) return jsonResponse(results);

    // Enrich with series_code (bounded to keep latency low)
    const enriched = await enrichWithSeriesCode(results, 30);

    // Group series together
    const seriesMap = new Map();
    const movies = [];
    for (const r of enriched) {
      if (r.type === "SERIES") {
        if (!seriesMap.has(r.series_code)) {
          seriesMap.set(r.series_code, {
            series_code: r.series_code,
            title:       r.title,
            episodes:    [],
          });
        }
        seriesMap.get(r.series_code).episodes.push(r);
      } else {
        movies.push(r);
      }
    }

    return jsonResponse({
      query:       q,
      total:       enriched.length,
      movies,
      series:      Array.from(seriesMap.values()),
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

// GET /series?start=<id>&end=<id>
// Scans an ID range and groups series_code → episodes.
// Keep ranges small (<= 2000) to stay within Worker CPU limits.
async function handleSeriesList(url) {
  const start = parseInt(url.searchParams.get("start") || "39000", 10);
  const end   = parseInt(url.searchParams.get("end")   || "40100", 10);

  if (end - start > 2000) {
    return errorResponse("range too large (max 2000)", 400);
  }

  try {
    const ids = [];
    for (let i = start; i <= end; i++) ids.push(i);

    const records = [];
    const CHUNK = 10;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const batch = await Promise.all(
        chunk.map(async (vid) => {
          try {
            const dl = await fetchDownloadUrl(vid);
            if (!dl) return null;
            if (dl.series_code === dl.id) return null; // skip movies
            return {
              id:          dl.id,
              title:       dl.title,
              series_code: dl.series_code,
              image:       dl.image,
              playingurl:  dl.playingurl,
            };
          } catch {
            return null;
          }
        })
      );
      records.push(...batch.filter(Boolean));
    }

    // Group by series_code
    const grouped = {};
    for (const r of records) {
      if (!grouped[r.series_code]) grouped[r.series_code] = [];
      grouped[r.series_code].push(r);
    }

    return jsonResponse({
      range:  { start, end },
      found:  records.length,
      series: grouped,
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

// GET /series/{code}
// Uses seed movie lookup and search episode hunting logic to find all episodes
async function handleSeriesByCode(url, code) {
  try {
    const token = await getToken();
    
    // Treat `code` as a seed video ID to get the series_code and baseName
    let seedDl = null;
    try {
      seedDl = await fetchDownloadUrl(code);
    } catch {}

    let seriesCode = code;
    let baseName = "";

    if (seedDl && seedDl.series_code) {
      seriesCode = seedDl.series_code;
      baseName = (seedDl.title || "")
        .replace(/\s+Season\s+\d+.*$/, "")
        .replace(/\s+S\d+E\d+.*$/, "")
        .replace(/\s+Episode\s+\d+.*$/, "")
        .replace(/\s+\d+$/, "")
        .trim();
    }

    const verified = [];
    const seenIds = {};

    // If we have a baseName, search episode numbers 1 to 25
    if (baseName) {
      for (let ep = 1; ep <= 25; ep++) {
        const queries = [
          `${baseName} ${ep}`,
          `${baseName} Season 1 Episode ${ep}`,
          `${baseName} Season 1: Episode ${ep}`
        ];
        for (const q of queries) {
          const enc = encodeURIComponent(q);
          try {
            const searchResp = await fetch(`${BASE_URL}/protected/search/${enc}/${USER_ID}/0`, {
              headers: {
                "Authorization": `Bearer ${token}`,
                "X-Api-Key":     API_KEY,
                "User-Agent":    USER_AGENT,
              },
            });
            if (!searchResp.ok) continue;
            const items = await searchResp.json();
            if (!Array.isArray(items)) continue;

            for (const item of items) {
              if (seenIds[item.id]) continue;
              seenIds[item.id] = true;
              try {
                const dl = await fetchDownloadUrl(item.id);
                if (dl && String(dl.series_code) === String(seriesCode)) {
                  verified.push({
                    id:          dl.id,
                    title:       dl.title,
                    series_code: dl.series_code,
                    image:       dl.image,
                    size:        dl.size,
                    playingurl:  dl.playingurl,
                  });
                }
              } catch {}
            }
          } catch {}
        }
      }
    }

    // Fallback or additional sweep using range around code if needed
    if (verified.length === 0) {
      const center = parseInt(code, 10) || 39409;
      const start = Math.max(1, center - 100);
      const end = center + 100;
      const ids = [];
      for (let i = start; i <= end; i++) ids.push(i);

      const CHUNK = 10;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const batch = await Promise.all(
          chunk.map(async (vid) => {
            try {
              const dl = await fetchDownloadUrl(vid);
              if (!dl) return null;
              if (String(dl.series_code) !== String(seriesCode)) return null;
              return {
                id:          dl.id,
                title:       dl.title,
                series_code: dl.series_code,
                image:       dl.image,
                size:        dl.size,
                playingurl:  dl.playingurl,
              };
            } catch {
              return null;
            }
          })
        );
        for (const b of batch.filter(Boolean)) {
          if (!seenIds[b.id]) {
            seenIds[b.id] = true;
            verified.push(b);
          }
        }
      }
    }

    verified.sort((a, b) => a.id - b.id);

    return jsonResponse({
      series_code: seriesCode,
      base_name:   baseName,
      count:       verified.length,
      episodes:    verified,
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

// GET /movie/{id}
async function handleMovie(id) {
  try {
    const dl = await fetchDownloadUrl(id);
    if (!dl) return errorResponse("not found", 404);
    return jsonResponse({
      ...dl,
      is_series: dl.series_code !== dl.id,
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

// GET /movie/{id}/play
async function handlePlay(id) {
  try {
    const dl = await fetchDownloadUrl(id);
    if (!dl || !dl.playingurl) {
      return errorResponse("no playingurl available", 404);
    }
    return Response.redirect(dl.playingurl, 302);
  } catch (e) {
    return errorResponse(e.message);
  }
}

// ---------- Main fetch handler ----------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin":  "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    if (path === "/dashboard" || path === "/dashboard/") {
      return handleDashboard();
    }

    if (path === "/search" || path === "/search/") {
      return handleSearch(url);
    }

    if (path === "/series" || path === "/series/") {
      return handleSeriesList(url);
    }

    const seriesMatch = /^\/series\/([^\/]+)\/?$/.exec(path);
    if (seriesMatch) {
      return handleSeriesByCode(url, seriesMatch[1]);
    }

    const movieMatch = /^\/movie\/(\d+)\/?$/.exec(path);
    if (movieMatch) {
      return handleMovie(movieMatch[1]);
    }

    const playMatch = /^\/movie\/(\d+)\/play\/?$/.exec(path);
    if (playMatch) {
      return handlePlay(playMatch[1]);
    }

    return errorResponse("not found", 404);
  },
};
