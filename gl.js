// ============================================================
// Geil.to HLS Worker - Tam Sürüm
// Kullanım:
//   /catalog
//   /play/<kanal-id>       -> JSON
//   /direct/<kanal-id>     -> 302 yönlendirme (M3U için)
//   /hls-proxy?url=<url>   -> domain tabanlı HLS proxy
// ============================================================

const ORIGIN = "https://geil.to";
const CATALOG_URL = `${ORIGIN}/live/catalog/live/channels.json`;
const LANGUAGE = "tr";

const ALLOWED_EXTENSIONS = new Set([
  ".m3u8",
  ".ts",
  ".aac",
  ".mp3",
  ".m4s",
  ".mp4",
  ".m4a",
  ".key",
  ".vtt",
  ".webvtt"
]);

function failure(message, status = 502) {
  return Object.assign(new Error(message), { status });
}

function channelId(value) {
  const id = String(value ?? "");

  if (!/^\d{1,20}$/.test(id)) {
    throw failure("Geçersiz Geil kanal kimliği", 400);
  }

  return id;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range, If-Range, User-Agent",
    "Access-Control-Expose-Headers":
      "Content-Length, Content-Range, Content-Type, Accept-Ranges, ETag, Last-Modified"
  };
}

function jsonHeaders(status = 200) {
  return {
    ...corsHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache, no-store, must-revalidate"
  };
}

function errorResponse(error) {
  const status = Number.isInteger(error?.status) ? error.status : 502;
  const message = error?.message || "Bilinmeyen hata";

  console.log("[geil] Hata:", status, message);

  return new Response(
    JSON.stringify({
      error: message,
      status
    }),
    {
      status,
      headers: jsonHeaders(status)
    }
  );
}

async function requestJson(url, extraHeaders = {}) {
  let response;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "tr,tr;q=0.9,en;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Origin: ORIGIN,
          Referer: `${ORIGIN}/`,
          "X-Requested-With": "XMLHttpRequest",
          ...extraHeaders
        },
        redirect: "follow",
        signal: AbortSignal.timeout(20000)
      });

      if (response.status < 500 || attempt === 2) {
        break;
      }

      await response.body?.cancel();
    } catch (error) {
      console.log(
        `[geil] requestJson fetch hatası (${attempt + 1}/3):`,
        error?.message || error
      );

      if (attempt === 2) {
        throw failure("Geil bağlantısı kurulamadı");
      }
    }

    await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
  }

  if (!response) {
    throw failure("Geil bağlantısı kurulamadı");
  }

  const text = await response.text();

  if (!response.ok) {
    console.log(
      `[geil] requestJson HTTP ${response.status}:`,
      text.slice(0, 1000)
    );

    throw failure(
      `Geil HTTP ${response.status}`,
      response.status >= 400 && response.status < 500 ? response.status : 502
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    console.log("[geil] Geçersiz JSON yanıtı:", text.slice(0, 1000));
    throw failure("Geil JSON yanıtı geçersiz");
  }
}

function epochSeconds(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value
    )
  ) {
    return NaN;
  }

  const timestamp = Date.parse(value);
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);

  if (
    !Number.isFinite(timestamp) ||
    !Number.isFinite(day.getTime()) ||
    day.toISOString().slice(0, 10) !== value.slice(0, 10)
  ) {
    return NaN;
  }

  return timestamp / 1000;
}

function normalizeChannel(item) {
  if (!item || typeof item.name !== "string" || !item.name.trim()) {
    throw failure("Geil kanal verisi geçersiz");
  }

  const id = channelId(item.id);
  const epg = [];

  for (const programme of Array.isArray(item.epg) ? item.epg : []) {
    if (!programme || typeof programme.title !== "string" || !programme.title.trim()) {
      continue;
    }

    const start = epochSeconds(programme.start);
    const stop = epochSeconds(programme.end);

    if (Number.isFinite(start) && Number.isFinite(stop) && stop > start) {
      epg.push({
        name: programme.title,
        start,
        stop
      });
    }
  }

  let logo = "";

  if (typeof item?.images?.logo === "string" && item.images.logo.trim()) {
    logo = item.images.logo.startsWith("http")
      ? item.images.logo
      : `${ORIGIN}${item.images.logo}`;
  } else if (typeof item?.logo === "string" && item.logo.trim()) {
    logo = item.logo.startsWith("http")
      ? item.logo
      : `${ORIGIN}${item.logo}`;
  }

  return {
    name: item.name.trim(),
    url: `${ORIGIN}/live/play/${id}`,
    worker: {
      json: `/play/${id}`,
      direct: `/direct/${id}`
    },
    ids: {
      ...(item.ids || {}),
      id
    },
    logo,
    epg
  };
}

async function fetchChannels() {
  const channels = [];
  const cursors = new Set();
  let cursor;

  for (let page = 0; page < 200; page++) {
    const url = new URL(CATALOG_URL);
    url.searchParams.set("filter[group]", "Turkey");
    url.searchParams.set("sort", "name");

    if (cursor !== undefined) {
      url.searchParams.set("cursor", cursor);
    }

    const data = await requestJson(url);

    if (!data || !Array.isArray(data.items)) {
      throw failure("Geil katalog yanıtı geçersiz");
    }

    channels.push(...data.items.map(normalizeChannel));

    const next = data.nextCursor;

    if (next === null || next === undefined || next === "") {
      if (!channels.length) {
        throw failure("Geil kataloğu boş");
      }

      return channels;
    }

    if (typeof next !== "string" || cursors.has(next)) {
      throw failure("Geil cursor döngüsü veya geçersiz cursor");
    }

    cursors.add(next);
    cursor = next;
  }

  throw failure("Geil katalog sayfa sınırı aşıldı");
}

async function resolveChannel(value) {
  const id = channelId(value);

  const url = new URL(`${ORIGIN}/live/resolve`);
  url.searchParams.set("url", `${ORIGIN}/live/play/${id}`);

  const data = await requestJson(url, {
    Accept: "application/json"
  });

  console.log(
    "[geil] resolve yanıtı:",
    JSON.stringify(data, null, 2).slice(0, 2000)
  );

  let stream;

  try {
    stream = new URL(data?.url);
  } catch {
    throw failure("Geil yayın adresi geçersiz");
  }

  if (
    !["http:", "https:"].includes(stream.protocol) ||
    stream.username ||
    stream.password
  ) {
    throw failure("Geil yayın adresi geçersiz");
  }

  return stream.toString();
}

function isIpHost(url) {
  try {
    const host = new URL(url).hostname;

    return (
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
      host.includes(":")
    );
  } catch {
    return false;
  }
}

function pathExtension(urlString) {
  try {
    const pathname = new URL(urlString).pathname.toLowerCase();
    const dot = pathname.lastIndexOf(".");

    return dot === -1 ? "" : pathname.slice(dot);
  } catch {
    return "";
  }
}

function getStreamHeaders() {
  return {
    "User-Agent": "VAVOO/2.6",
    Accept: "*/*",
    "Accept-Language": LANGUAGE,
    Origin: ORIGIN,
    Referer: `${ORIGIN}/`
  };
}

function getPlaylistHeaders() {
  return {
    "User-Agent": "libmpv",
    Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, */*",
    "Accept-Language": LANGUAGE,
    Origin: ORIGIN,
    Referer: `${ORIGIN}/`
  };
}

function isM3u8Url(url) {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".m3u8");
  } catch {
    return false;
  }
}

function isM3u8Response(url, contentType) {
  const type = String(contentType || "").toLowerCase();

  return (
    type.includes("mpegurl") ||
    type.includes("application/vnd.apple") ||
    isM3u8Url(url)
  );
}

function describeUrl(url) {
  try {
    return new URL(url).host;
  } catch {
    return "[invalid URL]";
  }
}

function getProxiedUrl(baseUrl, upstreamUrl) {
  return `${baseUrl}/hls-proxy?url=${encodeURIComponent(upstreamUrl)}`;
}

function shouldRewriteUri(uri) {
  const trimmed = String(uri || "").trim();

  if (!trimmed) {
    return false;
  }

  return !/^(data|urn|skd):/i.test(trimmed);
}

function rewritePlaylistUri(baseUrl, playlistBase, uri) {
  if (!shouldRewriteUri(uri)) {
    return uri;
  }

  try {
    const absoluteUrl = new URL(uri, playlistBase).toString();

    // IP tabanlı segment/liste adreslerini proxy'lemeye çalışma;
    // Cloudflare 1003 hatası verebilir.
    if (isIpHost(absoluteUrl)) {
      return absoluteUrl;
    }

    return getProxiedUrl(baseUrl, absoluteUrl);
  } catch {
    return uri;
  }
}

function rewritePlaylist(baseUrl, upstreamUrl, playlist) {
  return String(playlist)
    .split(/\r?\n/)
    .map(line => {
      const trimmed = line.trim();

      if (!trimmed) {
        return line;
      }

      if (trimmed.startsWith("#")) {
        return line.replace(
          /URI="([^"]+)"/g,
          (_, uri) => `URI="${rewritePlaylistUri(baseUrl, upstreamUrl, uri)}"`
        );
      }

      return rewritePlaylistUri(baseUrl, upstreamUrl, trimmed);
    })
    .join("\n");
}

async function proxyStream(
  request,
  baseUrl,
  streamUrl,
  retryWithPlaylistHeaders = false
) {
  const rangeHeaders = {};

  for (const name of ["Range", "If-Range"]) {
    const value = request.headers.get(name);

    if (value) {
      rangeHeaders[name] = value;
    }
  }

  let upstreamHeaders = getStreamHeaders();

  let response = await fetch(streamUrl, {
    headers: {
      ...upstreamHeaders,
      ...rangeHeaders
    },
    redirect: "follow"
  });

  if (
    retryWithPlaylistHeaders &&
    (response.status === 403 || response.status === 401)
  ) {
    await response.body?.cancel();

    upstreamHeaders = getPlaylistHeaders();

    response = await fetch(streamUrl, {
      headers: {
        ...upstreamHeaders,
        ...rangeHeaders
      },
      redirect: "follow"
    });
  }

  if (
    response.status === 206 &&
    isM3u8Response(response.url || streamUrl, response.headers.get("content-type"))
  ) {
    await response.body?.cancel();

    response = await fetch(streamUrl, {
      headers: upstreamHeaders,
      redirect: "follow"
    });
  }

  console.log(
    `[geil] proxy ${describeUrl(streamUrl)} -> ${response.status}`
  );

  const headers = new Headers(corsHeaders());

  for (const name of [
    "Content-Type",
    "Content-Length",
    "Content-Range",
    "Accept-Ranges",
    "ETag",
    "Last-Modified",
    "Cache-Control"
  ]) {
    const value = response.headers.get(name);

    if (value !== null) {
      headers.set(name, value);
    }
  }

  const contentType = response.headers.get("content-type") || "";
  const finalUrl = response.url || streamUrl;

  if (response.ok && isM3u8Response(finalUrl, contentType)) {
    if (response.status === 206) {
      await response.body?.cancel();

      return new Response("Yayın sunucusu eksik HLS listesi döndürdü", {
        status: 502,
        headers: corsHeaders()
      });
    }

    const playlist = await response.text();
    const rewritten = rewritePlaylist(baseUrl, finalUrl, playlist);

    for (const name of [
      "Content-Length",
      "Content-Range",
      "Accept-Ranges",
      "ETag",
      "Last-Modified"
    ]) {
      headers.delete(name);
    }

    headers.set("Content-Type", "application/vnd.apple.mpegurl; charset=utf-8");
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");

    return new Response(rewritten, {
      status: response.status,
      headers
    });
  }

  return new Response(response.body, {
    status: response.status,
    headers
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    const url = new URL(request.url);
    const baseUrl = url.origin;
    const path = url.pathname;

    try {
      if (path === "/catalog") {
        const channels = await fetchChannels();

        return new Response(JSON.stringify(channels), {
          status: 200,
          headers: jsonHeaders()
        });
      }

      if (path.startsWith("/direct/")) {
        const channelIdValue = path.slice("/direct/".length);
        const streamUrl = await resolveChannel(channelIdValue);

        return Response.redirect(streamUrl, 302);
      }

      if (path.startsWith("/play/")) {
        const channelIdValue = path.slice("/play/".length);
        const streamUrl = await resolveChannel(channelIdValue);

        // Cloudflare, IP tabanlı adreslere yapılan subrequest'i
        // 1003 Direct IP Access Not Allowed ile reddedebiliyor.
        if (isIpHost(streamUrl)) {
          return new Response(
            JSON.stringify({
              url: streamUrl,
              live: true,
              format: "hls",
              proxy: false
            }),
            {
              status: 200,
              headers: jsonHeaders()
            }
          );
        }

        return await proxyStream(request, baseUrl, streamUrl);
      }

      if (path === "/hls-proxy") {
        const upstreamUrl = url.searchParams.get("url");

        if (!upstreamUrl) {
          throw failure("URL parametresi eksik", 400);
        }

        const parsed = new URL(upstreamUrl);

        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw failure("Desteklenmeyen protokol", 400);
        }

        if (isIpHost(upstreamUrl)) {
          return Response.redirect(upstreamUrl, 302);
        }

        const extension = pathExtension(upstreamUrl);

        if (extension && !ALLOWED_EXTENSIONS.has(extension)) {
          throw failure("Desteklenmeyen dosya türü", 403);
        }

        return await proxyStream(request, baseUrl, upstreamUrl, true);
      }

      return new Response(
        JSON.stringify({
          usage: {
            catalog: "/catalog",
            play: "/play/<kanal-id>",
            direct: "/direct/<kanal-id>",
            hlsProxy: "/hls-proxy?url=<encoded-hls-url>"
          }
        }),
        {
          status: 404,
          headers: jsonHeaders(404)
        }
      );
    } catch (error) {
      return errorResponse(error);
    }
  }
};
