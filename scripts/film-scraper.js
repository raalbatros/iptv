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
    const response = await axios.get(url, { timeout: 5000 });
    return response.data.imdb_id;
  } catch {
    return null;
  }
}

// Belirli yıldaki filmleri ara
async function fetchMoviesByYear(year, existingIds, allMovies) {
  console.log(`\n📅 ${year} taranıyor...`);
  let yearCount = 0;
  
  for (let page = 1; page <= 8; page++) {
    const url = `${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&language=tr&sort_by=popularity.desc&primary_release_year=${year}&page=${page}`;
    
    try {
      const response = await axios.get(url, { timeout: 10000 });
      const results = response.data.results;
      
      if (results.length === 0) break;
      
      for (const movie of results) {
        if (existingIds.has(movie.id)) continue;
        
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
            existingIds.add(movie.id);
            yearCount++;
            console.log(`   ✓ ${movie.title} (${year})`);
          }
        }
        
        // Rate limiting
        await new Promise(r => setTimeout(r, 100));
      }
      
      console.log(`   Sayfa ${page}: Bu yıl ${yearCount} film bulundu`);
      
    } catch (error) {
      console.log(`   ⚠️ Hata: ${error.message}`);
      break;
    }
    
    await new Promise(r => setTimeout(r, 200));
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
      const response = await axios.get(url, { timeout: 10000 });
      
      for (const movie of response.data.results) {
        if (existingIds.has(movie.id)) continue;
        
        const imdbId = await getImdbId(movie.id);
        
        if (imdbId) {
          const link = `${VIDMODY_BASE}/${imdbId}`;
          const isValid = await checkLink(link);
          
          if (isValid) {
            const year = movie.release_date ? movie.release_date.split('-')[0] : "?";
            allMovies.push({
              id: movie.id,
              title: `${movie.title} (${year})`,
              year: "Yerli",
              link: link,
              poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : ""
            });
            existingIds.add(movie.id);
            turkishCount++;
            console.log(`   ✓ ${movie.title}`);
          }
        }
        
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (error) {
      console.log(`   ⚠️ Yerli film hatası: ${error.message}`);
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
    m3u += `# 🇹🇷 YERLİ FİLMLER (${turkish.length} adet)\n`;
    for (const movie of turkish) {
      m3u += `#EXTINF:-1 group-title="🇹🇷 Yerli Filmler" tvg-logo="${movie.poster}", ${movie.title}\n`;
      m3u += `${movie.link}\n`;
    }
    m3u += `\n`;
  }
  
  // Yıllara göre sırala (yeniden eskiye)
  const yearGroups = {};
  for (const movie of others) {
    if (!yearGroups[movie.year]) yearGroups[movie.year] = [];
    yearGroups[movie.year].push(movie);
  }
  
  const sortedYears = Object.keys(yearGroups).sort((a, b) => b - a);
  for (const year of sortedYears) {
    m3u += `# 🎬 ${year} (${yearGroups[year].length} adet)\n`;
    for (const movie of yearGroups[year]) {
      m3u += `#EXTINF:-1 group-title="${year}" tvg-logo="${movie.poster}", ${movie.title}\n`;
      m3u += `${movie.link}\n`;
    }
    m3u += `\n`;
  }
  
  fs.writeFileSync('filmler/films.m3u', m3u);
  console.log(`\n💾 M3U dosyası kaydedildi: filmler/films.m3u`);
}

// ANA FONKSİYON
async function scrapeMovies() {
  console.log("🎬 FİLM ARŞİVİ TARAMASI BAŞLIYOR...\n");
  console.log("⏱️ Bu işlem 5-10 dakika sürebilir. Lütfen bekleyin!\n");
  
  const startTime = Date.now();
  const allMovies = [];
  const existingIds = new Set();
  
  // TARANACAK YILLAR (2026'dan 2010'a kadar)
  const years = [
    2026, 2025, 2024, 2023, 2022, 2021, 2020,
    2019, 2018, 2017, 2016, 2015, 2014, 2013,
    2012, 2011, 2010
  ];
  
  let totalFound = 0;
  
  // Her yılı tara
  for (const year of years) {
    const found = await fetchMoviesByYear(year, existingIds, allMovies);
    totalFound += found;
    console.log(`   📌 ${year} toplam: ${found} film`);
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

// ÇALIŞTIR
scrapeMovies().catch(error => {
  console.error("\n❌ BEKLENMEYEN HATA:", error);
  process.exit(1);
});
