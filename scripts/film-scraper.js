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

// BİRDEN FAZLA VİDEO KAYNAĞI
const KAYNAKLAR = [
    { name: "vidmody", url: (id) => `https://vidmody.com/vs/${id}`, type: "imdb" },
    { name: "vidsrc", url: (id) => `https://vidsrc.xyz/embed/movie/${id}`, type: "tmdb" },
    { name: "vidsrc2", url: (id) => `https://vidsrc.in/embed/movie/${id}`, type: "tmdb" },
    { name: "multiembed", url: (id) => `https://multiembed.to/video/${id}/movie`, type: "tmdb" }
];

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

async function findWorkingLink(tmdbId, imdbId) {
    for (const kaynak of KAYNAKLAR) {
        let url;
        if (kaynak.type === "imdb" && imdbId) {
            url = kaynak.url(imdbId);
        } else if (kaynak.type === "tmdb" && tmdbId) {
            url = kaynak.url(tmdbId);
        } else {
            continue;
        }
        
        if (await checkLink(url)) {
            return { url, source: kaynak.name };
        }
    }
    return null;
}

async function scrape() {
    console.log("🎬 Film arşivi taranıyor (çoklu kaynak)...\n");
    
    const movies = [];
    const years = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
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
                    const linkData = await findWorkingLink(movie.id, imdbId);
                    
                    if (linkData && linkData.url) {
                        movies.push({
                            title: movie.title,
                            year: year,
                            link: linkData.url,
                            source: linkData.source,
                            poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : ""
                        });
                        console.log(`   ✓ ${movie.title} (${year}) - ${linkData.source}`);
                    }
                    await new Promise(r => setTimeout(r, 100));
                }
            } catch(e) {
                console.log(`   Sayfa ${page} hatası`);
                break;
            }
        }
    }
    
    // M3U oluştur
    let m3u = '#EXTM3U\n';
    m3u += `# Film Arşivi - ${new Date().toLocaleDateString('tr-TR')}\n`;
    m3u += `# Toplam: ${movies.length} film (${totalChecked} film kontrol edildi)\n\n`;
    
    const yillar = {};
    for (const m of movies) {
        if (!yillar[m.year]) yillar[m.year] = [];
        yillar[m.year].push(m);
    }
    
    for (const year of Object.keys(yillar).sort().reverse()) {
        m3u += `# 🎬 ${year} (${yillar[year].length} adet)\n`;
        for (const m of yillar[year]) {
            m3u += `#EXTINF:-1 group-title="${m.year}" tvg-logo="${m.poster}", ${m.title}\n`;
            m3u += `${m.link}\n`;
        }
        m3u += `\n`;
    }
    
    fs.writeFileSync('filmler/films.m3u', m3u);
    console.log(`\n✅ ${movies.length} film kaydedildi (${totalChecked} film kontrol edildi)`);
}

scrape().catch(console.error);
