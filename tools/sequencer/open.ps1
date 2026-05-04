# Open URL in default Windows browser. URL passed as -File parameter so
# PowerShell does not parse `&` in query strings as a shell operator.
# Usage from WSL:
#   powershell.exe -ExecutionPolicy Bypass -File "$(wslpath -w tools/sequencer/open.ps1)" -Url "https://example.com/?a=1&b=2"
param(
    [Parameter(Mandatory=$true)] [string]$Url
)
Start-Process $Url
Write-Host "[open_url] $Url"
