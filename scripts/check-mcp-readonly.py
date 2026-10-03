#!/usr/bin/env python3
"""Check the non-negotiable invariants of the MCP server.

Reading never writes. Writing (Phase B) only ever prepares a draft inside the
tool and executes it from server/mcpAcciones.ts on confirm_action, and every
such tool is marked `escritura: true` so only the primary owner who granted
mcp:write can see it.
"""
from pathlib import Path
import re

mcp = Path("server/mcp.ts").read_text(encoding="utf-8")
oauth = Path("server/mcpOAuth.ts").read_text(encoding="utf-8")
roles = Path("shared/mcpRoles.ts").read_text(encoding="utf-8")
acciones = Path("server/mcpAcciones.ts").read_text(encoding="utf-8")
doc = Path("docs/desarrollo/mcp-trabajadores.md").read_text(encoding="utf-8")

names = re.findall(r'server\.registerTool\(\s*"([^"]+)"', mcp)
print("MCP tools:", ", ".join(names))
if not names:
    raise SystemExit("No MCP tools found")

read_only_exceptions = {"audit_quickbooks_sync"}
# Calcular y comprobar contestan con aritmética sobre lo que ya hay o sobre lo
# que trae la persona; no guardan nada. El guardia de mutaciones de abajo es
# el que lo garantiza, no el nombre.
READ_ONLY_PREFIXES = ("get_", "calculate_", "check_")
# Phase B: the only tools that lead to a write. They prepare a draft; nothing
# is created until confirm_action.
WRITE_PREFIXES = ("draft_",)
write_actions = {"confirm_action", "cancel_action"}
write_names = [name for name in names if name.startswith(WRITE_PREFIXES) or name in write_actions]
non_read_names = [
    name for name in names
    if not name.startswith(READ_ONLY_PREFIXES) and name not in read_only_exceptions and name not in write_names
]
if non_read_names:
    raise SystemExit(f"MCP tools that are neither read-only nor draft/confirm: {', '.join(non_read_names)}")

for name in write_names:
    entry = re.search(rf'^\s*{re.escape(name)}:\s*\{{([^}}]*)\}}', roles, re.M)
    if not entry or "escritura: true" not in entry.group(1):
        raise SystemExit(f"{name} prepares or executes a write but is not marked escritura: true in TOOL_ACCESS")
if "if (access.escritura && !identity.escritura) return false" not in roles:
    raise SystemExit("puedeUsarHerramienta no longer denies write tools without the mcp:write grant")
for name in names:
    if name in write_names:
        continue
    entry = re.search(rf'^\s*{re.escape(name)}:\s*\{{([^}}]*)\}}', roles, re.M)
    if entry and "escritura" in entry.group(1):
        raise SystemExit(f"{name} is a read tool but carries an escritura flag")
if "propietarioPrincipal === true" not in mcp:
    raise SystemExit("The mcp:write grant is not re-checked against the primary owner on every call")
if '.eq("estado", "awaiting_confirmation")' not in acciones:
    raise SystemExit("confirm_action no longer takes the draft atomically (awaiting_confirmation -> running)")

start = mcp.index("function createMcpServer")
end = mcp.index("export function mcpHandler", start)
tool_source = mcp[start:end]
# Audit writes and Phase B drafts are intentionally outside createMcpServer
# (audit() and server/mcpAcciones.ts). Any mutation here would be a tool that
# changes data without a confirmed draft.
mutations = re.findall(r'\.(?:insert|update|upsert|delete)\s*\(', tool_source)
if mutations:
    raise SystemExit("Data mutation found inside MCP tool registration")

query_count = len(re.findall(r'\.from\("', tool_source))
business_filters = len(re.findall(r'\.eq\("business_id",', tool_source))
if query_count != business_filters:
    raise SystemExit(
        f"Every MCP query must filter business_id: {query_count} queries, {business_filters} filters"
    )

if 'const DEFAULT_SCOPE = "mcp:read"' not in oauth:
    raise SystemExit("MCP OAuth default scope is not mcp:read")
if '!scopes.includes("mcp:read")' not in mcp or 's !== "mcp:read" && s !== "mcp:write"' not in mcp:
    raise SystemExit("MCP token validation does not require mcp:read and refuse unknown scopes")
if "allow_write" not in oauth or "identity.propietarioPrincipal" not in oauth:
    raise SystemExit("mcp:write is no longer granted only to the primary owner who ticks the box")
casilla = re.search(r'<input[^>]*name="allow_write"[^>]*>', oauth)
if not casilla or "checked" in casilla.group(0):
    raise SystemExit("The mcp:write box on the consent page must exist and start unticked")
if "solo lectura" not in doc.lower() or "ninguna identidad mcp" not in doc.lower() or "confirm_action" not in doc:
    raise SystemExit("The read-only / confirmed-write policy is missing from documentation")

print(f"MCP contract: OK ({len(names)} tools, {len(write_names)} draft/confirm, {query_count} scoped queries)")
