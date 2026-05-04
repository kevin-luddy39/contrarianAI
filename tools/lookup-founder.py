#!/usr/bin/env python3
"""
Hunter.io founder lookup. Ranks contacts by title-match for cold-email targeting.

Usage:
  HUNTER_API_KEY=... python tools/lookup-founder.py <domain>
  python tools/lookup-founder.py <domain>   # reads key from /tmp/hunterkey

Output: ranked list of contacts (highest-priority first), JSON-ready for
copying into manual-contacts.json or for finalizing cold emails.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

PRIORITY = [
    ("founder", 100), ("co-founder", 100), ("cofounder", 100),
    ("ceo", 95), ("chief executive", 95),
    ("cto", 90), ("chief technology", 90),
    ("vp engineering", 80), ("vp eng", 80), ("head of engineering", 80),
    ("head of product", 70), ("vp product", 70),
    ("principal engineer", 60), ("staff engineer", 55),
    ("engineering manager", 50), ("director of engineering", 50),
]


def score(position: str) -> int:
    p = (position or "").lower()
    for keyword, weight in PRIORITY:
        if keyword in p:
            return weight
    return 0


def get_key() -> str:
    k = os.environ.get("HUNTER_API_KEY", "").strip()
    if k:
        return k
    for path in [
        os.path.expanduser("~/.config/contrarianai/hunter.key"),
        "/tmp/hunterkey",
    ]:
        try:
            with open(path) as f:
                return f.read().strip()
        except FileNotFoundError:
            continue
    sys.exit("ERR: no HUNTER_API_KEY env var, no ~/.config/contrarianai/hunter.key, no /tmp/hunterkey. Provide one.")


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python tools/lookup-founder.py <domain>")
    domain = sys.argv[1]
    key = get_key()

    url = "https://api.hunter.io/v2/domain-search?" + urllib.parse.urlencode({
        "domain": domain,
        "api_key": key,
        "limit": 10,
    })
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            data = json.load(r)
    except Exception as e:
        sys.exit(f"ERR: API call failed: {e}")

    d = data.get("data") or {}
    emails = d.get("emails") or []
    company_name = d.get("organization") or domain
    pattern = d.get("pattern") or "(unknown email pattern)"

    ranked = sorted(
        ({
            "score": score(e.get("position")),
            "name": " ".join(p for p in [e.get("first_name"), e.get("last_name")] if p) or "(no name)",
            "email": e.get("value"),
            "position": e.get("position") or "(no title)",
            "type": e.get("type"),
            "confidence": e.get("confidence"),
            "linkedin": e.get("linkedin"),
        } for e in emails),
        key=lambda x: -x["score"],
    )

    print(f"=== {company_name} ({domain}) ===")
    print(f"email pattern: {pattern}")
    print(f"total emails returned: {len(emails)}")
    print()
    print(f"{'Score':>5}  {'Name':<28} {'Email':<40} {'Title':<35}  Conf")
    print("-" * 130)
    for r in ranked[:25]:
        print(f"{r['score']:>5}  {r['name'][:28]:<28} {(r['email'] or '')[:40]:<40} {r['position'][:35]:<35}  {r['confidence']}")

    print()
    print("=== TOP PICK (highest priority match) ===")
    if ranked and ranked[0]["score"] > 0:
        top = ranked[0]
        print(f"NAME:     {top['name']}")
        print(f"EMAIL:    {top['email']}")
        print(f"TITLE:    {top['position']}")
        print(f"LINKEDIN: {top['linkedin'] or '(not in Hunter)'}")
        print()
        print("PASTE-READY FORMAT for manual-contacts.json:")
        print(json.dumps({
            "name": top["name"],
            "company": company_name,
            "email": top["email"],
            "linkedin_url": top["linkedin"],
            "role": top["position"],
        }, indent=2))
    else:
        print("No founder/exec match. Use generic hello@ or info@ from the list above.")


if __name__ == "__main__":
    main()
