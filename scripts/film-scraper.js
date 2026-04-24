const axios = require('axios');
const fs = require('fs');

const API_KEY = process.env.TMDB_API_KEY;

if (!API_KEY) {
    console.error("❌ API anahtarı yok!");
    process.exit(1);
}

if (!fs.existsSync('filmler')) {
    fs.mkdirSync('filmler');
}

const VIDMODY_URL = "https://vidmody.com/vs";

async function getImdbId(tmdbId) {
    try {
        const url = `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids?api_key=${API_KEY}`;
        const response = await axios.get(url);
        return response.data.imdb_id;
    } catch {
        return null;
    }
}

async function checkLink(url) {
    try {
        const response = await axios.head(url, { timeout: 5000 });
        return response.status === 200;
    } catch {
        return false;
    }
}

async function scrape() {
    console.log("🎬 TÜM ÖZELLİKLERLE FİLM ARŞİVİ TARANIYOR...\n");
    
    const movies = [];
    
    // 1. VİZYONDAKİ FİLMLER (son 1 ay)
    console.log("🆕 Vizyondaki filmler taranıyor...");
    try {
        const url = `https://api.themoviedb.org/3/movie/now_playing?api_key=${API_KEY}&language=tr&page=1`;
        const response = await axios.get(url);
        for (const movie of response.data.results.slice(0, 30)) {
            const imdbId = await getImdbId(movie.id);
            if (imdbId) {
                const link = `${VIDMODY_URL}/${imdbId}`;
                if (await checkLink(link)) {
                    movies.push({
                        title: movie.title,
                        year: "Vizyonda",
                        link: link,
                        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "",
                        rating: movie.vote_average || 0,
                        isTurkish: false
                    });
                    console.log(`   ✓ ${movie.title} (VİZYONDA)`);
                }
            }
        }
    } catch(e) { console.log("   Vizyondaki film hatası"); }
    
    // 2. YILLARA GÖRE FİLMLER (1990-2026)
    const years = [];
    for (let y = 2026; y >= 1990; y--) years.push(y);
    
    for (const year of years) {
        console.log(`📅 ${year} taranıyor...`);
        
        for (let page = 1; page <= 5; page++) {
            const url = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=tr&sort_by=popularity.desc&primary_release_year=${year}&page=${page}`;
            
            try {
                const response = await axios.get(url);
                const results = response.data.results;
                if (results.length === 0) break;
                
                for (const movie of results) {
                    const imdbId = await getImdbId(movie.id);
                    if (imdbId) {
                        const link = `${VIDMODY_URL}/${imdbId}`;
                        if (await checkLink(link)) {
                            movies.push({
                                title: movie.title,
                                year: year,
                                link: link,
                                poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "",
                                rating: movie.vote_average || 0,
                                isTurkish: movie.original_language === "tr"
                            });
                            console.log(`   ✓ ${movie.title} (${year}) ⭐ ${movie.vote_average || "?"}`);
                        }
                    }
                    await new Promise(r => setTimeout(r, 50));
                }
            } catch(e) { break; }
        }
    }
    
    // M3U OLUŞTUR (SIRALI VE KATEGORİLİ)
    let m3u = '#EXTM3U\n';
    m3u += `# Film Arşivi - ${new Date().toLocaleDateString('tr-TR')}\n`;
    m3u += `# Toplam: ${movies.length} film\n`;
    m3u += `# ⭐ Rating: IMDb puanı yüksek olanlar önce gelir\n`;
    m3u += `# 🇹🇷 Yerli filmler ayrı kategoridedir\n\n`;
    
    // Yerli filmler
    const turkish = movies.filter(m => m.isTurkish && m.year !== "Vizyonda");
    const vizyon = movies.filter(m => m.year === "Vizyonda");
    const others = movies.filter(m => m.year !== "Vizyonda" && !m.isTurkish);
    
    // Vizyondakiler
    if (vizyon.length > 0) {
        vizyon.sort((a, b) => b.rating - a.rating);
        m3u += `# 🆕 VİZYONDAKİLER (${vizyon.length} adet)\n`;
        for (const m of vizyon) {
            m3u += `#EXTINF:-1 group-title="Vizyondakiler" tvg-logo="${m.poster}", ${m.title} ⭐ ${m.rating}\n`;
            m3u += `${m.link}\n`;
        }
        m3u += `\n`;
    }
    
    // Yerli filmler (öne çıkar)
    if (turkish.length > 0) {
        turkish.sort((a, b) => b.rating - a.rating);
        m3u += `# 🇹🇷 YERLİ FİLMLER (${turkish.length} adet)\n`;
        for (const m of turkish.slice(0, 100)) {
            m3u += `#EXTINF:-1 group-title="Yerli Filmler" tvg-logo="${m.poster}", ${m.title} (${m.year}) ⭐ ${m.rating}\n`;
            m3u += `${m.link}\n`;
        }
        m3u += `\n`;
    }
    
    // Yıllara göre filmler (rating'e göre sıralı)
    const yearGroups = {};
    for (const m of others) {
        if (!yearGroups[m.year]) yearGroups[m.year] = [];
        yearGroups[m.year].push(m);
    }
    
    for (const year of Object.keys(yearGroups).sort().reverse()) {
        yearGroups[year].sort((a, b) => b.rating - a.rating);
        m3u += `# 🎬 ${year} (${yearGroups[year].length} adet)\n`;
        for (const m of yearGroups[year].slice(0, 50)) {
            m3u += `#EXTINF:-1 group-title="${m.year}" tvg-logo="${m.poster}", ${m.title} ⭐ ${m.rating}\n`;
            m3u += `${m.link}\n`;
        }
        m3u += `\n`;
    }
    
    fs.writeFileSync('filmler/films.m3u', m3u);
    console.log(`\n✅ TAMAMLANDI!`);
    console.log(`📊 Toplam film: ${movies.length}`);
    console.log(`   🆕 Vizyondaki: ${vizyon.length}`);
    console.log(`   🇹🇷 Yerli: ${turkish.length}`);
    console.log(`   📅 Diğer: ${others.length}`);
    console.log(`⭐ IMDb puanına göre sıralanmıştır`);
}

scrape().catch(console.error);
