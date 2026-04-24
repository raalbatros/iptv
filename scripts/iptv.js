const axios = require('axios');
const fs = require('fs');

// KAYNAKLAR - her birine özel grup adı
const KAYNAKLAR = [
    {
        ad: "📺 CANLI TV",
        url: "https://raw.githubusercontent.com/raalbatros/iptv/refs/heads/main/canlitv.m3u",
        grup: "Canlı TV"
    },
    {
        ad: "⭐ TAVSİYE FİLMLER",
        url: "https://raw.githubusercontent.com/raalbatros/iptv/refs/heads/main/tavsiye.m3u",
        grup: "Tavsiye Filmler"
    },
    {
        ad: "📺 DİZİLER",
        url: "https://raw.githubusercontent.com/raalbatros/iptv/refs/heads/main/dizison.m3u",
        grup: "Diziler"
    },
    {
        ad: "🎬 FİLM ARŞİVİ",
        url: "https://raw.githubusercontent.com/raalbatros/iptv/refs/heads/main/filmler/films.m3u",
        grup: "Filmler"
    }
];

async function indir(url) {
    try {
        const response = await axios.get(url, { timeout: 10000 });
        return response.data;
    } catch (error) {
        console.error(`❌ Hata: ${url} - ${error.message}`);
        return null;
    }
}

// M3U içeriğini temizle ve grup adını değiştir
function temizleVeGrupla(icerik, yeniGrup) {
    if (!icerik) return "";
    
    const lines = icerik.split('\n');
    const temizSatirlar = [];
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // #EXTM3U başlığını atla
        if (line.startsWith('#EXTM3U')) continue;
        
        // x-tvg-url gibi ekstra başlıkları atla
        if (line.includes('x-tvg-url')) continue;
        
        // #EXTINF satırlarındaki group-title'ı değiştir
        if (line.startsWith('#EXTINF')) {
            // Eski group-title'ı bul ve yenisiyle değiştir
            line = line.replace(/group-title="[^"]*"/, `group-title="${yeniGrup}"`);
            
            // Eğer group-title yoksa ekle
            if (!line.includes('group-title=')) {
                line = line.replace('#EXTINF:-1', `#EXTINF:-1 group-title="${yeniGrup}"`);
            }
            temizSatirlar.push(line);
        } 
        // URL satırları
        else if (line.trim() && !line.startsWith('#')) {
            temizSatirlar.push(line);
        }
        // Diğer # ile başlayan satırları (yorum) atla
        else if (line.startsWith('#') && !line.includes('EXTINF')) {
            continue;
        }
    }
    
    return temizSatirlar.join('\n');
}

async function main() {
    console.log("🔗 IPTV birleştiriliyor...\n");
    
    let birlesik = '#EXTM3U\n';
    birlesik += `# IPTV Listesi - ${new Date().toLocaleString('tr-TR')}\n`;
    birlesik += `# Kategoriler: Canlı TV, Tavsiye Filmler, Diziler, Filmler\n\n`;
    
    for (const kaynak of KAYNAKLAR) {
        console.log(`📥 ${kaynak.ad} indiriliyor...`);
        const icerik = await indir(kaynak.url);
        
        if (icerik) {
            const temizIcerik = temizleVeGrupla(icerik, kaynak.grup);
            if (temizIcerik.trim()) {
                birlesik += `\n# ========== ${kaynak.ad} ==========\n`;
                birlesik += temizIcerik;
                birlesik += `\n`;
                console.log(`   ✅ Eklendi (${kaynak.grup})`);
            } else {
                console.log(`   ⚠️ İçerik boş`);
            }
        } else {
            console.log(`   ⚠️ Atlanıyor`);
        }
    }
    
    fs.writeFileSync('iptv.m3u', birlesik);
    console.log(`\n✅ iptv.m3u oluşturuldu!`);
    console.log(`   Kategoriler: ${KAYNAKLAR.map(k => k.grup).join(', ')}`);
}

main().catch(console.error);
