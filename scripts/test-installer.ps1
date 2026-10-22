$ErrorActionPreference = 'Stop'
$version = (Get-Content 'package.json' -Raw | ConvertFrom-Json).version
$installer = (Resolve-Path "release/Repo-Map-Setup-$version-x64.exe").Path
$installDir = Join-Path $env:RUNNER_TEMP 'RepoMapInstallerSmoke'
$exe = Join-Path $installDir 'Repo Map.exe'
if (Test-Path $installDir) { throw "Smoke installation directory already exists: $installDir" }

$setup = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installDir") -Wait -PassThru
if ($setup.ExitCode -ne 0) { throw "Installer failed: $($setup.ExitCode)" }
if (-not (Test-Path $exe)) { throw 'The installer did not create Repo Map.exe' }
if (-not (Test-Path (Join-Path $installDir 'resources/app.asar'))) { throw 'Application resources are missing' }
if (-not (Test-Path (Join-Path $installDir 'resources/icon.ico'))) { throw 'Runtime icon is missing' }

$application = Start-Process -FilePath $exe -PassThru
try {
  Start-Sleep -Seconds 7
  $application.Refresh()
  if ($application.HasExited) { throw "Installed application exited early: $($application.ExitCode)" }
  if ($application.MainWindowHandle -eq 0) { throw 'Installed application did not create a window' }
  Write-Output "Installed application is running: $($application.MainWindowTitle)"
} finally {
  if (-not $application.HasExited) { & taskkill.exe /PID $application.Id /T /F | Out-Null }
}

$uninstaller = Join-Path $installDir 'Uninstall Repo Map.exe'
if (-not (Test-Path $uninstaller)) { throw 'Uninstaller is missing' }
$remove = Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -PassThru
if ($remove.ExitCode -ne 0) { throw "Uninstaller failed: $($remove.ExitCode)" }
for ($i = 0; $i -lt 20 -and (Test-Path $exe); $i++) { Start-Sleep -Seconds 1 }
if (Test-Path $exe) { throw 'Uninstaller did not remove the application' }
Write-Output 'Silent installation, app launch and uninstallation passed'
