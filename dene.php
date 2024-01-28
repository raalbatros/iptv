<?php
$Live = $_GET['HLS'];
$Play = '{
	"channelId":'.$Live.',
	"liveOffset":75,
	"quality":"2",
	"uid":"f@3f8b4b369748ace0c2"
}';
$ch = curl_init('https://webtv.uyanik.tv/play');
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $Play);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
'Host: webtv.uyanik.tv',
'Connection: keep-alive',
'X-XSRF-TOKEN: eyJpdiI6IjQ2QXp3ajAxbGlYSjIwdXV0N01KN2c9PSIsInZhbHVlIjoiL2trSyt1OEVVaFoxeURia1A4Mmd3cUFocEY3SVlKYjVGMUZmUjRXTC9nUzdVWjZXVittYStYRVVxQTQ2dGhGaVpPSThZRW91b0k5Q2hVamgxcXdrbVF4RyszU0p1RTZpRm9CWDJuZlg1NG1zaDVZZmlQc0xlNlBrTEZsTlNDbDUiLCJtYWMiOiI3MTdjMDA2ZDU0YzYyZDNkNmJhM2I3Yjg1Zjc0OWZhMGQwMGIwYWM2YTVjNmUxZTQzNTJmNmJkMGVmMjliZGU1IiwidGFnIjoiIn0=',
'User-Agent: NetSurf/1.0 (Linux; i686)',
'Content-Type: application/json',
'Accept: application/json, text/plain, */*',
'X-Requested-With: XMLHttpRequest',
'Origin: https://webtv.uyanik.tv',
'Referer: https://webtv.uyanik.tv/anasayfa',
'Cookie: uyaniktv_session=eyJpdiI6ImVYUVlyaXhaVmhtOUJwQXFBaVZFSGc9PSIsInZhbHVlIjoiMTUwWTdxOFh1UzBqVU01dFozbWV5bmFCUXVlNDV3QXJ0aDU0NHNDUU9keE5YYmdOa3ozby9pN05PQ292MnFrMFdvVm5wRlA4RDdBR2dHMXpDcEVhaGgvc1VRS2NLK0FuYW1WaVAxR2Y0QXFEQ0Nrd0JzY1d3b2pHSDYzMEp5aDciLCJtYWMiOiIzZDUzN2RhYzY0ODE5ODY3ZTI0ODQzNzcxYTBhMjU0YjNmNmZiY2Q5MjkwYTI0ZDMzMjY3MWI5MDE5OThjZmQ2IiwidGFnIjoiIn0%3D',
));
$site = curl_exec($ch);
curl_close ($ch);
$site = str_replace(',','',$site);
preg_match('#sid":"(.*?)"#',$site,$icerik);
$ID = $icerik[1];

$ch1 = curl_init('https://webtv.uyanik.tv/playlist/'.$ID.'/2');
curl_setopt($ch1, CURLOPT_SSL_VERIFYHOST, false);
curl_setopt($ch1, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch1, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch1, CURLOPT_HTTPHEADER, array(
'Host: webtv.uyanik.tv',
'Connection: keep-alive',
'User-Agent: NetSurf/1.0 (Linux; i686)',
'Accept: */*',
'Referer: https://webtv.uyanik.tv/canli-izle',
'Cookie: uyaniktv_session=eyJpdiI6ImVYUVlyaXhaVmhtOUJwQXFBaVZFSGc9PSIsInZhbHVlIjoiMTUwWTdxOFh1UzBqVU01dFozbWV5bmFCUXVlNDV3QXJ0aDU0NHNDUU9keE5YYmdOa3ozby9pN05PQ292MnFrMFdvVm5wRlA4RDdBR2dHMXpDcEVhaGgvc1VRS2NLK0FuYW1WaVAxR2Y0QXFEQ0Nrd0JzY1d3b2pHSDYzMEp5aDciLCJtYWMiOiIzZDUzN2RhYzY0ODE5ODY3ZTI0ODQzNzcxYTBhMjU0YjNmNmZiY2Q5MjkwYTI0ZDMzMjY3MWI5MDE5OThjZmQ2IiwidGFnIjoiIn0%3D',
));
$site1 = curl_exec($ch1);
curl_close ($ch1);
echo ("$site1");
?>
