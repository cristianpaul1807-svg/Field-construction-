#!/usr/bin/env python3
"""Check the non-negotiable read-only invariants for MCP Phase 1."""
from pathlib import Path
import re

mcp = Path("server/mcp.ts").read_text(encoding="utf-8")
oauth = Path("server/mcpOAuth.ts").read_text(encoding="utf-8")
doc = Path("docs/desarrollo/mcp-trabajadores.md").read_text(encoding="utf-8")

names = re.findall(r'server\.registerTool\(\s*"([^"]+)"', mcp)
print("MCP tools:", ", ".join(names))
if not names:
    raise SystemExit("No MCP tools found")

non_read_names = [name for name in names if not name.startswith("get_")]
if non_read_names:
    raise SystemExit(f"Non-read-only MCP tool names found: {', '.join(non_read_names)}")

start = mcp.index("function createMcpServer")
end = mcp.index("export function mcpHandler", start)
tool_source = mcp[start:end]
# Audit writes are intentionally outside createMcpServer. Any mutation here
# would be a data-changing MCP tool and is forbidden during Phase 1.
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
if 'oauth.scope !== "mcp:read"' not in mcp:
    raise SystemExit("MCP token validation does not enforce mcp:read")
if "solo lectura" not in doc.lower() or "ninguna identidad mcp" not in doc.lower():
    raise SystemExit("Phase 1 read-only policy is missing from documentation")

print(f"MCP read-only contract: OK ({len(names)} tools, {query_count} scoped queries)")
