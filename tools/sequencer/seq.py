#!/usr/bin/env python3
"""
Sequencer — execute a list of HID-style steps from a YAML/JSON queue file.

Step types:
  - {action: "open_url", url: "https://..."}             # Opens default browser
  - {action: "clip", text: "..."}                         # Push text to Windows clipboard
  - {action: "type", text: "...", delay_ms: 15}           # Type into focused window
  - {action: "click", x: 500, y: 300, button: "left"}     # Click at screen coords
  - {action: "key", combo: "ctrl+v"}                      # Send key combo via SendKeys
  - {action: "sleep", ms: 1500}                           # Pause
  - {action: "wait_for_user", prompt: "Focus Gmail then press Enter..."}

Usage:
  python tools/sequencer/seq.py queue.yaml          # run all steps
  python tools/sequencer/seq.py queue.yaml --dry    # print without executing
  python tools/sequencer/seq.py queue.yaml --step 2 # run from step index 2

The browser sees KeyboardEvent.isTrusted = true for type/key actions because
they ride OS-level SendKeys (real synthetic input, not Selenium-flagged).

Note: type/click/key only work when triggered FROM the Windows side or via
WSL-on-Windows (clip.exe + powershell.exe are required). On pure Linux this
exits with a clear error.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent
PS1_TYPE = ROOT / "type.ps1"
PS1_CLICK = ROOT / "click.ps1"
PS1_KEY = ROOT / "key.ps1"
PS1_OPEN = ROOT / "open.ps1"

KEY_COMBO_MAP = {
    "ctrl+v": "^v", "ctrl+c": "^c", "ctrl+a": "^a", "ctrl+x": "^x",
    "ctrl+s": "^s", "ctrl+t": "^t", "ctrl+w": "^w",
    "ctrl+enter": "^{ENTER}", "ctrl+shift+enter": "^+{ENTER}",
    "shift+tab": "+{TAB}",
    "enter": "{ENTER}", "tab": "{TAB}", "esc": "{ESC}",
    "down": "{DOWN}", "up": "{UP}", "left": "{LEFT}", "right": "{RIGHT}",
}


def have(cmd):
    return shutil.which(cmd) is not None


def need_windows_interop():
    if not have("clip.exe") or not have("powershell.exe"):
        sys.exit("ERR: requires WSL with clip.exe + powershell.exe (you're on pure Linux?)")


def wslpath_w(p: Path) -> str:
    """Convert WSL path → Windows path for powershell.exe -File."""
    r = subprocess.run(["wslpath", "-w", str(p)], capture_output=True, text=True, check=True)
    return r.stdout.strip()


def step_clip(text):
    subprocess.run(["clip.exe"], input=text, text=True, check=True)
    print(f"[clip] {len(text)} chars to clipboard")


def step_open_url(url):
    # URL passed via -File parameter so PowerShell does not parse `&` in
    # query strings as a shell call operator. cmd.exe /c start has the
    # same problem (treats & as command-chain separator).
    subprocess.run(
        [
            "powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
            "-File", wslpath_w(PS1_OPEN), "-Url", url,
        ],
        check=True,
    )


def step_type(text, delay_ms=15):
    args = [
        "powershell.exe", "-ExecutionPolicy", "Bypass", "-File", wslpath_w(PS1_TYPE),
        "-Text", text, "-DelayMs", str(delay_ms),
    ]
    subprocess.run(args, check=True)


def step_click(x, y, button="left"):
    args = [
        "powershell.exe", "-ExecutionPolicy", "Bypass", "-File", wslpath_w(PS1_CLICK),
        "-X", str(x), "-Y", str(y), "-Button", button,
    ]
    subprocess.run(args, check=True)


def step_key(combo):
    sk = KEY_COMBO_MAP.get(combo.lower())
    if sk is None:
        sys.exit(f"ERR: unknown key combo '{combo}'. Add to KEY_COMBO_MAP in seq.py.")
    # Reuse type.ps1 with no jitter for combos (single keystroke)
    args = [
        "powershell.exe", "-ExecutionPolicy", "Bypass", "-File", wslpath_w(PS1_TYPE),
        "-Text", sk, "-DelayMs", "0", "-StartDelayMs", "200",
    ]
    subprocess.run(args, check=True)


def step_sleep(ms):
    time.sleep(ms / 1000.0)
    print(f"[sleep] {ms}ms")


def step_wait_for_user(prompt, fallback_sleep_ms=4000):
    # When stdin is not a TTY (e.g. running from Claude Code's `!` shell or
    # any subprocess wrapper), input() EOFs immediately. Fall back to a timed
    # pause so the run completes — user can still see the prompt.
    if sys.stdin.isatty():
        input(f"\n>>> {prompt}\n>>> Press Enter to continue. ")
    else:
        print(f"\n>>> [no TTY — auto-pausing {fallback_sleep_ms}ms] {prompt}", flush=True)
        time.sleep(fallback_sleep_ms / 1000.0)


def execute(steps, start=0, dry=False):
    for i, s in enumerate(steps[start:], start=start):
        action = s.get("action")
        print(f"\n--- step {i}: {action} ---")
        if dry:
            print(json.dumps(s))
            continue
        try:
            if action == "clip":
                step_clip(s["text"])
            elif action == "open_url":
                step_open_url(s["url"])
            elif action == "type":
                step_type(s["text"], s.get("delay_ms", 15))
            elif action == "click":
                step_click(s["x"], s["y"], s.get("button", "left"))
            elif action == "key":
                step_key(s["combo"])
            elif action == "sleep":
                step_sleep(s["ms"])
            elif action == "wait_for_user":
                step_wait_for_user(s.get("prompt", "Continue?"))
            else:
                sys.exit(f"ERR step {i}: unknown action '{action}'")
        except subprocess.CalledProcessError as e:
            sys.exit(f"ERR step {i}: subprocess failed: {e}")


def load(path):
    p = Path(path)
    if not p.exists():
        sys.exit(f"ERR: queue file not found: {path}")
    raw = p.read_text()
    if path.endswith(".yaml") or path.endswith(".yml"):
        try:
            import yaml
            return yaml.safe_load(raw)
        except ImportError:
            sys.exit("ERR: pip install pyyaml, or use .json queue files")
    return json.loads(raw)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("queue", help="Path to .json or .yaml queue file")
    ap.add_argument("--dry", action="store_true", help="Print steps without executing")
    ap.add_argument("--step", type=int, default=0, help="Start at step index (0-based)")
    args = ap.parse_args()

    if not args.dry:
        need_windows_interop()
    steps = load(args.queue)
    if not isinstance(steps, list):
        sys.exit("ERR: queue must be a list of step dicts")
    execute(steps, start=args.step, dry=args.dry)
    print("\n=== sequencer done ===")


if __name__ == "__main__":
    main()
