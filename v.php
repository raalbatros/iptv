<?php
/**
 * Vavoo Unified PHP - Resolver + M3U Generator (VLC uyumlu)
 *
 * KULLANIM:
 *   ?list=all              → Tum kanallar (full)
 *   ?list=Germany          → Sadece Almanya
 *   ?list=Turkey           → Sadece Turkiye
 *   ?list=Germany.m3u      → Ayni (.m3u uzantili, VLC icin daha uyumlu)
 *   vavoo-Germany.m3u      → Ayni (htaccess ile, opsiyonel)
 *   ?id=XXXX               → Tek kanal (temiz link)
 *   ?url=...               → Tek kanal resolve (eski format)
 *   ?seg=...               → Segment proxy (internal)
 *   ?debug=1               → JSON debug
 */

header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, no-store, must-revalidate');

// ============================================================
//  SABITLER
// ============================================================
const UA             = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36';
const CLIENT_VERSION = '3.1.4';
const CATALOG_URL    = 'https://vavoo.to/mediahubmx-catalog.json';
const RESOLVE_URL    = 'https://vavoo.to/mediahubmx-resolve.json';
const PING_URLS      = [
    'https://www.vypn.net/api/app/ping',
    'https://www.vavoo.tv/api/app/ping',
    'https://cache.vypn.net/api/app/ping',
];
const DEFAULT_GROUPS = [
    'Turkey', 'Germany', 'United Kingdom', 'France', 'Italy', 'Spain',
    'Arabia', 'Balkans', 'Russia', 'Poland', 'Portugal', 'Netherlands',
    'Albania', 'Romania', 'Bulgaria',
];
const TOKEN_LIFETIME = 300;   // 5 dk
const CATALOG_TTL    = 600;   // 10 dk

// ============================================================
//  CACHE
// ============================================================
function cache_dir() {
    static $dir = null;
    if ($dir !== null) return $dir;
    $cands = [__DIR__ . '/.vavoo_cache', sys_get_temp_dir() . '/vavoo_cache'];
    foreach ($cands as $d) {
        if (!is_dir($d)) @mkdir($d, 0755, true);
        if (is_dir($d) && is_writable($d)) { $dir = $d; return $dir; }
    }
    $dir = sys_get_temp_dir();
    return $dir;
}

function cache_read($key, $ttl) {
    $f = cache_dir() . '/' . md5($key) . '.json';
    if (!file_exists($f)) return null;
    $data = @json_decode(@file_get_contents($f), true);
    if (!$data || !isset($data['t'], $data['v'])) return null;
    if (time() - $data['t'] > $ttl) return null;
    return $data['v'];
}

function cache_write($key, $value) {
    $f = cache_dir() . '/' . md5($key) . '.json';
    @file_put_contents($f, json_encode(['t' => time(), 'v' => $value]), LOCK_EX);
}

// ============================================================
//  HTTP
// ============================================================
function http_post($url, $payload, $extra_headers = []) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_HTTPHEADER     => array_merge([
            'Content-Type: application/json; charset=utf-8',
            'User-Agent: ' . UA,
            'Accept: */*',
        ], $extra_headers),
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    return ['ok' => $body !== false && $code < 400, 'body' => $body, 'code' => $code, 'err' => $err];
}

function http_get($url, $extra_headers = []) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_HTTPHEADER     => array_merge([
            'User-Agent: ' . UA,
            'Accept: */*',
        ], $extra_headers),
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    return ['ok' => $body !== false && $code < 400, 'body' => $body, 'code' => $code, 'err' => $err];
}

function stream_headers() {
    return [
        'Referer: https://vavoo.to/',
        'Origin: https://vavoo.to',
        'User-Agent: ' . UA,
    ];
}

// ============================================================
//  TOKEN (otomatik yenileme)
// ============================================================
function get_signature() {
    $cached = cache_read('sig', TOKEN_LIFETIME);
    if ($cached) return $cached;

    $uid = bin2hex(random_bytes(16));
    $ts  = round(microtime(true) * 1000);
    $payload = [
        'reason' => 'app-focus', 'locale' => 'de', 'theme' => 'dark',
        'metadata' => [
            'device'  => ['type' => 'desktop', 'uniqueId' => $uid],
            'os'      => ['name' => 'win32', 'version' => 'Windows 10 Pro',
                          'abis' => ['x64'], 'host' => 'PC'],
            'app'     => ['platform' => 'electron'],
            'version' => ['package' => 'net.vypn.app', 'binary' => '3.1.0', 'js' => '3.1.0'],
        ],
        'appFocusTime' => 0, 'playerActive' => false, 'playDuration' => 0,
        'devMode' => false, 'hasAddon' => true, 'castConnected' => false,
        'package' => 'net.vypn.app', 'version' => '3.1.0', 'process' => 'app',
        'firstAppStart' => $ts, 'lastAppStart' => $ts, 'ipLocation' => null,
        'adblockEnabled' => true,
        'proxy' => ['supported' => ['ss'], 'engine' => 'Mu', 'enabled' => false, 'autoServer' => true],
        'iap'   => ['supported' => false],
    ];
    foreach (PING_URLS as $u) {
        $r = http_post($u, $payload);
        if ($r['ok']) {
            $d   = json_decode($r['body'], true);
            $sig = $d['sig'] ?? $d['addonSig'] ?? $d['signature'] ?? $d['token'] ?? null;
            if ($sig) { cache_write('sig', $sig); return $sig; }
        }
    }
    return null;
}

// ============================================================
//  SELF URL
// ============================================================
function self_url() {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $path   = $_SERVER['SCRIPT_NAME'] ?? '/vavoo.php';
    return $scheme . '://' . $host . $path;
}

// ============================================================
//  KATALOG
// ============================================================
function fetch_catalog_group($group, $signature) {
    $cache_key = "catalog_$group";
    $cached = cache_read($cache_key, CATALOG_TTL);
    if ($cached !== null) return $cached;

    $channels = [];
    $cursor = 0;
    for ($page = 0; $page < 15; $page++) {
        $payload = [
            'language' => 'de', 'region' => 'AT', 'catalogId' => 'iptv', 'id' => 'iptv',
            'adult' => false, 'search' => '', 'sort' => 'name',
            'filter' => ['group' => $group],
            'cursor' => $cursor, 'clientVersion' => CLIENT_VERSION,
        ];
        $r = http_post(CATALOG_URL, $payload, ['mediahubmx-signature: ' . $signature]);
        if (!$r['ok']) break;
        $data = json_decode($r['body'], true);
        if (!is_array($data)) break;
        $items = $data['items'] ?? [];
        if (empty($items)) break;

        foreach ($items as $itm) {
            $name = $itm['name'] ?? '';
            $name = preg_replace('/\s*(\.[a-zA-Z0-9]{1,3})+$/', '', $name);
            $name = preg_replace('/\s*\((?:\d+|[A-Za-z]{1,3})\)\s*$/', '', $name);
            $name = trim(preg_replace('/\s+/', ' ', $name));
            if ($name === '') $name = 'Isimsiz Kanal';

            $chid = '';
            if (isset($itm['ids']) && is_array($itm['ids'])) {
                $chid = $itm['ids']['id'] ?? '';
            }
            if (!$chid) $chid = $itm['id'] ?? '';

            $url = $itm['url'] ?? ($itm['play'] ?? '');
            if (!$url && $chid) {
                $url = "https://vavoo.to/vavoo-iptv/play/$chid";
            } elseif ($url && strpos($url, '/play/') !== false && strpos($url, '/vavoo-iptv/') === false) {
                $url = preg_replace('#^https?://[^/]+/play/#', 'https://vavoo.to/vavoo-iptv/play/', $url);
            }
            if (!$url) continue;

            $logo = '';
            if (isset($itm['images']) && is_array($itm['images'])) {
                $logo = $itm['images']['logo'] ?? ($itm['images']['poster'] ?? '');
            }
            if (!$logo) $logo = $itm['logo'] ?? ($itm['poster'] ?? '');

            $tvg = '';
            if (isset($itm['ids']) && is_array($itm['ids'])) {
                $tvg = $itm['ids']['tvg'] ?? '';
            }

            $channels[] = [
                'name' => $name, 'url' => $url, 'group' => $group,
                'logo' => $logo, 'tvg_id' => $tvg,
            ];
        }
        $cursor = $data['nextCursor'] ?? 0;
        if (!$cursor) break;
    }
    cache_write($cache_key, $channels);
    return $channels;
}

// ============================================================
//  M3U URETIMI (VLC uyumlu, temiz ?id= linkleri)
// ============================================================
function build_m3u($channels, $self) {
    $out = ["#EXTM3U"];
    $out[] = "#EXT-X-USER-AGENT:" . UA;
    $out[] = "#EXT-X-REFERER:https://vavoo.to/";
    $out[] = "#EXT-X-ORIGIN:https://vavoo.to";

    foreach ($channels as $ch) {
        $logo = $ch['logo'] ? ' tvg-logo="' . $ch['logo'] . '"' : '';
        $tvg  = $ch['tvg_id'] ? ' tvg-id="' . $ch['tvg_id'] . '"' : '';
        $out[] = '#EXTINF:-1' . $tvg . ' tvg-name="' . $ch['name'] . '"'
               . $logo . ' group-title="' . $ch['group'] . '",' . $ch['name'];

        // Temiz link: sadece play/ sonrasindaki ID'yi kullan
        if (preg_match('#/vavoo-iptv/play/([A-Za-z0-9_-]+)#', $ch['url'], $m)) {
            $out[] = $self . '?id=' . $m[1];
        } else {
            $out[] = $self . '?url=' . urlencode($ch['url']); // yedek
        }
    }
    return implode("\n", $out) . "\n";
}

// ============================================================
//  URL HELPERS
// ============================================================
function base_url_of($url) {
    $p = parse_url($url);
    if (!$p || !isset($p['scheme'], $p['host'])) return $url;
    $base = $p['scheme'] . '://' . $p['host'];
    if (isset($p['port'])) $base .= ':' . $p['port'];
    $path = $p['path'] ?? '/';
    return $base . substr($path, 0, strrpos($path, '/') + 1);
}

function absolute_url($ref, $base) {
    if (preg_match('#^https?://#i', $ref)) return $ref;
    if (substr($ref, 0, 1) === '/') {
        $p = parse_url($base);
        return $p['scheme'] . '://' . $p['host']
             . (isset($p['port']) ? ':' . $p['port'] : '') . $ref;
    }
    return $base . $ref;
}

// ============================================================
//  .m3u UZANTI DESTEGI
//  /vavoo-Germany.m3u  →  ?list=Germany
// ============================================================
if (!isset($_GET['list']) && !isset($_GET['url']) && !isset($_GET['id']) && !isset($_GET['seg'])) {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    if (preg_match('#/vavoo-([a-zA-Z0-9_%]+)\.m3u(?:\?|$)#', $uri, $m)) {
        $_GET['list'] = urldecode($m[1]);
    }
}

// ============================================================
//  ROUTE 1: SEGMENT PROXY
// ============================================================
if (isset($_GET['seg'])) {
    $seg_url = $_GET['seg'];
    if (stripos($seg_url, 'http') !== 0) { http_response_code(400); exit('seg gecersiz'); }

    $r = http_get($seg_url, stream_headers());
    if (!$r['ok']) { http_response_code(502); exit('segment alinamadi'); }

    $ext = strtolower(pathinfo(parse_url($seg_url, PHP_URL_PATH) ?? '', PATHINFO_EXTENSION));
    $ct = 'application/octet-stream';
    if ($ext === 'm3u8') $ct = 'application/vnd.apple.mpegurl';
    elseif ($ext === 'ts')  $ct = 'video/mp2t';
    elseif ($ext === 'm4s') $ct = 'video/iso.segment';
    header('Content-Type: ' . $ct);
    header('Content-Length: ' . strlen($r['body']));
    echo $r['body'];
    exit;
}

// ============================================================
//  ROUTE 2: M3U LISTE
// ============================================================
if (isset($_GET['list'])) {
    $list = $_GET['list'];
    // .m3u sonekini temizle
    $list = preg_replace('/\.m3u$/i', '', $list);

    $sig = get_signature();
    if (!$sig) { http_response_code(500); exit('Imza alinamadi (sunucu IP engelli olabilir)'); }

    $self = self_url();

    if (strcasecmp($list, 'all') === 0 || $list === '') {
        $channels = [];
        foreach (DEFAULT_GROUPS as $g) {
            $channels = array_merge($channels, fetch_catalog_group($g, $sig));
        }
    } else {
        $channels = fetch_catalog_group($list, $sig);
    }

    if (empty($channels)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=utf-8');
        exit("Kanal bulunamadi: $list");
    }

    // VLC icin dogru Content-Type
    header('Content-Type: audio/x-mpegurl; charset=utf-8');
    // Content-Disposition YOK (VLC indirmeye calismasin)
    echo build_m3u($channels, $self);
    exit;
}

// ============================================================
//  ROUTE 3: TEK KANAL RESOLVE
// ============================================================
$input_url = $_GET['url'] ?? '';

// Temiz link destegi: ?id=XXXX
if ($input_url === '' && !empty($_GET['id'])) {
    $id = preg_replace('/[^A-Za-z0-9_-]/', '', $_GET['id']);
    $input_url = 'https://vavoo.to/vavoo-iptv/play/' . $id;
}

$debug = isset($_GET['debug']);
$proxy = !isset($_GET['proxy']) || $_GET['proxy'] !== '0';

if ($input_url === '') {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    $base = self_url();
    echo "Vavoo PHP - Kullanim:\n\n";
    echo "  Full liste     : $base?list=all\n";
    echo "  Full (.m3u)    : $base?list=all.m3u\n";
    echo "  Tek ulke       : $base?list=Germany\n";
    echo "  Tek ulke (.m3u): $base?list=Germany.m3u\n";
    echo "  Ornek gruplar  : " . implode(', ', DEFAULT_GROUPS) . "\n";
    echo "  Tek kanal      : $base?id=<kanal id>\n";
    echo "  Tek kanal (url): $base?url=<vavoo play url>\n";
    echo "  Debug          : $base?id=<kanal id>&debug=1\n";
    exit;
}

if (stripos($input_url, 'vavoo.to') === false) {
    http_response_code(400); exit('Sadece vavoo.to adresleri.');
}

$signature = get_signature();
if (!$signature) { http_response_code(500); exit('Imza alinamadi'); }

$r = http_post(RESOLVE_URL, [
    'language'      => 'de',
    'region'        => 'AT',
    'url'           => $input_url,
    'clientVersion' => CLIENT_VERSION,
], ['mediahubmx-signature: ' . $signature]);

if (!$r['ok']) { http_response_code(502); exit('Cozumleme basarisiz'); }

$data = json_decode($r['body'], true);

if ($debug) {
    header('Content-Type: application/json');
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// Array cevabi dogru oku
$stream = null;
if (is_array($data)) {
    if (isset($data[0]) && is_array($data[0])) {
        $stream = $data[0]['url'] ?? ($data[0]['stream'] ?? null);
    } else {
        $stream = $data['url'] ?? ($data['stream'] ?? null);
    }
}
if (!$stream) { http_response_code(404); exit('Yayin linki bulunamadi'); }

if (!$proxy) {
    header('Location: ' . $stream, true, 302);
    exit;
}

// Proxy: m3u8 icerigini indir + segmentleri yeniden yaz
$playlist = http_get($stream, stream_headers());
if (!$playlist['ok']) { http_response_code(502); exit('m3u8 alinamadi'); }

$base = base_url_of($stream);
$self = self_url();
$out  = [];

foreach (preg_split('/\r?\n/', $playlist['body']) as $line) {
    $trim = trim($line);
    if ($trim === '') { $out[] = ''; continue; }
    if ($trim[0] === '#') {
        if (preg_match('/URI="([^"]+)"/', $trim, $m)) {
            $abs = absolute_url($m[1], $base);
            $new = $self . '?seg=' . urlencode($abs);
            $out[] = str_replace('URI="' . $m[1] . '"', 'URI="' . $new . '"', $trim);
        } else {
            $out[] = $trim;
        }
    } else {
        $abs = absolute_url($trim, $base);
        $out[] = $self . '?seg=' . urlencode($abs);
    }
}

header('Content-Type: application/vnd.apple.mpegurl; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Content-Length: ' . strlen(implode("\n", $out)));
echo implode("\n", $out);
