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

// Tür ID'leri ve Türkçe isimleri
const GENRES = {
    28: "Aksiyon",
    12: "Macera",
    16: "Animasyon",
    35: "Komedi",
    80: "Suç",
    99: "Belgesel",
    18: "Dram",
    10751: "Aile",
    14: "Fantastik",
    36: "Tarih",
    27: "Korku",
    10402: "Müzik",
    9648: "Gizem",
    10749: "Romantik",
    878: "Bilim Kurgu",
    53: "Gerilim",
    10752: "Savaş",
    37: "Western"
};

async function getMovieGenres(tmdbId) {
    try {
        const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${API_KEY}&language=tr`;
        const response = await axios.get(url);
        const genreNames = response.data.genres.map(g => g.name);
        const mainGenre = genreNames[0] || "Diğer";
        return { genres: genreNames, mainGenre };
    } catch {
        return { genres: ["Diğer"], mainGenre: "Diğer" };
    }
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
    console.log("🎬 FİLMLER TÜRLERİNE GÖRE TARANIYOR...\n");
    
    const movies = [];
    const processedIds = new Set(); // Tekrar eden filmleri engelle
    
    // 1. VİZYONDAKİ FİLMLER
    console.log("🆕 Vizyondaki filmler taranıyor...");
    try {
        for (let page = 1; page <= 5; page++) {
            const url = `https://api.themoviedb.org/3/movie/now_playing?api_key=${API_KEY}&language=tr&page=${page}`;
            const response = await axios.get(url);
            if (response.data.results.length === 0) break;
            
            for (const movie of response.data.results) {
                if (processedIds.has(movie.id)) continue;
                
                const imdbId = await getImdbId(movie.id);
                if (imdbId) {
                    const link = `${VIDMODY_URL}/${imdbId}`;
                    if (await checkLink(link)) {
                        const genreInfo = await getMovieGenres(movie.id);
                        movies.push({
                            id: movie.id,
                            title: movie.title,
                            year: "Vizyonda",
                            link: link,
                            poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "",
                            rating: movie.vote_average || 0,
                            mainGenre: genreInfo.mainGenre,
                            allGenres: genreInfo.genres
                        });
                        processedIds.add(movie.id);
                        console.log(`   ✓ ${movie.title} (${genreInfo.mainGenre}) ⭐ ${movie.vote_average}`);
                    }
                }
                await new Promise(r => setTimeout(r, 30));
            }
        }
    } catch(e) { console.log("   Vizyondaki film hatası:", e.message); }
    
    // 2. TÜRLERE GÖRE POPÜLER FİLMLER
    const genreIds = Object.keys(GENRES);
    
    for (const genreId of genreIds) {
        const genreName = GENRES[genreId];
        console.log(`\n🎭 ${genreName} filmleri taranıyor...`);
        
        let page = 1;
        let totalAdded = 0;
        
        while (page <= 10 && totalAdded < 150) { // Her türden max 150 film
            const url = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=tr&sort_by=popularity.desc&with_genres=${genreId}&vote_count.gte=100&page=${page}`;
            
            try {
                const response = await axios.get(url);
                if (response.data.results.length === 0) break;
                
                for (const movie of response.data.results) {
                    if (processedIds.has(movie.id)) continue;
                    if (movie.release_date && parseInt(movie.release_date.split('-')[0]) < 1990) continue;
                    
                    const imdbId = await getImdbId(movie.id);
                    if (imdbId) {
                        const link = `${VIDMODY_URL}/${imdbId}`;
                        if (await checkLink(link)) {
                            const genreInfo = await getMovieGenres(movie.id);
                            movies.push({
                                id: movie.id,
                                title: movie.title,
                                year: movie.release_date ? movie.release_date.split('-')[0] : "Bilinmiyor",
                                link: link,
                                poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "",
                                rating: movie.vote_average || 0,
                                mainGenre: genreInfo.mainGenre,
                                allGenres: genreInfo.genres
                            });
                            processedIds.add(movie.id);
                            totalAdded++;
                            console.log(`   ✓ ${movie.title} (${movie.release_date?.split('-')[0]}) ⭐ ${movie.vote_average}`);
                        }
                    }
                    await new Promise(r => setTimeout(r, 30));
                }
                page++;
            } catch(e) { 
                break; 
            }
        }
        console.log(`   ${genreName}: ${totalAdded} film eklendi`);
    }
    
    console.log(`\n📊 Toplam taranan: ${movies.length} benzersiz film`);
    
    // M3U OLUŞTUR (TÜRLERE GÖRE SINIFLANDIRILMIŞ)
    let m3u = '#EXTM3U\n';
    m3u += `# Film Arşivi - Türlere Göre Sınıflandırılmış\n`;
    m3u += `# Oluşturma: ${new Date().toLocaleString('tr-TR')}\n`;
    m3u += `# Toplam: ${movies.length} film\n`;
    m3u += `# ⭐ Rating: IMDb puanı\n\n`;
    
    // Vizyondakiler (özel kategori)
    const vizyon = movies.filter(m => m.year === "Vizyonda");
    if (vizyon.length > 0) {
        vizyon.sort((a, b) => b.rating - a.rating);
        m3u += `# 🆕 VİZYONDAKİLER (${vizyon.length} adet)\n`;
        for (const m of vizyon) {
            m3u += `#EXTINF:-1 group-title="Vizyondakiler" tvg-logo="${m.poster}", ${m.title} ⭐ ${m.rating}\n`;
            m3u += `${m.link}\n`;
        }
        m3u += `\n`;
    }
    
    // Türlere göre gruplandır (vizyondakiler hariç)
    const nonVizyon = movies.filter(m => m.year !== "Vizyonda");
    const moviesByGenre = {};
    
    for (const movie of nonVizyon) {
        const genre = movie.mainGenre;
        if (!moviesByGenre[genre]) moviesByGenre[genre] = [];
        moviesByGenre[genre].push(movie);
    }
    
    // Her tür için ayrı bölüm oluştur (film sayısına göre sırala)
    const sortedGenres = Object.keys(moviesByGenre).sort((a, b) => moviesByGenre[b].length - moviesByGenre[a].length);
    
    for (const genre of sortedGenres) {
        const genreMovies = moviesByGenre[genre];
        // Tür içinde puana göre sırala
        genreMovies.sort((a, b) => b.rating - a.rating);
        
        // Tür ikonu ekle
        let genreIcon = "🎬";
        if (genre === "Aksiyon") genreIcon = "💥";
        else if (genre === "Komedi") genreIcon = "😂";
        else if (genre === "Dram") genreIcon = "🎭";
        else if (genre === "Korku") genreIcon = "👻";
        else if (genre === "Bilim Kurgu") genreIcon = "🚀";
        else if (genre === "Romantik") genreIcon = "💕";
        else if (genre === "Macera") genreIcon = "🗺️";
        else if (genre === "Suç") genreIcon = "🔫";
        else if (genre === "Gerilim") genreIcon = "🔪";
        else if (genre === "Animasyon") genreIcon = "🐭";
        else if (genre === "Aile") genreIcon = "👨‍👩‍👧";
        else if (genre === "Fantastik") genreIcon = "🧙";
        else if (genre === "Tarih") genreIcon = "📜";
        else if (genre === "Savaş") genreIcon = "⚔️";
        
        m3u += `# ${genreIcon} ${genre} (${genreMovies.length} adet)\n`;
        
        for (const m of genreMovies) {
            const yearInfo = m.year !== "Bilinmiyor" ? ` (${m.year})` : "";
            m3u += `#EXTINF:-1 group-title="${genre}" tvg-logo="${m.poster}", ${m.title}${yearInfo} ⭐ ${m.rating}\n`;
            m3u += `${m.link}\n`;
        }
        m3u += `\n`;
    }
    
    // Yaz
    fs.writeFileSync('filmler/films.m3u', m3u);
    
    console.log(`\n✅ TAMAMLANDI!`);
    console.log(`📊 Toplam film: ${movies.length}`);
    console.log(`🎭 Türler: ${sortedGenres.length} farklı kategori`);
    console.log(`⭐ IMDb puanına göre sıralanmıştır`);
    console.log(`💾 Kaydedildi: filmler/films.m3u`);
}

scrape().catch(console.error);
