# NEXORA — rediseño de interfaz

Interfaz minimalista para la aplicación existente: 32 pantallas, 6 módulos, temas claro y oscuro y adaptación a móvil. Conserva HTML/CSS/JavaScript y los identificadores usados por los formularios.

## Abrir en Windows

1. Descomprime el ZIP completo.
2. Abre la carpeta `nexora-diseno`.
3. Haz doble clic en **ABRIR-DISENO.bat**. Se necesita Python 3 instalado.
4. Se abrirá la galería de revisión: elige una pantalla, alterna **375 px mobile** y **Light / dark**.
5. Pulsa **Open workspace** para explorar la aplicación sin el marco de la galería.

También puedes iniciar desde una terminal en la carpeta:

```bash
python dev-server.py --open
```

Si el puerto 8146 ya está ocupado, cierra el servidor anterior con Ctrl+C, ejecuta de nuevo y recarga la página. El archivo `.bat` conserva la terminal abierta para mostrar cualquier error de arranque.

### Direcciones locales

| Dirección | Vista |
| --- | --- |
| http://localhost:8146/design-gallery.html | Galería de las 32 pantallas |
| http://localhost:8146/?demo | Aplicación con registros ficticios |
| http://localhost:8146/?demo&login | Login de demostración: **demo / demo** |
| http://localhost:8146/?demo&pantalla=analysis | Ejemplo: análisis de muestras |
| http://localhost:8146/ | Modo local original, sin insertar datos de demostración |
| http://localhost:8146/?login | Login local original |

El servidor de diseño quita la conexión a Firebase y el registro del service worker. Los registros del modo `?demo` viven sólo en memoria y vuelven al estado inicial al recargar; el resto del modo local conserva su comportamiento anterior. El HTML de producción no incluye ni la activación local ni el script del demo. Para revisar el diseño, usa el servidor y no abras directamente `index.html`.

## Diseño e interacciones

- Fondos neutros, superficies blancas, menta, azul suave, lavanda y melocotón. Tipografía nativa: SF Pro en Apple y fuentes del sistema en otras plataformas, sin descarga de fuentes.
- Navegación por módulos y funciones, adaptada a los permisos existentes. Menú lateral en escritorio y cajón accesible en móvil.
- Buscador de módulos con **Ctrl+K** o **⌘K**, búsqueda explícita con Enter o botón, cierre con Escape.
- Login con mostrar/ocultar contraseña, estado de carga y mensajes de error. Se conserva la verificación de contraseñas existente.
- Estilos comunes en formularios, tablas editables, ventanas de detalle, filtros, chips, estados, controles y botones.
- Overview con indicadores navegables, peso/sellado por día, tooltips para ratón/táctil/teclado, tabla de datos y filtro de línea al seleccionar sus columnas.
- Insights calculados a partir de los registros: CAPA vencidos, cumplimiento frente al objetivo y comparación con el período anterior. No son IA generativa ni predicciones; no aprueban ni cambian registros.
- Los días sin muestras se muestran sin datos, interrumpen la línea y no se convierten en 0% o 100%.
- Foco visible, etiquetas de controles, preferencia de movimiento reducido y zoom habilitado.

## Archivos principales

| Archivo | Responsabilidad |
| --- | --- |
| `css/nexora-ui.css` | Tokens, componentes compartidos, móvil, tema oscuro y login |
| `js/core/nexora-ui.js` | Buscador, menú móvil, accesibilidad, estados del login |
| `js/core/sidenav.js` | Navegación con permisos existentes |
| `js/modules/nexora-insights.js` | Tendencia interactiva e insights calculados |
| `index.html` | Login y marco de la interfaz; conserva las 32 pantallas |
| `design-gallery.html` | Revisión visual local de las pantallas |
| `tools/demo-data.js` | Registros sintéticos aislados para el servidor local |
| `docs/UI-REDESIGN.md` | Alcance, verificación y notas de integración |

## Verificación

```bash
node tests/ui-regression.cjs
```

Se comprobaron sintaxis de los scripts, manejadores de eventos, conservación de IDs/rutas, referencias a assets, permisos de navegación, agregados, datos ausentes/cero y aislamiento del demo. No fue posible ejecutar una revisión visual en navegador en el entorno de entrega. La galería permite realizarla en escritorio y a 375 px, en claro y oscuro.

Este paquete corresponde a la copia de diseño. No se publicó, no se conectó a Firebase y no se hizo push a ninguna rama. Los formatos de exportación y `functions/` no se modificaron.
