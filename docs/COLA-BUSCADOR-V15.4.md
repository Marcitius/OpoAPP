# OpoGC v15.4 — Cola visible y buscador

Actualización de interfaz sobre **v15.3.1**. Incorpora dos accesos y reutiliza la infraestructura existente, sin modificar el sistema de aprendizaje.

## Cola de la sesión

Pulsa **Cola**, con el icono de tres líneas, junto al apartado de la tarjeta. El panel muestra:

- **En pantalla:** la tarjeta actual o el grupo de ortografía. Al consultar una tarjeta ya valorada se indica como consulta.
- **Próximas:** el orden previsto usando el selector actual de la sesión.
- **Pendientes de refuerzo:** tarjetas que todavía necesitan separación, otra vuelta o, en ortografía, esperar su disponibilidad.
- **Aprobadas:** tarjetas que ya no deben repetirse en esa sesión.

Desde 768 px el panel permanece al lado y permite seguir respondiendo. Por debajo se utiliza la hoja móvil existente: ciérrala para contestar y vuelve a abrirla para ver la cola actualizada. Puedes cerrarla con su botón, Escape en escritorio o los controles habituales de la hoja móvil.

La nota más reciente y el estado se muestran junto a cada pregunta; cuando cambia la posición aparecen indicadores de subida/bajada. No se muestran las soluciones dentro de la cola. Abrir/cerrar el panel no reinicia el ejercicio ni cambia el texto que estabas escribiendo.

### Qué significa el orden previsto

El algoritmo elige la siguiente tarjeta después de responder; no existe un orden futuro inamovible. La vista usa `nextSessionCard` y una copia temporal de la sesión para anticipar un avance en el que se va aprobando cada presentación. Si suspendes una tarjeta, la previsión se recalcula con el estado real guardado y la coloca donde corresponde al refuerzo. Si la apruebas, aparece en Aprobadas.

Las valoraciones temporales de esa previsión nunca salen de la función ni se guardan en tarjetas, historial, borradores, informes, IndexedDB o sincronización. Los únicos datos de cada fila son los del estado real. No se cambia FSRS ni su cálculo de próximos repasos.

La separación entre tarjetas, prioridad por nota, cuota de refuerzos, modos y disponibilidad temporal de ortografía siguen siendo los existentes. Una tarjeta bloqueada por falta de separación no se presenta como disponible simplemente por abrir el panel o dejar pasar tiempo. Se conserva **Volver a intentar pendientes** al terminar una vuelta.

Para sesiones grandes la previsión inicial es de treinta próximas tarjetas. **Mostrar 30 más** amplía la vista, sin modificar la selección ni el algoritmo. Las aprobadas se despliegan por separado. La apertura del panel es una preferencia local de presentación; la cola se reconstruye desde la sesión guardada al reanudar en otro dispositivo.

## Búsqueda desde Hoy

Pulsa la **lupa de la cabecera de Hoy**. La búsqueda abarca todos los temas y subtemas de la cuenta actual:

- Texto de las preguntas y respuestas con formato.
- Soluciones correctas de test y vocabulario; no se indexa un distractor como si fuera una solución.
- Respuesta modelo de tarjetas escritas; no se busca en las cadenas internas de la rúbrica.
- Formas correctas de ortografía.
- Contenido, respuesta principal y alternativas admitidas de las tablas mudas.

Ignora mayúsculas, acentos y espacios sobrantes; puedes combinar palabras de pregunta y respuesta. Cada tarjeta aparece una sola vez. Se indica dónde coincide, el tema/subtema, el tipo y un fragmento de contexto. Los resultados priorizan coincidencias en el enunciado y se muestran por bloques de cuarenta.

Toca un resultado para consultar la tarjeta completa. **Volver a resultados** conserva la búsqueda. **Estudiar tarjeta** abre el flujo existente y crea una sesión independiente, sin cerrar las demás. **Editar tarjeta** utiliza el editor actual encima de la consulta; al guardar se actualizan los resultados. Consultar, buscar o abrir el panel no registra notas. No se abre el teclado automáticamente al pulsar la lupa; toca el campo para escribir.

El texto se indexa localmente y se actualiza cuando cambian las tarjetas. La escritura permanece dentro del componente de búsqueda, sin actualizar la cuenta por cada tecla. El texto del índice se muestra escapado por React; la vista completa sigue utilizando el lector enriquecido saneado existente. No se ejecuta HTML de las tarjetas para indexarlo ni se envía el contenido a un buscador o servicio de IA.

## Integración y archivos

| Archivos | Función |
| --- | --- |
| `lib/memory/queuePreview.ts` | Previsión de lectura reutilizando el selector/reductor de sesiones |
| `components/review/SessionQueuePanel.tsx` | Panel lateral/hoja móvil, estados, movimientos y paginación |
| `lib/study/cardSearch.ts` | Extracción de texto para búsqueda, índice, coincidencias y fragmentos |
| `components/library/GlobalCardSearch.tsx` | Búsqueda global, consulta y acciones sobre resultados |
| `app/OpoApp.tsx` | Accesos y conexión con sesiones/editor actuales; componentes bajo demanda |
| `ReviewSessionView.tsx`, `SessionStatus.tsx`, `app/OrthographyStudy.tsx` | Acceso a la cola y espacio para el panel, sin cambiar la corrección |
| `components/shared/Icon.tsx`, `app/study-tools.css`, `app/layout.tsx` | Icono y estilos aislados |
| `tests/study-tools.test.ts`, `tests/ui/study-tools.spec.ts`, `tests/ui/main.tsx` | Pruebas y fixture de interfaz |

Se mantienen byte a byte los módulos de scheduler, FSRS, calificaciones, sesiones persistidas, checkpoint, borrador, sincronización, autenticación y migraciones. Los manejadores existentes de guardar valoraciones, iniciar/continuar sesiones y crear/importar tarjetas conservan su lógica. No hay campos nuevos persistentes, migraciones, nuevas dependencias ni datos iniciales añadidos.

## Actualización y límites de validación

Aplica el contenido de **actualizar/** sobre **v15.3.1**, conservando rutas y reemplazando archivos. Incluye `package.json` y `package-lock.json` juntos. Cloudflare Pages: **npm run build**, salida **out**. No ejecutes SQL ni cambies las variables de Supabase. Actualiza la PWA en los dispositivos.

La lista completa de archivos está en **ARCHIVOS-DEL-PARCHE.json**. Resultados ejecutados, integridad y límites: **docs/RESULTADOS-V15.4.json**. Las pruebas locales con Chromium y dispositivos simulados no equivalen a probar tu cuenta real, la sincronización por la red de Supabase o Safari instalado en un iPad físico.
