const axios = require('axios');
const fs = require('fs');

const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!TMDB_API_KEY) {
  console.error("❌ TMDB_API_KEY bulunamadı!");
  process.exit(1);
}

const TMDB_BASE = "https://api.themoviedb.org/3";
const VIDMODY_BASE = "https://vidmody.com/vs";

// filmler klasörü
if (!fs.existsSync('filmler')) {
  fs.mkdirSync('filmler');
}

async function checkLink(url) {
  try {
    const response = await axios.head(url, { timeout: 3000 });
    return response.status === 200;
  } catch {
    return false;
  }
}

async function getImdbId(tmdbId) {
  try {
    const url = `${TMDB_BASE}/movie/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
    const response = await axios.get(url);
    return response.data.imdb_id;
  } catch {
    return null;
  }
}

async function scrapeMovies() {
  console.log("🎬 Film taraması başlıyor...\n");
  
  const allMovies = [];
  const years = [2026, 2025, 2024];
  
  for (const year of years) {
    console.log(`📅 ${year} taranıyor...`);
    
    for (let page = 1; page <= 3; page++) {
      const url = `${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&language=tr&sort_by=popularity.desc&primary_release_year=${year}&page=${page}`;
      
      try {
        const response = await axios.get(url);
        const results = response.data.results;
        
        if (results.length === 0) break;
        
        for (const movie of results) {
          const imdbId = await getImdbId(movie.id);
          
          if (imdbId) {
            const link = `${VIDMODY_BASE}/${imdbId}`;
            const isValid = await checkLink(link);
            
            if (isValid) {
              allMovies.push({
                id: movie.id,
                title: movie.title,
                year: year,
                link: link,
                poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : ""
              });
              console.log(`   ✓ ${movie.title} (${year})`);
            }
          }
        }
        console.log(`   Sayfa ${page}: ${allMovies.length} film toplam`);
        
      } catch (error) {
        console.log(`   ⚠️ Hata: ${error.message}`);
        break;
      }
    }
  }
  
  // M3U dosyası oluştur
  let m3u = '#EXTM3U\n';
  m3u += `# Film Arşivi - ${new Date().toLocaleDateString('tr-TR')}\n`;
  m3u += `# Toplam: ${allMovies.length} film\n\n`;
  
  for (const movie of allMovies) {
    m3u += `#EXTINF:-1 group-title="🎬 ${movie.year}" tvg-logo="${movie.poster}", ${movie.title}\n`;
    m3u += `${movie.link}\n`;
  }
  
  fs.writeFileSync('filmler/films.m3u', m3u);
  
  console.log(`\n✅ TAMAMLANDI!`);
  console.log(`📊 Toplam film: ${allMovies.length}`);
  console.log(`📁 M3U: filmler/films.m3u`);
}

scrapeMovies().catch(console.error);