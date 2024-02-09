<?php
$Live = $_GET['HLS'];
$ch = curl_init(''.$Live.'');
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
'Connection: keep-alive',
'Upgrade-Insecure-Requests: 1',
'User-Agent: Links (0.98; Unix)',
'Referer: https://www.google.com/',
));
$site = curl_exec($ch);
curl_close ($ch);
$site = str_replace('\\','',$site);
preg_match('#"contentUrl":"(.*?)"#',$site,$icerik);
$Url = $icerik[1];

$ch1 = curl_init(''.$Url.'');
curl_setopt($ch1, CURLOPT_SSL_VERIFYHOST, false);
curl_setopt($ch1, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch1, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch1, CURLOPT_HTTPHEADER, array(
'Connection: keep-alive',
'Upgrade-Insecure-Requests: 1',
'User-Agent: Links (0.98; Unix)',
'Referer: https://www.google.com/',
));
$site1 = curl_exec($ch1);
curl_close ($ch1);
$site1 = str_replace('|none|','"Token":"',$site1);
$site1 = str_replace('|preload|','"',$site1);
$site1 = str_replace('|gomindex|','"Kalite":"',$site1);
$site1 = str_replace('|aboutlink|','"',$site1);
preg_match('#"Token":"(.*?)"#',$site1,$icerik);
$Link = $icerik[1];
preg_match('#"Kalite":"(.*?)"#',$site1,$icerik);
$HD = $icerik[1];
header ("Location: https://y3.5dk.org/storage/media/$Link-$HD.mp4/gomindex.m3u8");
?>