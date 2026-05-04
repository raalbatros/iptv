const CONFIG = {
  USERNAME: "raalbatros",
  PASSWORD: "1111",
  SOURCES: {
    LIVE: "https://raw.githubusercontent.com/raalbatros/iptv/refs/heads/main/canlitv.m3u",
    MOVIES_DS: "https://raw.githubusercontent.com/raalbatros/iptv/refs/heads/main/ds.m3u",
    MOVIES_TAVSIYE: "https://raw.githubusercontent.com/raalbatros/iptv/refs/heads/main/tavsiye.m3u",
    MOVIES_ARSIV: "https://raw.githubusercontent.com/raalbatros/movie/refs/heads/main/filmler/films.m3u",
    SERIES: "https://raw.githubusercontent.com/raalbatros/series/main/series.json"
  },
  EPG_SOURCES: [
    "https://www.open-epg.com/files/turkey1.xml",
    "https://www.open-epg.com/files/turkey2.xml",
    "https://www.open-epg.com/files/turkey3.xml",
    "https://www.open-epg.com/files/germany1.xml"
  ],
  CACHE_TTL: {
    LIVE: 300,    // 5 dakika
    MOVIES: 3600, // 1 saat
    SERIES: 3600  // 1 saat
  }
};

// ================= CACHE YARDIMCISI =================

async function fetchWithCache(url, ttl, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(url + "?cf_cache");
  try {
    const cached = await cache.match(cacheKey);
    if (cached) return await cached.text();
  } catch(e) {}

  const text = await fetch(url).then(r => r.text());
  ctx.waitUntil(cache.put(cacheKey, new Response(text, {
    headers: { "Cache-Control": `public, max-age=${ttl}` }
  })));
  return text;
}

async function fetchJsonWithCache(url, ttl, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(url + "?cf_cache");
  try {
    const cached = await cache.match(cacheKey);
    if (cached) return await cached.json();
  } catch(e) {}

  const data = await fetch(url).then(r => r.json());
  ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(data), {
    headers: { "Cache-Control": `public, max-age=${ttl}` }
  })));
  return data;
}

// ================= ANA HANDLER =================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const params = url.searchParams;
    const user = params.get("username");
    const pass = params.get("password");

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "*"
        }
      });
    }

    // DEBUG
    if (url.pathname === "/debug/live") {
      try {
        const text = await fetch(CONFIG.SOURCES.LIVE).then(r => r.text());
        return new Response(text.split("\n").slice(0, 30).join("\n"), {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Access-Control-Allow-Origin": "*" }
        });
      } catch(e) {
        return new Response("Hata: " + e.message, { status: 500 });
      }
    }

    if (url.pathname === "/debug/streams") {
      try {
        const text = await fetch(CONFIG.SOURCES.LIVE).then(r => r.text());
        const streams = parseLiveM3U(text, "1", url.origin);
        return new Response(JSON.stringify({ count: streams.length, first5: streams.slice(0, 5) }, null, 2), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch(e) {
        return new Response("Hata: " + e.message, { status: 500 });
      }
    }

    // EPG
    if (url.pathname === "/xmltv.xml" || url.pathname === "/epg.xml") {
      for (const epgUrl of CONFIG.EPG_SOURCES) {
        try {
          const res = await fetch(epgUrl);
          if (res.ok) {
            return new Response(await res.text(), {
              headers: {
                "Content-Type": "application/xml",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=7200"
              }
            });
          }
        } catch(e) { continue; }
      }
      return new Response('<?xml version="1.0" encoding="UTF-8"?><tv generator-info-name="IPTV"></tv>', {
        headers: { "Content-Type": "application/xml" }
      });
    }

    // STREAM YÖNLENDİRME (cache'li)
    if (url.pathname.startsWith("/live/")) {
      const pathParts = url.pathname.split("/");
      let streamId = parseInt(pathParts[pathParts.length - 1].split(".")[0]);
      if (isNaN(streamId)) streamId = 1;

      try {
        const m3uText = await fetchWithCache(CONFIG.SOURCES.LIVE, CONFIG.CACHE_TTL.LIVE, ctx);
        const targetUrl = extractLiveUrlByIndex(m3uText, streamId);
        if (!targetUrl) return new Response("Stream not found", { status: 404 });
        return Response.redirect(targetUrl, 302);
      } catch(e) {
        return new Response("Stream error: " + e.message, { status: 502 });
      }
    }

    if (url.pathname.startsWith("/movie/")) {
      const pathParts = url.pathname.split("/");
      let streamId = parseInt(pathParts[pathParts.length - 1].split(".")[0]);
      if (isNaN(streamId)) streamId = 1;

      try {
        const [dsText, tavsiyeText, arsivText] = await Promise.all([
          fetchWithCache(CONFIG.SOURCES.MOVIES_DS, CONFIG.CACHE_TTL.MOVIES, ctx),
          fetchWithCache(CONFIG.SOURCES.MOVIES_TAVSIYE, CONFIG.CACHE_TTL.MOVIES, ctx),
          fetchWithCache(CONFIG.SOURCES.MOVIES_ARSIV, CONFIG.CACHE_TTL.MOVIES, ctx)
        ]);
        const combined = `${dsText}\n${tavsiyeText}\n${arsivText}`;
        const targetUrl = extractMovieUrlByIndex(combined, streamId);
        if (!targetUrl) return new Response("Stream not found", { status: 404 });
        return Response.redirect(targetUrl, 302);
      } catch(e) {
        return new Response("Movie error: " + e.message, { status: 502 });
      }
    }

    // KİMLİK DOĞRULAMA
    if (user !== CONFIG.USERNAME || pass !== CONFIG.PASSWORD) {
      return jsonResponse({ user_info: { auth: 0 } });
    }

    const action = params.get("action");

    // KATEGORİLER
    if (action === "get_live_categories") {
      return jsonResponse([
        { category_id: "1", category_name: "📺 Canlı TV", parent_id: 0 }
      ]);
    }

    if (action === "get_vod_categories") {
      const sabitKategoriler = [
        { category_id: "98", category_name: "📺 Dizi Son Bölümleri", parent_id: 0 },
        { category_id: "99", category_name: "⭐ Tavsiye Edilenler", parent_id: 0 }
      ];
      const arsivM3u = await fetchWithCache(CONFIG.SOURCES.MOVIES_ARSIV, CONFIG.CACHE_TTL.MOVIES, ctx);
      const arsivKategorileri = extractMovieCategoriesFromText(arsivM3u, 100);
      return jsonResponse([...sabitKategoriler, ...arsivKategorileri]);
    }

    if (action === "get_series_categories") {
      return jsonResponse([
        { category_id: "10", category_name: "📺 Diziler", parent_id: 0 }
      ]);
    }

    // YAYIN LİSTELERİ
    if (action === "get_live_streams") {
      const m3uText = await fetchWithCache(CONFIG.SOURCES.LIVE, CONFIG.CACHE_TTL.LIVE, ctx);
      const streams = parseLiveM3U(m3uText, "1", url.origin);
      return jsonResponse(streams);
    }

    if (action === "get_vod_streams") {
      const [dsText, tavsiyeText, arsivText] = await Promise.all([
        fetchWithCache(CONFIG.SOURCES.MOVIES_DS, CONFIG.CACHE_TTL.MOVIES, ctx),
        fetchWithCache(CONFIG.SOURCES.MOVIES_TAVSIYE, CONFIG.CACHE_TTL.MOVIES, ctx),
        fetchWithCache(CONFIG.SOURCES.MOVIES_ARSIV, CONFIG.CACHE_TTL.MOVIES, ctx)
      ]);
      const dsStreams = parseSimpleM3U(dsText, "98", url.origin, 0);
      const tavsiyeStreams = parseSimpleM3U(tavsiyeText, "99", url.origin, dsStreams.length);
      const arsivKategoriHaritasi = extractMovieCategoryMapFromText(arsivText, 100);
      const arsivStreams = parseMovieM3UWithMap(arsivText, url.origin, arsivKategoriHaritasi, dsStreams.length + tavsiyeStreams.length);
      return jsonResponse([...dsStreams, ...tavsiyeStreams, ...arsivStreams]);
    }

    // DİZİLER
    if (action === "get_series") {
      try {
        const data = await fetchJsonWithCache(CONFIG.SOURCES.SERIES, CONFIG.CACHE_TTL.SERIES, ctx);
        let out = [];
        let id = 1;
        for (const d of data) {
          out.push({
            series_id: id++,
            name: d.name,
            cover: d.cover || "",
            series_cover: d.cover || "",
            plot: "",
            rating: "8",
            category_id: "10"
          });
        }
        return jsonResponse(out);
      } catch(e) {
        return jsonResponse([]);
      }
    }

    if (action === "get_series_info") {
      try {
        const sid = parseInt(params.get("series_id")) - 1;
        const data = await fetchJsonWithCache(CONFIG.SOURCES.SERIES, CONFIG.CACHE_TTL.SERIES, ctx);
        const d = data[sid];
        if (!d) return jsonResponse({ info: {}, seasons: [], episodes: {} });
        let seasons = [];
        let episodes = {};
        let eid = 1000;
        for (const s of d.seasons) {
          seasons.push({
            season_number: s.season,
            name: s.season + ". Sezon",
            episode_count: s.episodes.length,
            cover: d.cover || ""
          });
          episodes[s.season] = [];
          let epNum = 1;
          for (const e of s.episodes) {
            episodes[s.season].push({
              id: String(eid++),
              episode_num: epNum++,
              title: e.title,
              container_extension: "mp4",
              custom_sid: String(s.season),
              direct_source: e.url,
              stream_url: e.url
            });
          }
        }
        return jsonResponse({
          info: { name: d.name, cover: d.cover || "", plot: "", rating: "8" },
          seasons,
          episodes
        });
      } catch(e) {
        return jsonResponse({ info: {}, seasons: [], episodes: {} });
      }
    }

    if (action === "get_short_epg") {
      const streamId = params.get("stream_id");
      for (const epgUrl of CONFIG.EPG_SOURCES) {
        try {
          const epgData = await fetch(epgUrl).then(r => r.text());
          const shortEpg = extractShortEPG(epgData, streamId);
          if (shortEpg && shortEpg.length > 0) return jsonResponse(shortEpg);
        } catch(e) { continue; }
      }
      return jsonResponse([]);
    }

    if (action === "get_simple_data_table") {
      return jsonResponse({
        epg_url: `${url.origin}/xmltv.xml`,
        tv_archive: 0,
        tv_archive_duration: 0
      });
    }

    if (!action) {
      return jsonResponse({
        user_info: {
          auth: 1,
          status: "Active",
          exp_date: "1893456000",
          username: CONFIG.USERNAME,
          password: CONFIG.PASSWORD,
          is_trial: "0",
          active_cons: "0",
          created_at: "1609459200",
          max_connections: "1",
          allowed_output_formats: ["m3u8", "ts", "rtmp"]
        },
        server_info: {
          url: url.hostname,
          port: "80",
          https_port: "443",
          server_protocol: "https",
          rtmp_port: "1935",
          timezone: "Europe/Istanbul",
          timestamp_now: Math.floor(Date.now() / 1000),
          time_now: new Date().toISOString()
        }
      });
    }

    return jsonResponse([]);
  }
};

// ================= YARDIMCI FONKSİYONLAR =================

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

function parseLiveM3U(m3uText, categoryId, baseUrlOrigin) {
  const lines = m3uText.split("\n");
  const result = [];
  let streamId = 1;
  let currentName = "";
  let currentLogo = "";
  let currentEpgId = "";

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed.startsWith("#EXTINF:")) {
      const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/);
      currentLogo = logoMatch ? logoMatch[1] : "";
      const epgMatch = trimmed.match(/tvg-id="([^"]+)"/);
      currentEpgId = epgMatch ? epgMatch[1] : "";
      const nameMatch = trimmed.match(/,(.+)$/);
      currentName = nameMatch ? nameMatch[1].trim() : `Kanal ${streamId}`;
      continue;
    }

    if (trimmed.startsWith("#") || !trimmed) continue;

    if (trimmed.match(/^(https?|rtmp|rtsp|udp|rtp):\/\//i)) {
      result.push({
        stream_id: streamId,
        num: streamId,
        name: currentName || `Kanal ${streamId}`,
        stream_type: "live",
        type: "live",
        category_id: categoryId,
        stream_icon: currentLogo,
        thumbnail: currentLogo,
        epg_channel_id: currentEpgId,
        stream_url: `${baseUrlOrigin}/live/${CONFIG.USERNAME}/${CONFIG.PASSWORD}/${streamId}.ts`,
        direct_source: trimmed,
        container_extension: "ts",
        tv_archive: 0,
        tv_archive_duration: 0,
        is_adult: "0",
        added: Math.floor(Date.now() / 1000).toString()
      });
      streamId++;
      currentName = "";
      currentLogo = "";
      currentEpgId = "";
    }
  }
  return result;
}

function extractLiveUrlByIndex(m3uText, index) {
  const lines = m3uText.split("\n");
  let currentId = 1;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.match(/^(https?|rtmp|rtsp|udp|rtp):\/\//i)) {
      if (currentId === index) return trimmed;
      currentId++;
    }
  }
  return null;
}

function extractMovieUrlByIndex(m3uText, index) {
  const lines = m3uText.split("\n");
  let currentId = 1;
  let pendingInfo = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#EXTINF:")) { pendingInfo = true; continue; }
    if (trimmed.startsWith("#") || !trimmed) continue;
    if (pendingInfo && trimmed.match(/^https?:\/\//i)) {
      if (currentId === index) return trimmed;
      currentId++;
      pendingInfo = false;
    } else {
      pendingInfo = false;
    }
  }
  return null;
}

function extractShortEPG(epgXml, channelId) {
  const programmes = [];
  const regex = /<programme[^>]*channel="([^"]+)"[^>]*start="([^"]+)"[^>]*stop="([^"]+)"[^>]*>[\s\S]*?<title[^>]*>([^<]+)<\/title>/gi;
  let match;
  while ((match = regex.exec(epgXml)) !== null && programmes.length < 5) {
    if (match[1] === channelId) {
      programmes.push({
        channel_id: match[1],
        start: match[2],
        end: match[3],
        title: match[4],
        description: "",
        genre: "",
        genre_id: ""
      });
    }
  }
  return programmes;
}

function extractMovieCategoriesFromText(m3uText, startId) {
  const lines = m3uText.split("\n");
  const categorySet = new Set();
  const categories = [];
  let currentId = startId;
  for (const line of lines) {
    if (line.startsWith("#EXTINF:")) {
      const groupMatch = line.match(/group-title="([^"]+)"/);
      if (groupMatch && !categorySet.has(groupMatch[1])) {
        categorySet.add(groupMatch[1]);
        let displayName = groupMatch[1];
        if (groupMatch[1] === "Vizyondakiler") displayName = "🆕 " + groupMatch[1];
        else if (groupMatch[1] === "Yerli Filmler") displayName = "🇹🇷 " + groupMatch[1];
        categories.push({ category_id: (currentId++).toString(), category_name: displayName, parent_id: 0 });
      }
    }
  }
  categories.sort((a, b) => {
    if (a.category_name.includes("Vizyondakiler")) return -1;
    if (b.category_name.includes("Vizyondakiler")) return 1;
    return a.category_name.localeCompare(b.category_name);
  });
  return categories;
}

function extractMovieCategoryMapFromText(m3uText, startId) {
  const lines = m3uText.split("\n");
  const categoryMap = new Map();
  let currentId = startId;
  for (const line of lines) {
    if (line.startsWith("#EXTINF:")) {
      const groupMatch = line.match(/group-title="([^"]+)"/);
      if (groupMatch && !categoryMap.has(groupMatch[1])) {
        categoryMap.set(groupMatch[1], (currentId++).toString());
      }
    }
  }
  return categoryMap;
}

function parseSimpleM3U(m3uText, categoryId, baseUrlOrigin, idOffset = 0) {
  const lines = m3uText.split("\n");
  const result = [];
  let localId = 1;
  let currentName = "";
  let currentLogo = "";
  let pendingInfo = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#EXTINF:")) {
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      currentLogo = logoMatch ? logoMatch[1] : "";
      const nameMatch = line.match(/,(.+)$/);
      currentName = nameMatch ? nameMatch[1].trim() : `İçerik ${localId}`;
      pendingInfo = true;
      continue;
    }
    if (line.startsWith("#") || !line) continue;
    if (pendingInfo && line.match(/^https?:\/\//i)) {
      const globalId = idOffset + localId;
      result.push({
        stream_id: globalId,
        num: globalId,
        name: currentName,
        stream_type: "movie",
        category_id: categoryId,
        stream_icon: currentLogo,
        rating_5based: "0",
        stream_url: `${baseUrlOrigin}/movie/${CONFIG.USERNAME}/${CONFIG.PASSWORD}/${globalId}.mp4`,
        direct_source: line,
        container_extension: "mp4",
        added: Math.floor(Date.now() / 1000).toString(),
        genre: "", plot: "", cast: "", director: "", youtube_trailer: "", releasedate: "", backdrop_path: []
      });
      localId++;
      currentName = ""; currentLogo = ""; pendingInfo = false;
    } else {
      pendingInfo = false;
    }
  }
  return result;
}

function parseMovieM3UWithMap(m3uText, baseUrlOrigin, categoryMap, idOffset = 0) {
  const lines = m3uText.split("\n");
  const result = [];
  let streamId = 1;
  let currentName = "", currentLogo = "", currentGroup = "", currentRating = "0";
  let pendingInfo = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#EXTINF:")) {
      const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/);
      currentLogo = logoMatch ? logoMatch[1] : "";
      const groupMatch = trimmed.match(/group-title="([^"]+)"/);
      currentGroup = groupMatch ? groupMatch[1] : "Filmler";
      const ratingMatch = trimmed.match(/⭐\s*([\d.]+)/);
      currentRating = ratingMatch ? ratingMatch[1] : "0";
      const nameMatch = trimmed.match(/,\s*(.+)$/);
      currentName = nameMatch ? nameMatch[1].trim() : `Film ${streamId}`;
      currentName = currentName.replace(/⭐\s*[\d.]+/, '').trim();
      pendingInfo = true;
      continue;
    }
    if (trimmed.startsWith("#") || !trimmed) continue;
    if (pendingInfo && trimmed.match(/^https?:\/\//i)) {
      const categoryId = categoryMap.get(currentGroup) || "2";
      const globalId = idOffset + streamId;
      result.push({
        stream_id: globalId,
        num: globalId,
        name: currentName,
        stream_type: "movie",
        category_id: categoryId,
        stream_icon: currentLogo,
        rating_5based: currentRating,
        stream_url: `${baseUrlOrigin}/movie/${CONFIG.USERNAME}/${CONFIG.PASSWORD}/${globalId}.mp4`,
        direct_source: trimmed,
        container_extension: "mp4",
        added: Math.floor(Date.now() / 1000).toString(),
        genre: currentGroup, plot: "", cast: "", director: "", youtube_trailer: "", releasedate: "", backdrop_path: []
      });
      streamId++;
      currentName = ""; currentLogo = ""; currentGroup = ""; currentRating = "0"; pendingInfo = false;
    } else {
      pendingInfo = false;
    }
  }
  const vizyonCategoryId = Array.from(categoryMap.entries()).find(([key]) => key === "Vizyondakiler")?.[1];
  if (vizyonCategoryId) {
    const vizyonIndexes = [], vizyonStreams = [];
    for (let i = 0; i < result.length; i++) {
      if (result[i].category_id === vizyonCategoryId) {
        vizyonIndexes.push(i);
        vizyonStreams.push(result[i]);
      }
    }
    vizyonStreams.sort((a, b) => parseFloat(b.rating_5based) - parseFloat(a.rating_5based));
    for (let j = 0; j < vizyonIndexes.length; j++) result[vizyonIndexes[j]] = vizyonStreams[j];
  }
  return result;
}
