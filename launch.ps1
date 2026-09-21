[CmdletBinding()]
param(
  [switch]$NoBrowser,
  [switch]$PrepareOnly,
  [switch]$Offline,
  [ValidateRange(1024,65515)][int]$Port=8765,
  [string]$Cache='',
  [string]$ReadyFile=''
)
# Process-local execution policy only. No registry, service, game injection or administrator rights.
$ErrorActionPreference='Stop'
$env:PYTHONUTF8='1'
$env:PYTHONIOENCODING='utf-8'
$Root=Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $Root
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$Runtime=Join-Path $Root '.runtime\python'
$Python=Join-Path $Runtime 'python.exe'
$PythonVersion='3.12.10'
$DuckVersion='1.4.1'
$DuckHash='567f3b3a785a9e8650612461893c49ca799661d2345a6024dda48324ece89ded'
$UTF8=New-Object System.Text.UTF8Encoding($false)
function Download-Trusted([string]$Url,[string]$Output) {
  $uri=[Uri]$Url
  if ($uri.Scheme -ne 'https' -or $uri.Host -notin @('www.python.org','files.pythonhosted.org')) {throw 'Untrusted runtime source.'}
  Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Output -TimeoutSec 180
  if ((Get-Item -LiteralPath $Output).Length -lt 100000) {throw 'Downloaded runtime archive is unexpectedly small.'}
}
try {
  if (-not [Environment]::Is64BitOperatingSystem) {throw 'Windows x64 is required.'}
  if (-not (Test-Path -LiteralPath $Python)) {
    if ($Offline) {throw 'Offline launch: the portable Python runtime has not been prepared.'}
    Write-Host 'Downloading the pinned Python embeddable runtime from python.org over HTTPS.'
    $Stage=Join-Path $Root '.runtime\python-stage'
    if (Test-Path -LiteralPath $Stage) {Remove-Item -LiteralPath $Stage -Recurse -Force}
    New-Item -ItemType Directory -Force -Path $Stage | Out-Null
    $Archive=Join-Path $Root '.runtime\python.zip'
    Download-Trusted "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-embed-amd64.zip" $Archive
    Expand-Archive -LiteralPath $Archive -DestinationPath $Stage -Force
    if (-not (Test-Path -LiteralPath (Join-Path $Stage 'python.exe'))) {throw 'Python archive does not contain python.exe.'}
    if (Test-Path -LiteralPath $Runtime) {Remove-Item -LiteralPath $Runtime -Recurse -Force}
    Move-Item -LiteralPath $Stage -Destination $Runtime
    Remove-Item -LiteralPath $Archive -Force
  }
  [IO.File]::WriteAllLines((Join-Path $Runtime 'python312._pth'),@('python312.zip','.','site-packages',$Root,'import site'),$UTF8)
  $Site=Join-Path $Runtime 'site-packages'
  $DuckMarker=Join-Path $Site 'grim-duckdb-verified.json'
  if (-not (Test-Path -LiteralPath $DuckMarker)) {
    if ($Offline) {throw 'Offline launch: DuckDB has not been prepared.'}
    Write-Host 'Downloading DuckDB wheel; checking the pinned SHA-256.'
    $Manifest=Invoke-RestMethod -Uri "https://pypi.org/pypi/duckdb/$DuckVersion/json" -TimeoutSec 90
    $Wheel=$Manifest.urls | Where-Object {$_.filename -eq "duckdb-$DuckVersion-cp312-cp312-win_amd64.whl"} | Select-Object -First 1
    if (-not $Wheel -or ([Uri]$Wheel.url).Host -ne 'files.pythonhosted.org') {throw 'Compatible official DuckDB wheel was not found.'}
    if ($Wheel.digests.sha256 -ne $DuckHash) {throw 'PyPI checksum differs from pinned SHA-256.'}
    New-Item -ItemType Directory -Force -Path $Site | Out-Null
    $Archive=Join-Path $Root '.runtime\duckdb.zip'
    Download-Trusted $Wheel.url $Archive
    if ((Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $DuckHash) {Remove-Item -LiteralPath $Archive;throw 'DuckDB checksum mismatch.'}
    Expand-Archive -LiteralPath $Archive -DestinationPath $Site -Force
    Remove-Item -LiteralPath $Archive
    & $Python -c "import sys,duckdb; assert sys.version_info[:2]==(3,12); assert duckdb.__version__=='$DuckVersion'; assert duckdb.sql('select 42').fetchone()[0]==42"
    if ($LASTEXITCODE -ne 0) {throw 'The downloaded Python/DuckDB runtime failed its execution check.'}
    [IO.File]::WriteAllText($DuckMarker,(@{version=$DuckVersion;sha256=$DuckHash;verifiedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json),$UTF8)
  }
  & $Python -c "import sys,duckdb; assert sys.version_info[:3]==(3,12,10); assert duckdb.__version__=='$DuckVersion'; print('Runtime OK: Python '+sys.version.split()[0]+', DuckDB '+duckdb.__version__)"
  if ($LASTEXITCODE -ne 0) {throw 'Runtime check failed. Rename .runtime and retry preparation.'}
  if ($PrepareOnly) {Write-Host 'Runtime prepared. Database/browser checks have not run yet.';exit 0}
  $ArgsList=@((Join-Path $Root 'server.py'),'--port',[string]$Port)
  if ($NoBrowser) {$ArgsList+='--no-browser'}
  if ($Offline) {$ArgsList+='--offline'}
  if ($Cache) {$ArgsList+=@('--cache',$Cache)}
  if ($ReadyFile) {$ArgsList+=@('--ready-file',$ReadyFile)}
  Write-Host 'Starting Grim DPS Lab v3 on 127.0.0.1 only. Keep this console open.'
  & $Python @ArgsList
  if ($LASTEXITCODE -ne 0) {throw "Server exited with code $LASTEXITCODE"}
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host 'Read README_KO.md. No sample database is substituted when downloads fail.'
  exit 1
}
