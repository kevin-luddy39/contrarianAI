# Sequencer — WSL→Windows HID-level driver

Solves the recurring "I have to type and click things" friction in cold-email,
form-fill, and admin workflows. Built on `clip.exe` + `powershell.exe`
SendKeys, both already present in any WSL install. Browser sees
`KeyboardEvent.isTrusted = true` for typed input (real OS-level synthetic input,
not Selenium-flagged).

## Files

- `clip.sh` — push stdin or arg text to Windows clipboard
- `type.ps1` — type text into the currently focused Windows window
- `click.ps1` — click at screen coordinates (X, Y)
- `seq.py` — orchestrator that reads a queue file and runs steps in sequence

## Quickstart — Lineation cold email shape

```bash
# Push body to clipboard, then you Ctrl+V into Gmail
echo "body text..." | tools/sequencer/clip.sh

# OR write a queue file and run the full sequence
python3 tools/sequencer/seq.py tools/sequencer/queues/lineation.json
```

## Queue file format (JSON or YAML)

```json
[
  {"action": "open_url", "url": "https://mail.google.com/mail/u/0/#inbox?compose=new"},
  {"action": "wait_for_user", "prompt": "Click into the To: field, then press Enter"},
  {"action": "type", "text": "hello@lineation.ai"},
  {"action": "key", "combo": "tab"},
  {"action": "type", "text": "Partnership angle - distributional read on agent lineage"},
  {"action": "key", "combo": "tab"},
  {"action": "clip", "text": "long email body..."},
  {"action": "key", "combo": "ctrl+v"},
  {"action": "wait_for_user", "prompt": "Review then press Enter to send"},
  {"action": "key", "combo": "ctrl+enter"}
]
```

## Step types

| action | params | what it does |
|---|---|---|
| `open_url` | `url` | Opens default Windows browser |
| `clip` | `text` | Push text to Windows clipboard |
| `type` | `text`, `delay_ms?` | Type into focused window with jitter |
| `click` | `x`, `y`, `button?` | Click at screen coordinates |
| `key` | `combo` | Send key combo (ctrl+v, enter, tab, ...) |
| `sleep` | `ms` | Pause |
| `wait_for_user` | `prompt` | Pause for human ack (focus, review, etc) |

## Why not full HID hardware (Pi Pico)?

This stack already gets `isTrusted: true` from the OS. Hardware HID matters
only when (a) the target detects synthetic input via timing fingerprints, or
(b) you need cross-machine portability without WSL. Add Pi Pico LATER if any
of these become real problems. For 95% of cold-email / form-fill workflows,
this software stack is enough.

## Style mimicking (future)

`type.ps1` already adds ±5ms jitter per keystroke. To go further, log your
real typing for 10 min via `pynput.keyboard.Listener` (Windows-side), extract
the inter-keystroke interval distribution, and replace the uniform jitter in
`type.ps1` with samples from your actual cadence. Out of scope for v1.
