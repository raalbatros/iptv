const axios = require('axios');
const fs = require('fs');

// KAYNAKLAR
const KAYNAKLAR = [
    {
        ad: "📺 CANLI TV",
        url: "https://raw.githubusercontent.com/raalbatros/iptv/refs/heads/main/canlitv.m3u"
    },
    {
        ad: "🎬 FİLMLER",
        url: "https://raw.githubusercontent.com/raalbatros/iptv/refs/heads/main/filmler/films.m3u"
    },
    {
        ad: "📺 DİZİ SON BÖLÜMLER",
        url: "https://raw.githubusercontent.com/raalbatros/iptv/refs/heads/main/dizison.m3u"
    },
    {
        ad: "⭐ TAVSİYE",
        url: "https://raw.githubusercontent.com/raalbatros/iptv/refs/heads/main/tavsiye.m3u"
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

// M3U içeriğini temizle (sadece kanal/film satırlarını al)
function temizle(icerik) {
    if (!icerik) return "";
    
    const lines = icerik.split('\n');
    const temizSatirlar = [];
    let inHeader = true;
    
    for (const line of lines) {
        // #EXTM3U başlığını atla
        if (line.startsWith('#EXTM3U')) continue;
        
        // x-tvg-url gibi ekstra başlıkları atla
        if (line.includes('x-tvg-url')) continue;
        
        // Sadece #EXTINF ve URL satırlarını al
        if (line.startsWith('#EXTINF') || (line.startsWith('#') && line.includes('group-title'))) {
            temizSatirlar.push(line);
        } else if (line.trim() && !line.startsWith('#')) {
            temizSatirlar.push(line);
        } else if (line.startsWith('#') && !line.includes('EXTINF') && !line.includes('group-title')) {
            // Açıklama satırlarını (# ile başlayan ama EXTINF olmayan) atla
            continue;
        }
    }
    
    return temizSatirlar.join('\n');
}

async function main() {
    console.log("🔗 IPTV birleştiriliyor...\n");
    
    let birlesik = '#EXTM3U\n';
    birlesik += `# IPTV Listesi - ${new Date().toLocaleString('tr-TR')}\n`;
    birlesik += `# Toplam kaynak: ${KAYNAKLAR.length}\n\n`;
    
    for (const kaynak of KAYNAKLAR) {
        console.log(`📥 ${kaynak.ad} indiriliyor...`);
        const icerik = await indir(kaynak.url);
        
        if (icerik) {
            const temizIcerik = temizle(icerik);
            if (temizIcerik.trim()) {
                birlesik += `\n# ========== ${kaynak.ad} ==========\n`;
                birlesik += temizIcerik;
                birlesik += `\n`;
                console.log(`   ✅ Eklendi`);
            } else {
                console.log(`   ⚠️ İçerik boş`);
            }
        } else {
            console.log(`   ⚠️ Atlanıyor`);
        }
    }
    
    fs.writeFileSync('iptv.m3u', birlesik);
    console.log(`\n✅ iptv.m3u oluşturuldu!`);
}

main().catch(console.error);
