# Move mouse to (X,Y) and click. Coordinates are screen-absolute.
# Usage from WSL:
#   powershell.exe -ExecutionPolicy Bypass -File "$(wslpath -w tools/sequencer/click.ps1)" -X 500 -Y 300
#   powershell.exe -ExecutionPolicy Bypass -File "...click.ps1" -X 500 -Y 300 -Button right
param(
    [Parameter(Mandatory=$true)] [int]$X,
    [Parameter(Mandatory=$true)] [int]$Y,
    [string]$Button = "left",
    [int]$StartDelayMs = 800
)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -MemberDefinition @"
[DllImport("user32.dll")]
public static extern bool SetCursorPos(int x, int y);
[DllImport("user32.dll", CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);
"@ -Name MouseHelper -Namespace SeqUtil

Start-Sleep -Milliseconds $StartDelayMs
[SeqUtil.MouseHelper]::SetCursorPos($X, $Y)
Start-Sleep -Milliseconds 80

switch ($Button) {
    "right" {
        [SeqUtil.MouseHelper]::mouse_event(0x0008, 0, 0, 0, 0)  # right down
        Start-Sleep -Milliseconds 30
        [SeqUtil.MouseHelper]::mouse_event(0x0010, 0, 0, 0, 0)  # right up
    }
    default {
        [SeqUtil.MouseHelper]::mouse_event(0x0002, 0, 0, 0, 0)  # left down
        Start-Sleep -Milliseconds 30
        [SeqUtil.MouseHelper]::mouse_event(0x0004, 0, 0, 0, 0)  # left up
    }
}
Write-Host "[click] $Button at ($X, $Y)"
