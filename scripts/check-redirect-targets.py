#!/usr/bin/env python3
"""Every URL the server sends a person back to must be a screen that exists.

Stripe's onboarding return_url said /settings/pagos while the route is
/settings/payments, so every contractor who finished handing Stripe their bank
details landed on a 404. Nothing failed, nothing logged, and the only way to
find it was to walk the flow.

These redirects are the one kind of link that typechecking cannot see: a string
on the server naming a route on the client. So they get checked here.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "client" / "src" / "App.tsx"
SERVER = ROOT / "server"

# path={"/settings/payments"} -> /settings/payments
ROUTE_RE = re.compile(r'path=\{"([^"]+)"\}')
# `${baseUrl}/portal?pago=exitoso` -> /portal
REDIRECT_RE = re.compile(r"\$\{baseUrl\}(/[A-Za-z0-9/_\-:]*)")


def declared_routes() -> set[str]:
    return set(ROUTE_RE.findall(APP.read_text(encoding="utf-8")))


def matches(target: str, routes: set[str]) -> bool:
    if target in routes:
        return True
    # wouter params: /crm/:id accepts /crm/anything
    target_parts = target.strip("/").split("/")
    for route in routes:
        route_parts = route.strip("/").split("/")
        if len(route_parts) != len(target_parts):
            continue
        if all(r.startswith(":") or r == t for r, t in zip(route_parts, target_parts)):
            return True
    return False


def main() -> int:
    routes = declared_routes()
    problems = []

    for path in sorted(SERVER.rglob("*.ts")):
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            for target in REDIRECT_RE.findall(line):
                if not matches(target, routes):
                    problems.append(f"{path.relative_to(ROOT)}:{number}  ->  {target}")

    if problems:
        print("These redirects point at screens that do not exist in App.tsx:\n")
        for problem in problems:
            print(f"  {problem}")
        print(f"\nDeclared routes: {', '.join(sorted(routes))}")
        return 1

    print("redirect targets ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
