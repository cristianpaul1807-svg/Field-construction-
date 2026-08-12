#!/usr/bin/env python3
"""Checks every API route against the auth gate in server/api.ts.

`apiRouter.use(requireBusinessAuth)` splits the file: everything above it is
public or brings its own middleware, everything below is the business panel.
Registering a client-portal or worker route below that line silently breaks it
with a 401 — it has happened more than once, and nothing in the type system
catches it, because both halves compile identically.

Run it before you finish:  python3 scripts/check-route-gate.py
"""
import re
import sys
import pathlib

API = pathlib.Path(__file__).resolve().parent.parent / "server" / "api.ts"

# Routes above the gate that legitimately have no middleware: the health probe
# and the two credential exchanges, which are how a worker or a code-entry
# client gets a token in the first place.
PUBLIC_BY_DESIGN = {"/health", "/worker-auth/login", "/client-auth/login"}

# Prefixes that mean "not the business panel".
NON_PANEL = ("/public/", "/client-portal/", "/client/", "/worker/", "/c/")

# ...except this one, which is the admin's preview of a client's portal and is
# scoped by req.businessId. Its prefix lies; the comment above it explains why.
PANEL_DESPITE_PREFIX = {"/client-portal/:clientId"}

OWN_MIDDLEWARE = ("requireClientAuth", "requireWorkerAuth", "requireAuthenticatedUser")


def main() -> int:
    lines = API.read_text().split("\n")
    try:
        gate = next(i for i, l in enumerate(lines) if "apiRouter.use(requireBusinessAuth)" in l)
    except StopIteration:
        print("could not find apiRouter.use(requireBusinessAuth)")
        return 1

    problems = []
    for i, line in enumerate(lines):
        match = re.match(r'\s*"(/[^"]*)",\s*$', line)
        if not match:
            continue
        if i == 0 or not re.search(r"apiRouter\.(get|post|patch|put|delete)\($", lines[i - 1].strip()):
            continue

        path = match.group(1)
        above = i < gate
        non_panel = path.startswith(NON_PANEL) and path not in PANEL_DESPITE_PREFIX
        guarded = any(mw in lines[i + 1] for mw in OWN_MIDDLEWARE)

        if above and not non_panel and not guarded and path not in PUBLIC_BY_DESIGN:
            problems.append(f"{API.name}:{i + 1}  {path} is above the gate with no middleware — it is wide open")
        if not above and non_panel:
            problems.append(f"{API.name}:{i + 1}  {path} is below the gate — clients and workers will get a 401")

    for problem in problems:
        print(problem)
    print("route gate ok" if not problems else f"{len(problems)} misplaced route(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
