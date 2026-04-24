const axios = require('axios');
const fs = require('fs');

const API_KEY = process.env.TMDB_API_KEY;

console.log("🎬 Film taraması başlıyor...");
console.log("API anahtarı:", API_KEY ? "✅ Var" : "❌ Yok");

if (!API_KEY) {
    console.error("HATA: TMDB_API_KEY bulunamadı!");
    process.exit(1);
}

// Klasör kontrolü
if (!fs.existsSync('filmler')) {
    fs.mkdirSync('filmler');
    console.log("📁 filmler klasörü oluşturuldu");
}

// Filmleri topla
const allMovies = [];

// Sadece küçük bir test - 2025 popüler filmleri
async function testFetch() {
    try {
        const url = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=tr&sort_by=popularity.desc&year=2025&page=1`;
        console.log(`🌐 İstek yapılıyor: ${url.substring(0, 80)}...`);
        
        const response = await axios.get(url, { timeout: 10000 });
        const movies = response.data.results;
        
        console.log(`📊 ${movies.length} film bulundu`);
        
        for (const movie of movies.slice(0, 10)) { // Sadece ilk 10 film
            allMovies.push({
                id: movie.id,
                title: movie.title,
                year: 2025,
                link: `https://vidmody.com/vs/tt${movie.id}`,
                poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : ""
            });
            console.log(`   ✓ ${movie.title}`);
        }
        
    } catch (error) {
        console.error("❌ Hata:", error.message);
        if (error.response) {
            console.error("   Status:", error.response.status);
        }
        process.exit(1);
    }
}

// M3U oluştur
function saveM3U() {
    let m3u = '#EXTM3U\n';
    m3u += `# Film Arşivi - ${new Date().toLocaleDateString('tr-TR')}\n`;
    m3u += `# Toplam: ${allMovies.length} film\n\n`;
    
    for (const movie of allMovies) {
        m3u += `#EXTINF:-1 group-title="${movie.year}" tvg-logo="${movie.poster}", ${movie.title}\n`;
        m3u += `${movie.link}\n`;
    }
    
    fs.writeFileSync('filmler/films.m3u', m3u);
    console.log(`\n✅ filmler/films.m3u kaydedildi (${allMovies.length} film)`);
}

// Ana işlem
async function main() {
    await testFetch();
    saveM3U();
    console.log("\n✨ İşlem tamamlandı!");
}

main().catch(error => {
    console.error("❌ Ana işlem hatası:", error);
    process.exit(1);
});
