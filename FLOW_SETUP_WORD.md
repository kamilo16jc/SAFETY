# SAFETY → SharePoint: forma de pesos en Word (SIN licencia premium)

La **app** rellena el Word en el navegador (client-side, con JSZip) y manda el
archivo ya lleno como base64. El flow solo lo **guarda** en SharePoint con
"Create file" — conector estándar, sin premium. Se elimina por completo la
acción "Populate a Microsoft Word template" que exigía licencia.

## Cambios en el flow (case `weight_seal`)

Abre **SAFETY - Official Forms → Edit** → entra al case cuyo Equals es `weight_seal`:

1. **Borra** la acción "Populate a Microsoft Word template" (los tres puntos → Delete).
2. **+ Add an action** → **"Create file"** (conector **SharePoint**):
   - **Site Address**: tu sitio.
   - **Folder Path**: `/Shared Documents/QC Forms`
   - **File Name** → expresión fx:
     ```
     body('Parse_JSON')?['data']?['filename']
     ```
   - **File Content** → expresión fx (convierte el base64 en el archivo binario):
     ```
     base64ToBinary(body('Parse_JSON')?['data']?['fileBase64'])
     ```
3. **Save**.

Eso es todo. No hay que subir ninguna plantilla a SharePoint: la plantilla vive
dentro de la app (`assets/weight_form_template.docx`) y se rellena en el
dispositivo.

## Probar

1. En la app: **Weight Log** → guarda uno o dos registros de hoy.
2. **Reports** → filtra la fecha de hoy → botón **"Fill Official Form → SharePoint"**.
3. La app muestra "Building form..." y luego "Form request sent ✓".
4. En unos segundos aparece `Weight_2026-07-13_L3_2nd.docx` en la carpeta
   **QC Forms** de SharePoint, lleno e idéntico a la forma oficial.

## (Opcional) PDF además del Word

Si quieres también el PDF: después del Create file agrega
**"Convert Word Document to PDF"** — OJO: esa conversión sí es premium. Sin
licencia, deja solo el Word (se imprime igual desde Word/SharePoint) o abre el
Word y "Guardar como PDF" al momento de imprimir.

## Payload que envía la app (formType `weight_seal`)

```json
{
  "source": "SAFETY", "client": "Caputo Foods", "formType": "weight_seal",
  "requestedBy": "JULIAN AGUDELO", "sentAt": "...",
  "data": {
    "date": "2026-07-13",
    "filename": "Weight_2026-07-13_L3_2nd.docx",
    "fileBase64": "UEsDBBQ...(el .docx ya lleno)"
  }
}
```

El Word se rellena en la app usando `assets/weight_form_template.docx`
(plantilla con marcadores `{{Token}}`) y `js/integrations/word-fill.js`.
