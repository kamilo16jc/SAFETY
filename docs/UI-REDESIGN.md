# UI NEXORA — alcance y validación

## Dirección visual

Se incorpora una capa `nexora-ui.css` al final de la hoja original para modernizar los componentes sin rehacer los módulos de captura. La interfaz usa fondo gris frío, texto oscuro, superficies claras, separaciones regulares, radios de 8–18 px y números tabulares. El modo oscuro utiliza los mismos componentes con tokens propios; se corrige el comportamiento previo que mantenía el escritorio claro aunque el usuario eligiera oscuro.

El logo original de Caputo se conserva. La marca NEXORA usa su geometría existente en una variante monocromática pequeña para la navegación. No se sustituyeron los logos fuente.

## Cobertura

Todas estas rutas conservan su ID y la llamada a su inicializador. Comparten navegación, controles, superficies, colores, tipografía y estados:

| Área | Pantallas |
| --- | --- |
| Acceso y marco | Login, Overview, Module menu |
| Inspección QA | Weight Log, List Samples, Seal Bags, Temperatures, GMP Audit, Metal Detector, CAPA, Hold Cases, Shift Report |
| Laboratorio | Sample Analysis, Yeast & Mold, Lab Samples, Grilling Cheese, Raw Analysis, Dry 1935, Formag, R&D |
| Producción | Production Schedule |
| Productos | Product Catalog, Create Product, Customers |
| COA | COA Generator, Status, Lab Results |
| Revisión y administración | Dashboard, Reports, Search, Activity Log, Users & Roles |

Son 32 pantallas. Los formularios de Raw/Dry/Formag/R&D siguen construyéndose dinámicamente desde el mismo módulo. Las tablas mantienen sus ediciones, exportaciones y datos; en móvil se conserva el patrón existente de filas como tarjetas.

## Comportamientos nuevos

- Barra lateral con nombre e icono de cada módulo. Una función activa muestra `aria-current`.
- Cajón móvil con cierre, Escape y foco contenido en la navegación.
- Finder de módulos basado exclusivamente en `myModules()` / `moduleItemsFor()`. No solicita información a Firebase.
- Login semántico, error anunciado, carga mientras se verifica contraseña y bloqueo de envíos duplicados.
- Filtros de línea/turno del Overview pendientes hasta Apply. El período usa botones de acción explícita.
- Tendencia de peso/sello con escala 0–100%, objetivos existentes y saltos donde no hay muestras. Se puede inspeccionar por pointer o con flechas/Home/End.
- Datos de la tendencia en una tabla que se actualiza junto a la gráfica.
- Selección de columna por línea para filtrar el Overview. CAPA permite pasar a su función, cuando el rol lo permite.
- Mensajes calculados, con referencia explícita al período y al tamaño de muestra. CAPA vencidos se identifica como estado de todas las fechas.

## Qué se mantiene

No se cambian los formatos de documentos oficiales, los archivos de `js/export/`, `js/integrations/`, las plantillas de Office ni `functions/`. Se mantienen la configuración de Firebase, los datos de negocio y el esquema de permisos. La capa nueva no guarda configuraciones de producción ni genera decisiones de liberación.

Los objetivos numéricos existentes no se redefinieron como parte del diseño. El Overview utiliza `KPI_TARGETS` (peso/sellado 98%, checks 95% en esta copia). El Dashboard analítico original conserva sus clasificaciones 90/80 y la guía de 90%. Son criterios preexistentes distintos; su unificación requiere una decisión del dueño del sistema antes de una integración operativa.

## Verificaciones realizadas

- 32 pantallas preservadas.
- Ningún ID existente eliminado ni nuevo ID duplicado.
- Rutas locales de scripts, estilos e imágenes resueltas.
- Sintaxis JavaScript de fuentes e inline handlers validada con Node.
- Permisos de admin y operador probados sobre las funciones originales.
- Ausencia de datos distinta de 0%; períodos previos ausentes no producen comparación inventada.
- Agregaciones filtradas por línea y turno, cálculo de insights y filtros pendientes verificados.
- Datos sintéticos restringidos al marcador inyectado por el servidor local; las escrituras del demo quedan en memoria.
- Transformación del servidor local comprobada directamente: Firebase removido, inyección local única, registro del SW desactivado.
- Archivos de exportación, integración y funciones comparados contra el ZIP recibido.

No se ejecutaron pruebas visuales o de extremo a extremo en navegador: no había un controlador de navegador disponible. Tampoco se verificaron servicios externos, cámaras/lectores, exportaciones reales con Office o autenticación contra datos de producción. La galería está preparada para revisar el layout y los flujos en el PC del usuario.

## Integración posterior

La entrega no incluye metadatos `.git`, cachés de Python ni dependencias instaladas. Conserva los archivos de la aplicación y las instrucciones del proyecto. Integra los cambios sobre `diseno-ui`, revisa con la galería y reúne cualquier avance de la rama principal antes de decidir la publicación. No se ejecutó ninguna acción remota sobre Git.

`sw.js` incluye los nuevos assets y usa `nexora-qc-v120-design-1` para distinguir la revisión visual. Al integrar con una versión posterior, debe coordinarse un identificador de caché único con esa versión; el servidor de diseño no registra este worker.
