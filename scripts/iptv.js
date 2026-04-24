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

async function main() {
    console.log("🔗 IPTV birleştiriliyor...\n");
    
    let birlesik = '#EXTM3U\n';
    birlesik += `# IPTV Listesi - ${new Date().toLocaleString('tr-TR')}\n\n`;
    
    for (const kaynak of KAYNAKLAR) {
        console.log(`📥 ${kaynak.ad} indiriliyor...`);
        const icerik = await indir(kaynak.url);
        
        if (icerik) {
            let temiz = icerik.replace('#EXTM3U', '').trim();
            birlesik += `\n# ========== ${kaynak.ad} ==========\n`;
            birlesik += temiz;
            birlesik += `\n`;
            console.log(`   ✅ Eklendi`);
        } else {
            console.log(`   ⚠️ Atlanıyor`);
        }
    }
    
    fs.writeFileSync('iptv.m3u', birlesik);
    console.log(`\n✅ iptv.m3u oluşturuldu!`);
}

main().catch(console.error);
