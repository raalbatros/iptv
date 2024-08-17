<?php
$Live = $_GET['ID'];
$Login = '{
	"token":"v_zDHxdKnlUXQPQox6g9KtXBUw9QBVAmTRgVMt0_C58rhhlb8x1H7nTIykRdksNZvambOpcguXVRQGHooudi6ccMNtvPNV7F3feSI-Re48N4BWx00LjRcjvMb2-hsWJeVb8QB5r4IGLCa1xUPLqbZ7crbvpr7Q",
	"reason":"app-focus",
	"locale":"tr",
	"theme":"dark",
	"metadata":
{
	"device":
{
	"type":"desktop",
	"uniqueId":"ab2a4978-a993-427e-910e-72856c4976f6"
}
,
	"os":
{
	"name":"win32",
	"version":"Windows 10 Pro",
	"abis":
[
	"x64"
]
,
	"host":"DESKTOP-4GR0COT"
}
,
	"app":
{
	"platform":"electron"
}
,
	"version":
{
	"package":"net.rokkr.app",
	"binary":"2.0.2",
	"js":"2.0.2"
}
}
,
	"appFocusTime":12598,
	"playerActive":true,
	"playDuration":12701,
	"devMode":false,
	"hasAddon":true,
	"hasMhub":true,
	"castConnected":false,
	"package":"net.rokkr.app",
	"version":"2.0.2",
	"process":"app",
	"firstAppStart":1721840373560,
	"lastAppStart":1721840373560,
	"ipLocation":
{
	"ip":"94.198.40.106",
	"country":"DE",
	"city":"Frankfurt am Main"
}
,
	"adblockEnabled":true,
	"proxy":
{
	"supported":true,
	"enabled":true
}
}';
$ch = curl_init('https://www.rokkr.net/api/app/ping');
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_ENCODING, false);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $Login);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
'Host: www.rokkr.net',
'User-Agent: NetSurf/2.0 (Linux; i686)',
'Content-Type: application/json; charset=utf-8',
'Accept: application/json',
'Accept-Encoding: gzip, deflate',
'Accept-Language: tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
));
$site = curl_exec($ch);
curl_close ($ch);
preg_match('#"mhub":"(.*?)"#',$site,$icerik);
$Token = $icerik[1];

$Rokr = '{
	"language":"tr",
	"region":"DE",
	"url":"https://www.oha.to/oha-tv/play/'.$Live.'",
	"clientVersion":"3.0.2"
}';
$ch1 = curl_init('https://oha.to/oha-tv-resolver/mediaurl-resolve.json');
curl_setopt($ch1, CURLOPT_SSL_VERIFYHOST, false);
curl_setopt($ch1, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch1, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch1, CURLOPT_ENCODING, false);
curl_setopt($ch1, CURLOPT_POST, true);
curl_setopt($ch1, CURLOPT_POSTFIELDS, $Rokr);
curl_setopt($ch1, CURLOPT_HTTPHEADER, array(
'Host: oha.to',
'Content-Type: application/json; charset=utf-8',
"mediaurl-signature: $Token",
'User-Agent: NetSurf/2.0 (Linux; i686)',
'Accept: application/json',
'Accept-Encoding: gzip, deflate',
'Accept-Language: tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
));
$site1 = curl_exec($ch1);
curl_close ($ch1);
$site1 = str_replace('hls/index.m3u8','v.ts',$site1);
preg_match('#/sunshine/(.*?)"#',$site1,$icerik);
$Link = $icerik[1];
header ("Location: http://45.143.222.113:8008/sunshine/$Link");
?>