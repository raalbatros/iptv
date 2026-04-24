const fs = require('fs');
const axios = require('axios');

// KAYNAKLAR (4 kategori)
const KAYNAKLAR = [
    {
        ad: "📺 CANLI TV",
        url: "https://raw.githubusercontent.com/raalbatros/iptv/refs/heads/main/canlitv.m3u",
        dosya: "canlitv.m3u"
    },
    {
        ad: "🎬 FİLMLER",
        url: "https://raw.githubusercontent.com/raalbatros/iptv/refs/heads/main/filmler/films.m3u",
        dosya: "filmler/films.m3u"
    },
    {
        ad: "📺 DİZİ SON BÖLÜMLER",
        url: "https://raw.githubusercontent.com/raalbatros/iptv/refs/heads/main/dizison.m3u",
        dosya: "dizison.m3u"
    },
    {
        ad: "⭐ TAVSİYE",
        url: "https://raw.githubusercontent.com/raalbatros/iptv/refs/heads/main/tavsiye.m3u",
        dosya: "tavsiye.m3u"
    }
];

const OUTPUT_FILE = "iptv.m3u";

// URL'den dosya indir
async function indir(url) {
    try {
        const response = await axios.get(url, { timeout: 15000 });
        return response.data;
    } catch (error) {
        console.error(`❌ İndirme hatası (${url}):`, error.message);
        return null;
    }
}

// M3U içeriğini düzenle (başlık temizleme)
function temizle(icerik) {
    if (!icerik) return "";
    // #EXTM3U başlığını kaldır (en başa bir kere yazacağız)
    return icerik.replace('#EXTM3U', '').trim();
}

async function main() {
    console.log("🔗 BİRLEŞİK IPTV LİSTESİ OLUŞTURULUYOR...\n");
    
    let birlesik = '#EXTM3U\n';
    birlesik += `# Birleşik IPTV Listesi\n`;
    birlesik += `# Oluşturulma: ${new Date().toLocaleString('tr-TR')}\n`;
    birlesik += `# Kategori Sayısı: ${KAYNAKLAR.length}\n\n`;
    
    for (const kaynak of KAYNAKLAR) {
        console.log(`📥 ${kaynak.ad} indiriliyor...`);
        const icerik = await indir(kaynak.url);
        
        if (icerik) {
            const temizIcerik = temizle(icerik);
            birlesik += `\n# ==========================================\n`;
            birlesik += `# ${kaynak.ad}\n`;
            birlesik += `# Kaynak: ${kaynak.url}\n`;
            birlesik += `# ==========================================\n`;
            birlesik += temizIcerik;
            birlesik += `\n`;
            console.log(`   ✅ Başarılı`);
        } else {
            console.log(`   ⚠️ Atlandı (indirilemedi)`);
        }
    }
    
    // Dosyayı kaydet
    fs.writeFileSync(OUTPUT_FILE, birlesik);
    
    console.log(`\n✅ BİRLEŞTİRME TAMAMLANDI!`);
    console.log(`📁 Çıktı: ${OUTPUT_FILE}`);
    console.log(`📊 Dosya boyutu: ${(birlesik.length / 1024).toFixed(2)} KB`);
    console.log(`\n📺 SON M3U LİNKİ:`);
    console.log(`https://raw.githubusercontent.com/raalbatros/iptv/main/iptv.m3u`);
}

main().catch(console.error);
