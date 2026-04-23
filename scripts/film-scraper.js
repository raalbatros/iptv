const axios = require('axios');
const fs = require('fs');

const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!TMDB_API_KEY) {
  console.error("❌ TMDB_API_KEY bulunamadı!");
  process.exit(1);
}

const TMDB_BASE = "https://api.themoviedb.org/3";

// Birden fazla video kaynağı
const VIDEO_SOURCES = [
    { name: "vidmody", url: "https://vidmody.com/vs", type: "imdb" },
    { name: "vidsrc", url: "https://vidsrc.xyz/embed/movie", type: "tmdb" },
    { name: "vidsrc2", url: "https://vidsrc.in/embed/movie", type: "tmdb" },
    { name: "multiembed", url: "https://multiembed.to/video", type: "imdb" }
];

// filmler klasörü
if (!fs.existsSync('filmler')) {
    fs.mkdirSync('filmler');
}

// Link kontrolü
async function checkLink(url) {
    try {
        const response = await axios.head(url, { timeout: 5000 });
        return response.status === 200;
    } catch {
        return false;
    }
}

// IMDb ID al
async function getImdbId(tmdbId) {
    try {
        const url = `${TMDB_BASE}/movie/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
        const response = await axios.get(url);
        return response.data.imdb_id;
    } catch {
        return null;
    }
}

// Tüm kaynaklardan link bul
async function findWorkingLink(imdbId, tmdbId) {
    for (const source of VIDEO_SOURCES) {
        let url;
        if (source.type === "imdb" && imdbId) {
            url = `${source.url}/${imdbId}`;
        } else if (source.type === "tmdb" && tmdbId) {
            url = `${source.url}/${tmdbId}`;
        } else {
            continue;
        }
        
        console.log(`     Deneniyor: ${source.name}...`);
        if (await checkLink(url)) {
            console.log(`     ✓ ${source.name} çalışıyor!`);
            return { url, source: source.name };
        }
    }
    return null;
}

// Belirli yıldaki filmleri ara
async function fetchMoviesByYear(year, existingIds, allMovies) {
    console.log(`\n📅 ${year} taranıyor...`);
    let yearCount = 0;
    
    for (let page = 1; page <= 10; page++) {
        const url = `${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&language=tr&sort_by=popularity.desc&primary_release_year=${year}&page=${page}`;
        
        try {
            const response = await axios.get(url);
            const results = response.data.results;
            
            if (results.length === 0) break;
            
            for (const movie of results) {
                if (existingIds.has(movie.id)) continue;
                
                const imdbId = await getImdbId(movie.id);
                const linkData = await findWorkingLink(imdbId, movie.id);
                
                if (linkData && linkData.url) {
                    allMovies.push({
                        id: movie.id,
                        title: movie.title,
                        year: year,
                        link: linkData.url,
                        source: linkData.source,
                        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : ""
                    });
                    existingIds.add(movie.id);
                    yearCount++;
                    console.log(`   ✓ ${movie.title} (${year}) - ${linkData.source}`);
                }
                
                // Rate limiting
                await new Promise(r => setTimeout(r, 100));
            }
            
            console.log(`   Sayfa ${page}: Bu yıl ${yearCount} film bulundu`);
            
        } catch (error) {
            console.log(`   ⚠️ Hata: ${error.message}`);
            break;
        }
        
        await new Promise(r => setTimeout(r, 500));
    }
    
    return yearCount;
}

// Yerli filmleri ara
async function fetchTurkishMovies(existingIds, allMovies) {
    console.log(`\n🇹🇷 Yerli filmler taranıyor...`);
    let turkishCount = 0;
    
    for (let page = 1; page <= 5; page++) {
        const url = `${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&language=tr&sort_by=popularity.desc&with_original_language=tr&page=${page}`;
        
        try {
            const response = await axios.get(url);
            
            for (const movie of response.data.results) {
                if (existingIds.has(movie.id)) continue;
                
                const imdbId = await getImdbId(movie.id);
                const linkData = await findWorkingLink(imdbId, movie.id);
                
                if (linkData && linkData.url) {
                    const year = movie.release_date ? movie.release_date.split('-')[0] : "?";
                    allMovies.push({
                        id: movie.id,
                        title: `${movie.title} (${year})`,
                        year: "Yerli",
                        link: linkData.url,
                        source: linkData.source,
                        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : ""
                    });
                    existingIds.add(movie.id);
                    turkishCount++;
                    console.log(`   ✓ ${movie.title} - ${linkData.source}`);
                }
                
                await new Promise(r => setTimeout(r, 100));
            }
        } catch (error) {
            break;
        }
    }
    
    return turkishCount;
}

// M3U dosyası oluştur
function saveM3U(movies) {
    let m3u = '#EXTM3U\n';
    m3u += `# Film Arşivi - ${new Date().toLocaleDateString('tr-TR')}\n`;
    m3u += `# Toplam: ${movies.length} film\n`;
    m3u += `# Güncelleme: Her gün 03:00'te otomatik\n\n`;
    
    // Yerli filmler önce
    const turkish = movies.filter(m => m.year === "Yerli");
    const others = movies.filter(m => m.year !== "Yerli");
    
    if (turkish.length > 0) {
        m3u += `\n# 🇹🇷 YERLİ FİLMLER (${turkish.length} adet)\n`;
        for (const movie of turkish) {
            m3u += `#EXTINF:-1 group-title="🇹🇷 Yerli Filmler" tvg-logo="${movie.poster}", ${movie.title}\n`;
            m3u += `${movie.link}\n`;
        }
    }
    
    // Yıllara göre sırala (eskiden yeniye)
    const yearGroups = {};
    for (const movie of others) {
        if (!yearGroups[movie.year]) yearGroups[movie.year] = [];
        yearGroups[movie.year].push(movie);
    }
    
    const sortedYears = Object.keys(yearGroups).sort((a,b) => b - a);
    for (const year of sortedYears) {
        m3u += `\n# 🎬 ${year} (${yearGroups[year].length} adet)\n`;
        for (const movie of yearGroups[year]) {
            m3u += `#EXTINF:-1 group-title="${year}" tvg-logo="${movie.poster}", ${movie.title}\n`;
            m3u += `${movie.link}\n`;
        }
    }
    
    fs.writeFileSync('filmler/films.m3u', m3u);
}

// ANA FONKSİYON
async function scrapeMovies() {
    console.log("🎬 TÜM ZAMANLAR FİLM ARŞİVİ TARAMASI BAŞLIYOR...\n");
    console.log(`⏱️ Bu işlem 20-30 dakika sürebilir. Lütfen bekleyin!\n`);
    
    const startTime = Date.now();
    const allMovies = [];
    const existingIds = new Set();
    
    // Tüm yıllar (1900'den günümüze)
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= 1900; y--) {
        years.push(y);
    }
    
    let totalFound = 0;
    
    // Her yılı tara
    for (let i = 0; i < years.length; i++) {
        const year = years[i];
        const found = await fetchMoviesByYear(year, existingIds, allMovies);
        totalFound += found;
        
        // Her 10 yılda bir durum göster
        if ((i + 1) % 10 === 0) {
            console.log(`\n📊 İlerleme: ${i+1}/${years.length} yıl tarandı, ${totalFound} film bulundu\n`);
        }
    }
    
    // Yerli filmleri ekle
    const turkishFound = await fetchTurkishMovies(existingIds, allMovies);
    totalFound += turkishFound;
    
    // M3U oluştur
    saveM3U(allMovies);
    
    const elapsed = Math.round((Date.now() - startTime) / 60000);
    
    console.log(`\n✅ TAMAMLANDI!`);
    console.log(`📊 Toplam film: ${allMovies.length}`);
    console.log(`⏱️ Geçen süre: ${elapsed} dakika`);
    console.log(`📁 M3U: filmler/films.m3u`);
    console.log(`\n📺 IPTV Linki: https://raw.githubusercontent.com/raalbatros/iptv/main/filmler/films.m3u`);
}

scrapeMovies().catch(console.error);
