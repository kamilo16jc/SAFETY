# SAFETY → Power Automate → Formas oficiales (Excel/Word)

Arquitectura: **Firebase sigue siendo la base de datos.** Power Automate solo
se usa cuando tocas "Fill Official Form → SharePoint" en Reports: la app manda
los registros filtrados del día y el flow llena la plantilla oficial para
entregar en físico.

```
App SAFETY (Reports) ──POST JSON──▶ Flow HTTP ──▶ Copy file (plantilla)
                                        │
                                        ├─▶ Excel: Run script (Office Script llena celdas)
                                        ├─▶ Word: Populate a Microsoft Word template
                                        └─▶ (opcional) Convertir a PDF / enviar por correo
```

## 1. Crear el flow

1. Power Automate → **Create** → **Instant cloud flow** → trigger
   **"When an HTTP request is received"** (premium — ya tienes licencia).
2. Method: **POST**. En "Request Body JSON Schema" pega:

```json
{
  "type": "object",
  "properties": {
    "source":      { "type": "string" },
    "client":      { "type": "string" },
    "formType":    { "type": "string" },
    "requestedBy": { "type": "string" },
    "sentAt":      { "type": "string" },
    "data":        { "type": "object" }
  }
}
```

3. **IMPORTANTE — la app envía el body como `text/plain`** (necesario por CORS
   desde el navegador). Por eso el primer paso después del trigger debe ser
   una acción **Parse JSON** con:
   - Content: `json(triggerBody())`  *(expresión, no contenido dinámico)*
   - Schema: el mismo de arriba.

4. Agrega un **Switch** sobre `formType` del Parse JSON:
   - Case `weight_seal` → rama de la forma SQF 2.4.D.1.1
   - Case `gmp` → rama de la forma SQF 2.5.D.A
   - Case `test` → sin acciones (o un correo a ti mismo para probar)

## 2. Rama Excel (weight_seal) — patrón plantilla + Office Script

1. **Copy file** (SharePoint): copia la plantilla
   `Shared Documents/QC Templates/WeightForm_TEMPLATE.xlsx` a
   `Shared Documents/QC Forms/Weight_@{body('Parse_JSON')?['data']?['date']}.xlsx`
2. **Run script** (Excel Online Business): sobre el archivo copiado, ejecuta el
   Office Script `FillWeightForm` pasándole como parámetro:
   `string(body('Parse_JSON')?['data'])`
3. (Opcional) **Create file** versión PDF, o **Send an email** con el adjunto.

### Office Script de ejemplo (Excel → Automate → New Script → pegar y nombrar `FillWeightForm`)

Ajusta las referencias de celda a TU plantilla real:

```typescript
function main(workbook: ExcelScript.Workbook, dataJson: string) {
  const data = JSON.parse(dataJson) as {
    date: string; line: string; shift: string;
    weights: {
      time: string; line: number; shift: number; pkgLabel: string;
      vals: number[]; avg: number; compliance: number;
      lot: string; product: string; initials: string; comments: string;
    }[];
    seals: {
      time: string; line: number; shift: number; checks: { [k: string]: string };
      lot: string; product: string; initials: string;
    }[];
    temps: {
      checkpoint: string; time: string; temp: string; chop: string;
      plat: string; line6: string; completedBy: string;
    }[];
  };

  const sheet = workbook.getWorksheet("Form") ?? workbook.getFirstWorksheet();

  // --- Encabezado (ajusta celdas a tu plantilla) ---
  sheet.getRange("D3").setValue(data.date);
  sheet.getRange("H3").setValue(data.shift === "all" ? "" : data.shift);
  sheet.getRange("K3").setValue(data.line === "all" ? "" : data.line);

  // --- Filas de pesos: una por registro desde la fila 7 ---
  let row = 7;
  for (const w of data.weights) {
    sheet.getRange(`B${row}`).setValue(w.time);
    sheet.getRange(`C${row}`).setValue(w.line);
    sheet.getRange(`D${row}`).setValue(w.pkgLabel);
    // 5 muestras en columnas E..I
    w.vals.forEach((v, i) => sheet.getCell(row - 1, 4 + i).setValue(v));
    sheet.getRange(`J${row}`).setValue(w.avg);
    sheet.getRange(`K${row}`).setValue(w.compliance / 100); // celda con formato %
    sheet.getRange(`L${row}`).setValue(w.lot);
    sheet.getRange(`M${row}`).setValue(w.initials);
    row++;
  }
}
```

## 3. Rama Word (gmp u otra forma en Word)

1. Prepara la plantilla `.docx`: pestaña **Programador → Controles de contenido
   de texto sin formato** en cada campo a llenar, y en *Propiedades* dale un
   **Título** a cada control (p. ej. `Fecha`, `Turno`, `CompletadoPor`).
2. Acción **Populate a Microsoft Word template** (premium): selecciona la
   plantilla y mapea cada control con los valores del Parse JSON.
3. **Create file** en SharePoint con el resultado; opcional convertir a PDF.

## 4. Conectar la app

1. Guarda el flow y copia la **HTTP URL** que genera el trigger.
2. En la app: **Admin → Power Automate — Official Forms** → pega la URL →
   **Save URL** → **Send Test**.
3. Revisa el **run history** del flow: debe aparecer una ejecución con
   `formType: "test"`. (La app no puede leer la respuesta por CORS — el
   historial del flow es la confirmación.)
4. En **Reports**: filtra fecha/línea/turno → **Fill Official Form → SharePoint**.

## Payload que envía la app

```json
{
  "source": "SAFETY",
  "client": "Caputo Foods",
  "formType": "weight_seal | gmp | test",
  "requestedBy": "JULIAN AGUDELO",
  "sentAt": "2026-07-13T21:00:00.000Z",
  "data": {
    "date": "2026-07-13", "line": "all", "shift": "all",
    "weights": [ { "id": 0, "date": "", "line": 1, "shift": 1, "pkg": 2,
      "pkgLabel": "2.5 lbs", "vals": [2.5, 2.51], "avg": 2.5, "pass": 5,
      "total": 5, "compliance": 100, "time": "08:30", "lot": "", "product": "",
      "comments": "", "initials": "JA", "target": { "min": 2.41, "max": 2.6 } } ],
    "seals": [ "…mismos campos que db.seals…" ],
    "temps": [ "…mismos campos que db.temps…" ]
  }
}
```

Notas:
- Si el dispositivo está offline, la solicitud queda en cola y se reenvía
  automáticamente al volver la conexión (estado visible en Admin).
- La URL del flow se guarda por dispositivo (localStorage). Configúrala una
  vez en cada tablet/teléfono que vaya a generar formas.
