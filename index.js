const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('VAVOO Proxy çalışıyor - /ch?u=LINK şeklinde kullan');
});

app.get('/ch', async (req, res) => {
  const targetUrl = req.query.u;
  
  if (!targetUrl) {
    return res.status(400).send('HATA: ?u= parametresi gerekli');
  }

  try {
    console.log('VAVOO linki çekiliyor:', targetUrl);
    
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'VAVOO/2.6',
        'Accept': '*/*',
        'Connection': 'keep-alive'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send(`VAVOO hatası: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    response.body.pipe(res);
  } catch (error) {
    console.error('Proxy hatası:', error);
    res.status(500).send('Proxy bağlantı hatası');
  }
});

app.listen(PORT, () => {
  console.log(`VAVOO Proxy ${PORT} portunda çalışıyor`);
});
