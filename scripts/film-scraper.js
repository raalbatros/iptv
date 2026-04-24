const axios = require('axios');
const fs = require('fs');

const API_KEY = process.env.TMDB_API_KEY;

if (!API_KEY) {
    console.error("❌ TMDB_API_KEY bulunamadı!");
    process.exit(1);
}

// Klasör kontrolü
if (!fs.existsSync('filmler')) {
    fs.mkdirSync('filmler');
}

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
    console.log("🎬 Film arşivi taranıyor...\n");
    
    const movies = [];
    const years = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
    
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
                        const link = `https://vidmody.com/vs/${imdbId}`;
                        const ok = await checkLink(link);
                        if (ok) {
                            movies.push({
                                title: movie.title,
                                year: year,
                                link: link,
                                poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : ""
                            });
                            console.log(`   ✓ ${movie.title}`);
                        }
                    }
                    await new Promise(r => setTimeout(r, 100));
                }
            } catch(e) {
                console.log(`   Hata: ${e.message}`);
                break;
            }
        }
    }
    
    // M3U oluştur
    let m3u = '#EXTM3U\n';
    m3u += `# Film Arşivi - ${new Date().toLocaleDateString('tr-TR')}\n`;
    m3u += `# Toplam: ${movies.length} film\n\n`;
    
    for (const m of movies) {
        m3u += `#EXTINF:-1 group-title="${m.year}" tvg-logo="${m.poster}", ${m.title}\n`;
        m3u += `${m.link}\n`;
    }
    
    fs.writeFileSync('filmler/films.m3u', m3u);
    console.log(`\n✅ ${movies.length} film kaydedildi: filmler/films.m3u`);
}

scrape().catch(console.error);
