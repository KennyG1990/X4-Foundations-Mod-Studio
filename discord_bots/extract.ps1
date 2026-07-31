
$path = (Get-ChildItem -Path 'F:\DEV_ENV\projects\discord_bots\extracted_northstar\X4_DISCORD_SPACE_MUD\01_NORTH_STAR' -Filter '*.docx')[0].FullName
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($path)
$entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' }
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$xml = $reader.ReadToEnd()
$reader.Close()
$stream.Close()
$zip.Dispose()
$text = $xml -replace '<w:p[ >]', [Environment]::NewLine -replace '<[^>]+>', ''
[System.IO.File]::WriteAllText('F:\DEV_ENV\projects\discord_bots\northstar_extracted.txt', $text)
