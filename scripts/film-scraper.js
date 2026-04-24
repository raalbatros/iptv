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

async function getMovieDetails(tmdbId) {
    try {
        const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${API_KEY}&language=tr`;
        const response = await axios.get(url);
        return {
            imdbRating: response.data.vote_average || 0,
            popularity: response.data.popularity || 0
        };
    } catch {
        return { imdbRating: 0, popularity: 0 };
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
    console.log("🎬 Film arşivi taranıyor (1990-2026)...\n");
    
    const movies = [];
    const years = [];
    for (let y = 2026; y >= 1990; y--) years.push(y);
    
    let totalChecked = 0;
    
    for (const year of years) {
        console.log(`📅 ${year} taranıyor...`);
        
        for (let page = 1; page <= 5; page++) {
            const url = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=tr&sort_by=popularity.desc&primary_release_year=${year}&page=${page}`;
            
            try {
                const response = await axios.get(url);
                const results = response.data.results;
                if (results.length === 0) break;
                
                for (const movie of results) {
                    totalChecked++;
                    const imdbId = await getImdbId(movie.id);
                    
                    if (imdbId) {
                        const link = `${VIDMODY_URL}/${imdbId}`;
                        const ok = await checkLink(link);
                        
                        if (ok) {
                            const details = await getMovieDetails(movie.id);
                            movies.push({
                                title: movie.title,
                                year: year,
                                link: link,
                                poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "",
                                imdbRating: details.imdbRating,
                                popularity: details.popularity,
                                isTurkish: movie.original_language === "tr"
                            });
                            console.log(`   ✓ ${movie.title} (${year}) ⭐ ${details.imdbRating}`);
                        }
                    }
                    await new Promise(r => setTimeout(r, 50));
                }
            } catch(e) {
                console.log(`   Sayfa ${page} hatası`);
                break;
            }
        }
    }
    
    // Yıllara göre grupla
    const yillar = {};
    const turkishMovies = [];
    
    for (const m of movies) {
        if (m.isTurkish) {
            turkishMovies.push(m);
        } else {
            if (!yillar[m.year]) yillar[m.year] = [];
            yillar[m.year].push(m);
        }
    }
    
    // Her yıl içinde IMDb puanına göre sırala
    for (const year in yillar) {
        yillar[year].sort((a, b) => b.imdbRating - a.imdbRating);
    }
    
    // Türk filmlerini IMDb puanına göre sırala
    turkishMovies.sort((a, b) => b.imdbRating - a.imdbRating);
    
    // M3U oluştur
    let m3u = '#EXTM3U\n';
    m3u += `# Film Arşivi - ${new Date().toLocaleDateString('tr-TR')}\n`;
    m3u += `# Toplam: ${movies.length} film (${totalChecked} kontrol edildi)\n`;
    m3u += `# ⭐ IMDb puanına göre sıralanmıştır\n\n`;
    
    // 1. VİZYONDAKİLER (son 30 gün) - opsiyonel
    m3u += `# 🆕 VİZYONDAKİ FİLMLER (Son 30 gün)\n`;
    const nowPlaying = await getNowPlaying();
    for (const m of nowPlaying) {
        m3u += `#EXTINF:-1 group-title="Vizyondakiler" tvg-logo="${m.poster}", ${m.title} ⭐ ${m.rating}\n`;
        m3u += `${m.link}\n`;
    }
    m3u += `\n`;
    
    // 2. YERLİ FİLMLER (öne çıkarılmış)
    if (turkishMovies.length > 0) {
        m3u += `# 🇹🇷 YERLİ FİLMLER (Öne Çıkanlar)\n`;
        for (const m of turkishMovies.slice(0, 50)) {
            m3u += `#EXTINF:-1 group-title="Yerli Filmler" tvg-logo="${m.poster}", ${m.title} (${m.year}) ⭐ ${m.imdbRating}\n`;
            m3u += `${m.link}\n`;
        }
        m3u += `\n`;
    }
    
    // 3. YILLARA GÖRE FİLMLER (IMDb puanı sıralı)
    for (const year of Object.keys(yillar).sort().reverse()) {
        m3u += `# 🎬 ${year} (${yillar[year].length} adet)\n`;
        for (const m of yillar[year].slice(0, 30)) { // Her yıldan en iyi 30 film
            m3u += `#EXTINF:-1 group-title="${m.year}" tvg-logo="${m.poster}", ${m.title} ⭐ ${m.imdbRating}\n`;
            m3u += `${m.link}\n`;
        }
        m3u += `\n`;
    }
    
    fs.writeFileSync('filmler/films.m3u', m3u);
    console.log(`\n✅ ${movies.length} film kaydedildi`);
    console.log(`   🇹🇷 ${turkishMovies.length} yerli film`);
    console.log(`   📊 IMDb puanına göre sıralandı`);
}

async function getNowPlaying() {
    try {
        const url = `https://api.themoviedb.org/3/movie/now_playing?api_key=${API_KEY}&language=tr&page=1`;
        const response = await axios.get(url);
        const movies = [];
        
        for (const movie of response.data.results.slice(0, 20)) {
            const imdbId = await getImdbId(movie.id);
            if (imdbId) {
                const link = `${VIDMODY_URL}/${imdbId}`;
                const ok = await checkLink(link);
                if (ok) {
                    movies.push({
                        title: movie.title,
                        link: link,
                        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "",
                        rating: movie.vote_average || 0
                    });
                }
            }
        }
        return movies;
    } catch {
        return [];
    }
}

scrape().catch(console.error);
