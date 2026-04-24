const axios = require('axios');
const fs = require('fs');

const API_KEY = process.env.TMDB_API_KEY;

console.log("🎬 Film arşivi taranıyor...");

if (!fs.existsSync('filmler')) {
    fs.mkdirSync('filmler');
}

let m3u = '#EXTM3U\n';
m3u += `# Film Arşivi - ${new Date().toLocaleDateString('tr-TR')}\n\n`;

// Sadece test amaçlı birkaç film ekleyelim
const testFilms = [
    { title: "Interstellar", year: 2014, link: "https://vidmody.com/vs/tt0816692" },
    { title: "Inception", year: 2010, link: "https://vidmody.com/vs/tt1375666" },
    { title: "The Dark Knight", year: 2008, link: "https://vidmody.com/vs/tt0468569" },
    { title: "Pulp Fiction", year: 1994, link: "https://vidmody.com/vs/tt0110912" },
    { title: "Fight Club", year: 1999, link: "https://vidmody.com/vs/tt0137523" }
];

for (const film of testFilms) {
    m3u += `#EXTINF:-1 group-title="${film.year}", ${film.title}\n`;
    m3u += `${film.link}\n`;
}

fs.writeFileSync('filmler/films.m3u', m3u);
console.log(`✅ ${testFilms.length} film kaydedildi`);
