# install-pipeline-tools.ps1 — последовательная установка инструментов 0-слоя в venv.
$ErrorActionPreference = 'Continue'
$py = 'C:\Users\tim\Desktop\gods-eye-view-main\platform\pipeline-server\.pipeline-venv\Scripts\python.exe'
$log = 'C:\Users\tim\Desktop\gods-eye-view-main\.gev-logs\pipeline-install.log'
function Log($m) { Add-Content -Path $log -Value "[$([DateTime]::Now.ToString('HH:mm:ss'))] $m" }

Log '=== install: start ==='
Log '--- bbot ---'
& $py -m pip install --quiet bbot 2>&1 | Out-Null
Log "bbot rc=$LASTEXITCODE"
Log '--- theHarvester ---'
& $py -m pip install --quiet theHarvester 2>&1 | Out-Null
Log "theHarvester rc=$LASTEXITCODE"
Log '--- snscrape ---'
& $py -m pip install --quiet snscrape 2>&1 | Out-Null
Log "snscrape rc=$LASTEXITCODE"
Log '--- tgspyder (git) ---'
$src = 'C:\Users\tim\Desktop\gods-eye-view-main\platform\pipeline-server\.work\.tgspyder-src'
if (Test-Path $src) { Remove-Item $src -Recurse -Force }
git clone --depth 1 https://github.com/Darksight-Analytics/tgspyder.git $src 2>&1 | Out-Null
Log "git clone rc=$LASTEXITCODE"
& $py -m pip install --quiet $src 2>&1 | Out-Null
Log "tgspyder install rc=$LASTEXITCODE"
Log '=== install: done ==='