# Conectar Field MCP con Claude

## Antes de empezar

La empresa debe tener un trabajador de campo creado en Field y ese trabajador debe tener un código de acceso activo para `/campo`. El código no se debe enviar por el chat de Claude ni por correo sin protección. Solo se debe introducir en la pantalla segura de autorización de Field.

## Configuración en Claude

1. Abra **Claude → Configuración → Conectores**.
2. Seleccione **Añadir conector personalizado** o **Custom connector**.
3. Introduzca esta URL MCP:

   ```text
   https://logiciel-construction.com/api/mcp
   ```

4. Abra **Configuración avanzada → OAuth**.
5. Active OAuth.
6. En **OAuth Client ID**, introduzca exactamente:

   ```text
   mcp_client_f59f1cba-94d9-4f63-bb50-424910da142b
   ```

7. Deje **OAuth Client Secret** vacío.
8. Guarde el conector y pulse **Conectar**.
9. En la ventana de autorización de Field, compruebe que la aplicación solicita acceso de **solo lectura**.
10. Introduzca el código de acceso del trabajador de `/campo`.
11. Pulse **Autorizar acceso de solo lectura**.
12. Espere a que Claude vuelva automáticamente y confirme que el conector está conectado.

## Permisos de esta primera versión

El conector solo puede consultar la información que corresponde al trabajador autorizado y al negocio vinculado:

- agenda;
- órdenes de trabajo;
- proyectos asignados;
- tareas;
- horas registradas;
- documentos visibles para el trabajador.

El conector no puede crear, modificar ni borrar datos.

## Si vuelve a abrir `/campo`

Cierre la ventana de autorización y elimine el conector incompleto en Claude. Vuelva a crearlo usando exactamente la URL MCP y el Client ID anteriores. No utilice la URL `/campo` como URL del conector.

La URL `/campo` es la aplicación normal del trabajador; no es la URL del servidor MCP.

## Si Claude muestra un error OAuth

Compruebe primero:

- que la URL sea exactamente `https://logiciel-construction.com/api/mcp`;
- que el Client ID esté copiado completo;
- que el Client Secret esté vacío;
- que el trabajador tenga un código de acceso activo;
- que no se haya pegado el código de trabajador en Claude, sino únicamente en la pantalla de Field.

Si el error continúa, elimine el conector incompleto y créelo de nuevo. No genere otro Client ID manualmente para Claude: el Client ID anterior ya está registrado con la URI de retorno oficial de Claude.

## Otras plataformas de IA

El Client ID anterior es **exclusivo de Claude** porque está asociado a la URI de retorno de Claude:

```text
https://claude.ai/api/mcp/auth_callback
```

ChatGPT, Manus u otra plataforma deben utilizar un Client ID diferente y su propia URI de retorno. No se debe reutilizar el Client ID de Claude en otra plataforma.
