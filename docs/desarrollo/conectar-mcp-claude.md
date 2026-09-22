# Conectar Field MCP con Claude

## Antes de empezar

Para probar un trabajador o subcontratista, debe existir en Field y tener un código de acceso activo para `/campo`. Para probar al propietario principal, se puede usar el email y la contraseña de la cuenta que creó la empresa en la pantalla segura de autorización. Las credenciales no se guardan y nunca deben enviarse por el chat de Claude.

## Configuración en Claude

1. Abra **Claude → Configuración → Conectores**.
2. Seleccione **Añadir conector personalizado** o **Custom connector**.
3. Introduzca esta URL MCP:

   ```text
   https://logiciel-construction.com/mcp
   ```

4. En **Cliente OAuth**, seleccione primero **Usar la identidad publicada de Claude**.
5. Si Claude completa el registro automáticamente, no debe introducir ningún Client ID manual.
6. Si esa opción no funciona o Claude solicita un Client ID, seleccione **Usa tu propio cliente OAuth** e introduzca exactamente:

   ```text
   mcp_client_f59f1cba-94d9-4f63-bb50-424910da142b
   ```

7. Deje **OAuth Client Secret** vacío.
8. Guarde el conector y pulse **Conectar**.
9. En la ventana de autorización de Field, compruebe que la aplicación solicita acceso de **solo lectura**.
10. Para trabajador o subcontratista, introduzca el código de acceso de `/campo`. Para el propietario principal, introduzca el email y la contraseña de la cuenta que creó la empresa.
11. Compruebe que la pantalla indica **solo lectura**.
12. Pulse **Autorizar acceso de solo lectura**.
13. Espere a que Claude vuelva automáticamente y confirme que el conector está conectado.

## Permisos de esta primera versión

El conector solo puede consultar la información que corresponde al trabajador autorizado y al negocio vinculado:

- agenda;
- órdenes de trabajo;
- proyectos asignados;
- tareas;
- horas registradas;
- documentos visibles para el trabajador.

El conector no puede crear, modificar ni borrar datos.

El propietario principal obtiene las lecturas administrativas permitidas por su plan, como resumen de empresa, facturas, cuentas por cobrar, pagos, gastos, rentabilidad y auditoría de QuickBooks. Los demás roles solo reciben el área que corresponda a su identidad y permisos.

## Si vuelve a abrir `/campo`

Cierre la ventana de autorización y elimine el conector incompleto en Claude. Vuelva a crearlo usando exactamente la URL MCP y el Client ID anteriores. No utilice la URL `/campo` como URL del conector.

La URL `/campo` es la aplicación normal del trabajador; no es la URL del servidor MCP. La ruta `/api/mcp` continúa disponible para clientes antiguos, pero Claude debe usar la ruta pública `/mcp`.

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

Cualquier otra plataforma que se añada en el futuro necesita su propio Client ID y su propia URI de retorno. El Client ID de Claude no se reutiliza: hacerlo manda a la persona a una autorización que no vuelve.
