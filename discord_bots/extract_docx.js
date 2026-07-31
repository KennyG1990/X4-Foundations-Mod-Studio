import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const dirPath = 'F:\\DEV_ENV\\projects\\discord_bots\\extracted_northstar\\X4_DISCORD_SPACE_MUD\\01_NORTH_STAR';
const files = fs.readdirSync(dirPath);
const targetFile = files.find(f => f.endsWith('.docx'));
const docxPath = path.join(dirPath, targetFile);

console.log('Found docx file:', docxPath);

const psScript = `
$path = (Get-ChildItem -Path '${dirPath}' -Filter '*.docx')[0].FullName
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
[System.IO.File]::WriteAllText('F:\\DEV_ENV\\projects\\discord_bots\\northstar_extracted.txt', $text)
`;

fs.writeFileSync('extract.ps1', psScript, 'utf-8');
execSync('powershell -ExecutionPolicy Bypass -File extract.ps1');
const result = fs.readFileSync('northstar_extracted.txt', 'utf-8');
console.log('✅ Extracted text saved! Length:', result.length);
