# Mapeo Power Automate — "Populate a Microsoft Word template"

Plantilla: `QC Templates/FillWeightForm_CONTROLES.docx` · 150 campos.
Cada valor va como **expresion fx** (boton fx del campo, pegar, Add).
Los `?` hacen que columnas sin registro queden vacias sin error.

## Encabezado

| Campo | Expresion |
|---|---|
| Lote | `body('Parse_JSON')?['data']?['weights']?[0]?['lot']` |
| Fecha | `body('Parse_JSON')?['data']?['date']` |
| Turno | `body('Parse_JSON')?['data']?['shiftLabel']` |
| Linea | `body('Parse_JSON')?['data']?['lineLabel']` |
| Comentarios | `body('Parse_JSON')?['data']?['notes']` |

## Weight Monitoring (columnas 1-10)

| Campo | Expresion |
|---|---|
| Pkg1 | `body('Parse_JSON')?['data']?['weights']?[0]?['pkgLabel']` |
| Hora1 | `body('Parse_JSON')?['data']?['weights']?[0]?['time']` |
| P1_1 | `body('Parse_JSON')?['data']?['weights']?[0]?['vals']?[0]` |
| P1_2 | `body('Parse_JSON')?['data']?['weights']?[0]?['vals']?[1]` |
| P1_3 | `body('Parse_JSON')?['data']?['weights']?[0]?['vals']?[2]` |
| P1_4 | `body('Parse_JSON')?['data']?['weights']?[0]?['vals']?[3]` |
| P1_5 | `body('Parse_JSON')?['data']?['weights']?[0]?['vals']?[4]` |
| Tot1 | `body('Parse_JSON')?['data']?['weights']?[0]?['sum']` |
| Prom1 | `body('Parse_JSON')?['data']?['weights']?[0]?['avgR']` |
| Ini1 | `body('Parse_JSON')?['data']?['weights']?[0]?['initials']` |
| Pkg2 | `body('Parse_JSON')?['data']?['weights']?[1]?['pkgLabel']` |
| Hora2 | `body('Parse_JSON')?['data']?['weights']?[1]?['time']` |
| P2_1 | `body('Parse_JSON')?['data']?['weights']?[1]?['vals']?[0]` |
| P2_2 | `body('Parse_JSON')?['data']?['weights']?[1]?['vals']?[1]` |
| P2_3 | `body('Parse_JSON')?['data']?['weights']?[1]?['vals']?[2]` |
| P2_4 | `body('Parse_JSON')?['data']?['weights']?[1]?['vals']?[3]` |
| P2_5 | `body('Parse_JSON')?['data']?['weights']?[1]?['vals']?[4]` |
| Tot2 | `body('Parse_JSON')?['data']?['weights']?[1]?['sum']` |
| Prom2 | `body('Parse_JSON')?['data']?['weights']?[1]?['avgR']` |
| Ini2 | `body('Parse_JSON')?['data']?['weights']?[1]?['initials']` |
| Pkg3 | `body('Parse_JSON')?['data']?['weights']?[2]?['pkgLabel']` |
| Hora3 | `body('Parse_JSON')?['data']?['weights']?[2]?['time']` |
| P3_1 | `body('Parse_JSON')?['data']?['weights']?[2]?['vals']?[0]` |
| P3_2 | `body('Parse_JSON')?['data']?['weights']?[2]?['vals']?[1]` |
| P3_3 | `body('Parse_JSON')?['data']?['weights']?[2]?['vals']?[2]` |
| P3_4 | `body('Parse_JSON')?['data']?['weights']?[2]?['vals']?[3]` |
| P3_5 | `body('Parse_JSON')?['data']?['weights']?[2]?['vals']?[4]` |
| Tot3 | `body('Parse_JSON')?['data']?['weights']?[2]?['sum']` |
| Prom3 | `body('Parse_JSON')?['data']?['weights']?[2]?['avgR']` |
| Ini3 | `body('Parse_JSON')?['data']?['weights']?[2]?['initials']` |
| Pkg4 | `body('Parse_JSON')?['data']?['weights']?[3]?['pkgLabel']` |
| Hora4 | `body('Parse_JSON')?['data']?['weights']?[3]?['time']` |
| P4_1 | `body('Parse_JSON')?['data']?['weights']?[3]?['vals']?[0]` |
| P4_2 | `body('Parse_JSON')?['data']?['weights']?[3]?['vals']?[1]` |
| P4_3 | `body('Parse_JSON')?['data']?['weights']?[3]?['vals']?[2]` |
| P4_4 | `body('Parse_JSON')?['data']?['weights']?[3]?['vals']?[3]` |
| P4_5 | `body('Parse_JSON')?['data']?['weights']?[3]?['vals']?[4]` |
| Tot4 | `body('Parse_JSON')?['data']?['weights']?[3]?['sum']` |
| Prom4 | `body('Parse_JSON')?['data']?['weights']?[3]?['avgR']` |
| Ini4 | `body('Parse_JSON')?['data']?['weights']?[3]?['initials']` |
| Pkg5 | `body('Parse_JSON')?['data']?['weights']?[4]?['pkgLabel']` |
| Hora5 | `body('Parse_JSON')?['data']?['weights']?[4]?['time']` |
| P5_1 | `body('Parse_JSON')?['data']?['weights']?[4]?['vals']?[0]` |
| P5_2 | `body('Parse_JSON')?['data']?['weights']?[4]?['vals']?[1]` |
| P5_3 | `body('Parse_JSON')?['data']?['weights']?[4]?['vals']?[2]` |
| P5_4 | `body('Parse_JSON')?['data']?['weights']?[4]?['vals']?[3]` |
| P5_5 | `body('Parse_JSON')?['data']?['weights']?[4]?['vals']?[4]` |
| Tot5 | `body('Parse_JSON')?['data']?['weights']?[4]?['sum']` |
| Prom5 | `body('Parse_JSON')?['data']?['weights']?[4]?['avgR']` |
| Ini5 | `body('Parse_JSON')?['data']?['weights']?[4]?['initials']` |
| Pkg6 | `body('Parse_JSON')?['data']?['weights']?[5]?['pkgLabel']` |
| Hora6 | `body('Parse_JSON')?['data']?['weights']?[5]?['time']` |
| P6_1 | `body('Parse_JSON')?['data']?['weights']?[5]?['vals']?[0]` |
| P6_2 | `body('Parse_JSON')?['data']?['weights']?[5]?['vals']?[1]` |
| P6_3 | `body('Parse_JSON')?['data']?['weights']?[5]?['vals']?[2]` |
| P6_4 | `body('Parse_JSON')?['data']?['weights']?[5]?['vals']?[3]` |
| P6_5 | `body('Parse_JSON')?['data']?['weights']?[5]?['vals']?[4]` |
| Tot6 | `body('Parse_JSON')?['data']?['weights']?[5]?['sum']` |
| Prom6 | `body('Parse_JSON')?['data']?['weights']?[5]?['avgR']` |
| Ini6 | `body('Parse_JSON')?['data']?['weights']?[5]?['initials']` |
| Pkg7 | `body('Parse_JSON')?['data']?['weights']?[6]?['pkgLabel']` |
| Hora7 | `body('Parse_JSON')?['data']?['weights']?[6]?['time']` |
| P7_1 | `body('Parse_JSON')?['data']?['weights']?[6]?['vals']?[0]` |
| P7_2 | `body('Parse_JSON')?['data']?['weights']?[6]?['vals']?[1]` |
| P7_3 | `body('Parse_JSON')?['data']?['weights']?[6]?['vals']?[2]` |
| P7_4 | `body('Parse_JSON')?['data']?['weights']?[6]?['vals']?[3]` |
| P7_5 | `body('Parse_JSON')?['data']?['weights']?[6]?['vals']?[4]` |
| Tot7 | `body('Parse_JSON')?['data']?['weights']?[6]?['sum']` |
| Prom7 | `body('Parse_JSON')?['data']?['weights']?[6]?['avgR']` |
| Ini7 | `body('Parse_JSON')?['data']?['weights']?[6]?['initials']` |
| Pkg8 | `body('Parse_JSON')?['data']?['weights']?[7]?['pkgLabel']` |
| Hora8 | `body('Parse_JSON')?['data']?['weights']?[7]?['time']` |
| P8_1 | `body('Parse_JSON')?['data']?['weights']?[7]?['vals']?[0]` |
| P8_2 | `body('Parse_JSON')?['data']?['weights']?[7]?['vals']?[1]` |
| P8_3 | `body('Parse_JSON')?['data']?['weights']?[7]?['vals']?[2]` |
| P8_4 | `body('Parse_JSON')?['data']?['weights']?[7]?['vals']?[3]` |
| P8_5 | `body('Parse_JSON')?['data']?['weights']?[7]?['vals']?[4]` |
| Tot8 | `body('Parse_JSON')?['data']?['weights']?[7]?['sum']` |
| Prom8 | `body('Parse_JSON')?['data']?['weights']?[7]?['avgR']` |
| Ini8 | `body('Parse_JSON')?['data']?['weights']?[7]?['initials']` |
| Pkg9 | `body('Parse_JSON')?['data']?['weights']?[8]?['pkgLabel']` |
| Hora9 | `body('Parse_JSON')?['data']?['weights']?[8]?['time']` |
| P9_1 | `body('Parse_JSON')?['data']?['weights']?[8]?['vals']?[0]` |
| P9_2 | `body('Parse_JSON')?['data']?['weights']?[8]?['vals']?[1]` |
| P9_3 | `body('Parse_JSON')?['data']?['weights']?[8]?['vals']?[2]` |
| P9_4 | `body('Parse_JSON')?['data']?['weights']?[8]?['vals']?[3]` |
| P9_5 | `body('Parse_JSON')?['data']?['weights']?[8]?['vals']?[4]` |
| Tot9 | `body('Parse_JSON')?['data']?['weights']?[8]?['sum']` |
| Prom9 | `body('Parse_JSON')?['data']?['weights']?[8]?['avgR']` |
| Ini9 | `body('Parse_JSON')?['data']?['weights']?[8]?['initials']` |
| Pkg10 | `body('Parse_JSON')?['data']?['weights']?[9]?['pkgLabel']` |
| Hora10 | `body('Parse_JSON')?['data']?['weights']?[9]?['time']` |
| P10_1 | `body('Parse_JSON')?['data']?['weights']?[9]?['vals']?[0]` |
| P10_2 | `body('Parse_JSON')?['data']?['weights']?[9]?['vals']?[1]` |
| P10_3 | `body('Parse_JSON')?['data']?['weights']?[9]?['vals']?[2]` |
| P10_4 | `body('Parse_JSON')?['data']?['weights']?[9]?['vals']?[3]` |
| P10_5 | `body('Parse_JSON')?['data']?['weights']?[9]?['vals']?[4]` |
| Tot10 | `body('Parse_JSON')?['data']?['weights']?[9]?['sum']` |
| Prom10 | `body('Parse_JSON')?['data']?['weights']?[9]?['avgR']` |
| Ini10 | `body('Parse_JSON')?['data']?['weights']?[9]?['initials']` |

## Bag Seal Monitoring (columnas 1-9)

| Campo | Expresion |
|---|---|
| SHora1 | `body('Parse_JSON')?['data']?['seals']?[0]?['time']` |
| SVis1 | `body('Parse_JSON')?['data']?['seals']?[0]?['visual']` |
| SDunk1 | `body('Parse_JSON')?['data']?['seals']?[0]?['dunk']` |
| SPrint1 | `body('Parse_JSON')?['data']?['seals']?[0]?['printing']` |
| SIni1 | `body('Parse_JSON')?['data']?['seals']?[0]?['initials']` |
| SHora2 | `body('Parse_JSON')?['data']?['seals']?[1]?['time']` |
| SVis2 | `body('Parse_JSON')?['data']?['seals']?[1]?['visual']` |
| SDunk2 | `body('Parse_JSON')?['data']?['seals']?[1]?['dunk']` |
| SPrint2 | `body('Parse_JSON')?['data']?['seals']?[1]?['printing']` |
| SIni2 | `body('Parse_JSON')?['data']?['seals']?[1]?['initials']` |
| SHora3 | `body('Parse_JSON')?['data']?['seals']?[2]?['time']` |
| SVis3 | `body('Parse_JSON')?['data']?['seals']?[2]?['visual']` |
| SDunk3 | `body('Parse_JSON')?['data']?['seals']?[2]?['dunk']` |
| SPrint3 | `body('Parse_JSON')?['data']?['seals']?[2]?['printing']` |
| SIni3 | `body('Parse_JSON')?['data']?['seals']?[2]?['initials']` |
| SHora4 | `body('Parse_JSON')?['data']?['seals']?[3]?['time']` |
| SVis4 | `body('Parse_JSON')?['data']?['seals']?[3]?['visual']` |
| SDunk4 | `body('Parse_JSON')?['data']?['seals']?[3]?['dunk']` |
| SPrint4 | `body('Parse_JSON')?['data']?['seals']?[3]?['printing']` |
| SIni4 | `body('Parse_JSON')?['data']?['seals']?[3]?['initials']` |
| SHora5 | `body('Parse_JSON')?['data']?['seals']?[4]?['time']` |
| SVis5 | `body('Parse_JSON')?['data']?['seals']?[4]?['visual']` |
| SDunk5 | `body('Parse_JSON')?['data']?['seals']?[4]?['dunk']` |
| SPrint5 | `body('Parse_JSON')?['data']?['seals']?[4]?['printing']` |
| SIni5 | `body('Parse_JSON')?['data']?['seals']?[4]?['initials']` |
| SHora6 | `body('Parse_JSON')?['data']?['seals']?[5]?['time']` |
| SVis6 | `body('Parse_JSON')?['data']?['seals']?[5]?['visual']` |
| SDunk6 | `body('Parse_JSON')?['data']?['seals']?[5]?['dunk']` |
| SPrint6 | `body('Parse_JSON')?['data']?['seals']?[5]?['printing']` |
| SIni6 | `body('Parse_JSON')?['data']?['seals']?[5]?['initials']` |
| SHora7 | `body('Parse_JSON')?['data']?['seals']?[6]?['time']` |
| SVis7 | `body('Parse_JSON')?['data']?['seals']?[6]?['visual']` |
| SDunk7 | `body('Parse_JSON')?['data']?['seals']?[6]?['dunk']` |
| SPrint7 | `body('Parse_JSON')?['data']?['seals']?[6]?['printing']` |
| SIni7 | `body('Parse_JSON')?['data']?['seals']?[6]?['initials']` |
| SHora8 | `body('Parse_JSON')?['data']?['seals']?[7]?['time']` |
| SVis8 | `body('Parse_JSON')?['data']?['seals']?[7]?['visual']` |
| SDunk8 | `body('Parse_JSON')?['data']?['seals']?[7]?['dunk']` |
| SPrint8 | `body('Parse_JSON')?['data']?['seals']?[7]?['printing']` |
| SIni8 | `body('Parse_JSON')?['data']?['seals']?[7]?['initials']` |
| SHora9 | `body('Parse_JSON')?['data']?['seals']?[8]?['time']` |
| SVis9 | `body('Parse_JSON')?['data']?['seals']?[8]?['visual']` |
| SDunk9 | `body('Parse_JSON')?['data']?['seals']?[8]?['dunk']` |
| SPrint9 | `body('Parse_JSON')?['data']?['seals']?[8]?['printing']` |
| SIni9 | `body('Parse_JSON')?['data']?['seals']?[8]?['initials']` |

## Despues del Populate

1. **Create file** (SharePoint): Folder `/Shared Documents/QC Forms`,
   File Name fx: `concat('Weight_', body('Parse_JSON')?['data']?['date'], '.docx')`,
   File Content: salida "Microsoft Word Document" del Populate.
2. *(Opcional)* **Convert Word Document to PDF** sobre el archivo creado
   + otro Create file con `concat('Weight_', body('Parse_JSON')?['data']?['date'], '.pdf')`.