# Send a SendKeys macro string (e.g. "^v" for Ctrl+V, "^{ENTER}" for
# Ctrl+Enter, "{TAB}" for Tab) to the currently focused Windows window.
# No char-escaping — caller is expected to pass a valid SendKeys macro.
# Usage from WSL:
#   powershell.exe -ExecutionPolicy Bypass -File "$(wslpath -w tools/sequencer/key.ps1)" -Macro "^v"
param(
    [Parameter(Mandatory=$true)] [string]$Macro,
    [int]$StartDelayMs = 200
)
Add-Type -AssemblyName System.Windows.Forms

Start-Sleep -Milliseconds $StartDelayMs
[System.Windows.Forms.SendKeys]::SendWait($Macro)
Write-Host "[key] sent '$Macro'"
