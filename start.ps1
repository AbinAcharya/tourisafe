<# PowerShell helper to start the Tourisafe server and open the browser #>
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir
Write-Host "Starting Tourisafe (uvicorn) in a new PowerShell window..."
Start-Process powershell -ArgumentList "-NoExit","-Command","python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
Start-Sleep -Seconds 1
Write-Host "Opening browser to http://127.0.0.1:8000"
Start-Process "http://127.0.0.1:8000"
