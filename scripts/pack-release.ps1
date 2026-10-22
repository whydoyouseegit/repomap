$ErrorActionPreference = 'Stop'
$version = (Get-Content 'package.json' -Raw | ConvertFrom-Json).version
$stage = Join-Path $env:RUNNER_TEMP "Repo-Map-Release-Pack-$version"
if (Test-Path $stage) { throw "Release staging directory already exists: $stage" }
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item "release/Repo-Map-Setup-$version-x64.exe" $stage
Copy-Item "release/Repo-Map-Source-$version.zip" $stage
Copy-Item 'docs/QUICK_START.txt' (Join-Path $stage 'README.txt')
$sums = Get-ChildItem $stage -File | Sort-Object Name | ForEach-Object {
  $hash = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  "$hash  $($_.Name)"
}
Set-Content -Path (Join-Path $stage 'CONTENTS-SHA256.txt') -Value $sums -Encoding utf8
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath "release/Repo-Map-Release-Pack-$version.zip" -CompressionLevel NoCompression
Write-Output "Release pack: Repo-Map-Release-Pack-$version.zip"
