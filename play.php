<?php
$output = $_REQUEST['output'];
$country = $_REQUEST['country'];
$countries = ['Albania', 'Arabia', 'Balkans', 'Bulgaria', 'Brance', 'Germany', 'Italy', 'Netherlands', 'Poland', 'Portugal', 'Spain', 'Romania', 'Russia', 'Turkey', 'United Kingdom', 'All'];
class Functions{
	public static function Token(){
		$vec = 'H+OSns5MwebMC4qomFO+p5IFJSybslfV/PJp3Eje+tUx63Hkpp0RjA1iF2jVMnLHwbeWegfhlgxXgYG6w0bylZq1jHs0LmiGbJ7hJweyTMIV9GhD+Pu+5WsasAYxyzZxP7Ef/vTn4QxFdjdEZvHldGbzBviZQAvJz7Rbs4zNRar7m+YSslQP37rB/rOx5WzVH6II8+VWlTRI0K6Chesivc0iCWATgoPSaqd7o++aEBILn4rPAatYyV+ZYePoizcOxmQIDZEmyVzPslfCqfT7nXD/QV2KQ3XyHToW8C/7wguiEGltk6pnha66EOq/+uG8XDQVCZHUQOe464fh8m3R5RjcBY4NCEgdqyVDdk0jBcWDGnwqXDRHmYZnd4ljU9UsbHROV9KwjrA3fkCA83jkL+QeV6YrwnkCqP1hfl+mm2DVkHfHW52k76tdAT/H+KoPnmuuWqY6bpz8tCLMD41DD/8QsodtxC98BlMbGaYRXU0KEg/mX7hY80KZGPiUHjgUlkayqUdfVjKj1z09Sa58PiVLXykrH/NcVxGRJxOCSvsFdENcU3Ljf7psVDtyI+d71anVTbKlnl4PQtOERiW1C0zmL957hSVX0cs2q+1QunmUZ/sro9oiOkVxn0Ybadf4Rxuao5FciydEFSftO6H84cgB2UFvKuEYfaMbPumANo77g3oxWSkUPrBIz2KeP69fqUCrYTBQcWYgdtFdf6lg1Sib9JS4hNImNMK/Gw8v3tp9MerMmTqpbAmVrEEWClZsFvsIaliqjZffagRV/i51cpF1xgUQ2KAqpnzCIq8/vQVtccLvyQX9ZO2NQRCwclg+AHWA2XzwNeKuWHcr4ODJMRTeLTo1iHV3j/EnqI8nivHi+B1yOBRkVQ4BzSNtow9R2Me3gFE9bcuHOaMjYQb2mvO7Bhk/8nIMBB15jbxC3DqALErA2Dr92/0jiTE1e6Z0NWu2aasKhQgLlMTVXZpC1piNyIqQAGQNeD100bs4ADYkYui+DTNKwEthA9vT0LDB4HULtU8B+ndsp/JAV5MJKDlhjVIl9lbIcMxHXW66fNiOcK5N2zhvVXp4Etlr2VMnmcu3hXMbeP9kNtNFYLSUC8dRZbIdrKDVThucO5RD90C8DvMITTz2e/vs3fQwYayEUTrtGzJCr+kPKDYHPG/tk9/i1w/lJcdmn9Z5Sh71CDJx1e1nO2iay6LKsjoQHHw/Ux9clugETmJxGwv+KLdUyncYY7HZYZ5V3gEwIXIHim0L4kPyKp5OLfjQ6R5EmjS8fdzdPjWB7fjkdjtplFSBOcLlNe7bjQtlm6Cne7SC8s19FS8Gunk5A3oP0KRTlxQopC4jNcGkEeqeywxLwbp1iv9Gr3cMSpUkl/kpRV/b/ETpgnuKBjgwDw92faL15nsUj1wDe3rIGImJikaYoRX9z5ahMm5mRzQyfJajslfxiQdWpXpNTT+QlHCzC/mw/v0nCUGmboj5ufX8TGyq7cpSyQgRCOTT85kN3RYmZEIDRPSpF82mfSkvrkNS0c00bwdA0dA4vXf1++2L5Jhhu0mBP/IY3Af3w2tFURThdoSrrWO/7z5fb1g+nfqaDeThAVjSki7oNMGMgLxwWdvhnlrOetDktdzoaFuGzJxuP5LKRu7BNIWlywGBU5UgggvIdh0YrxRCCmlOKwUoTQg5pdQqTc2Ryau5f2ImcwSxVFo4iDm6faZdrOplowJ20+WwxPqzf6SLq8bcBe9PMFAHDbGv9D03EZmGKzR3z1VwueYCMtOy5qEOxRZ58pcWObj9g7hp+m2RLduYEqc6LFWZ31R7wpJcWgPMvFkk02ZNWJZUw22pFBUjVB4AzQaGmHrX0q2D24hjDLg8qpnO7nQHzp/ieYm17bvY59/J9crBtgUYrm2O3d/NCH7T3DfAH6psd/ENAytHRD+Qe3K+yGwdeDMi2Q==';
		$ch = curl_init('https://www.vavoo.tv/api/box/ping2');
		curl_setopt($ch, CURLOPT_POST, 1);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($ch, CURLOPT_USERAGENT,'VAVOO/2.6(win*dows NT 10.0.17134; WOW64) Kodi_Fork_VAVOO/1.0 App_Bitness/32 Version/2.6');
		curl_setopt($ch, CURLOPT_HTTPHEADER,array("Content-Type: application/json","accept: application/json"));
		curl_setopt($ch, CURLOPT_POSTFIELDS, '{"vec": "'.$vec.'"}');
		$signed=(json_decode(curl_exec($ch))->response->signed);
		curl_close($ch);
		return $signed;
	}

	public static function Channels(){
		global $country;
		$token = Functions::Token();
		$file = json_decode(file_get_contents('http://vavoo.to/live2/index?output=json'));
		if ($file !== false) {
			echo "#EXTM3U \r\n";
			header("Content-Type: application/octet-stream");
			header('Content-disposition: attachment; filename="'. $country .'.m3u"');
			header('Connection:keep-alive');
			header("Content-Transfer-Encoding: binary");
			header('Pragma: no-cache');
			header('Expires: 0');
			$ex = explode('-', $country);
			foreach ($file as $item) {
				if ($country == 'All') {
					echo "#EXTVLCOPT:http-user-agent=VAVOO/2.6\r\n";
					echo '#EXTINF:0 user-agent="VAVOO/2.6" ';
					echo 'tvg-country="' . $item->group . '" ';
					echo 'tvg-id="' . $item->tvg_id . '" ';
					echo 'tvg-name="' . $item->name . '" ';
					echo 'tvg-logo="' . $item->logo . '" ';
					echo 'group-title="' . $item->group . '",';
					echo $item->name . "\r\n";
					echo "#EXTVLCOPT:http-user-agent=VAVOO/2.6\r\n";
					echo $item->url."?n=1&b=5&vavoo_auth=". $token . "\r\n";
				}else{
					for ($i=0; $i < count($ex); $i++) { 
						if ($item->group == $ex[$i]) {
							echo "#EXTVLCOPT:http-user-agent=VAVOO/2.6\r\n";
							echo '#EXTINF:0 user-agent="VAVOO/2.6" ';
							echo 'tvg-country="' . $item->group . '" ';
							echo 'tvg-id="' . $item->tvg_id . '" ';
							echo 'tvg-name="' . $item->name . '" ';
							echo 'tvg-logo="' . $item->logo . '" ';
							echo 'group-title="' . $item->group . '",';
							echo $item->name . "\r\n";
							echo "#EXTVLCOPT:http-user-agent=VAVOO/2.6\r\n";
							echo $item->url."?n=1&b=5&vavoo_auth=". $token . "\r\n";
						}

					}
				}
				
			}
		}
	}
}

if ($country !== null && $output !== null) {
	if ($output == 'm3u') {
		$x = explode('-', $country);
		for ($i=0; $i < count($x); $i++) { 
			if (!in_array($x[$i], $countries))
			{
				header("Content-Type: application/json");
				echo json_encode('Belirtilen ülke bulunamadı.',JSON_UNESCAPED_UNICODE);
				die();
			}
		}
		Functions::Channels();
		die();
	}else{
		header("Content-Type: application/json");
		echo json_encode('Output belirtilmedi.',JSON_UNESCAPED_UNICODE);
		die();
	}
}
?>