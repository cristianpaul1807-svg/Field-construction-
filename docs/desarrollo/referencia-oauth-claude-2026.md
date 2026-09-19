# Referencia verificada: Claude y OAuth MCP

Fuentes oficiales consultadas el 19 de septiembre de 2026:

- https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- https://docs.anthropic.com/en/docs/claude-code/mcp

La documentación de Claude confirma que los conectores remotos MCP usan OAuth cuando el servidor lo requiere. Para conectores personalizados Claude ofrece tres modos de identidad OAuth: identidad publicada de Claude, registro dinámico y cliente propio. También confirma que el servidor debe ser público porque las conexiones remotas se originan desde la infraestructura de Anthropic.

La documentación de Claude Code confirma soporte para OAuth remoto, descubrimiento mediante `WWW-Authenticate`, Dynamic Client Registration y Client ID Metadata Documents (CIMD). Si DCR no funciona, Claude admite credenciales OAuth preconfiguradas. La documentación distingue los callbacks locales de Claude Code de los conectores alojados en claude.ai; no se debe reutilizar un callback localhost para el conector web.

Field anuncia `client_id_metadata_document_supported: true` y acepta CIMD únicamente desde orígenes `claude.ai` o `anthropic.com`, además de conservar DCR y cliente propio como alternativas.
