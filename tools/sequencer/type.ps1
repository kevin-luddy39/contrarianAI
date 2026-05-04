# Type text into the currently focused Windows window using SendKeys.
# Browser sees KeyboardEvent.isTrusted = true (real OS-level synthetic input).
# Usage from WSL:
#   powershell.exe -ExecutionPolicy Bypass -File "$(wslpath -w tools/sequencer/type.ps1)" -Text "hello world"
#   powershell.exe -ExecutionPolicy Bypass -File "...type.ps1" -Text "hi" -DelayMs 30
param(
    [Parameter(Mandatory=$true)] [string]$Text,
    [int]$DelayMs = 15,
    [int]$StartDelayMs = 800
)
Add-Type -AssemblyName System.Windows.Forms

# Brief pause so user can focus the right window after triggering
Start-Sleep -Milliseconds $StartDelayMs

# SendKeys treats some chars as modifiers (+ ^ % ~ { } [ ]). Escape them.
$escaped = $Text -replace '([+^%~(){}\[\]])', '{$1}'

# Type char-by-char with jitter so it looks less robotic + lets focus catch up
$rand = New-Object System.Random
foreach ($ch in $escaped.ToCharArray()) {
    [System.Windows.Forms.SendKeys]::SendWait([string]$ch)
    Start-Sleep -Milliseconds ($DelayMs + $rand.Next(-5, 6))
}
Write-Host "[type] sent $($Text.Length) chars"
