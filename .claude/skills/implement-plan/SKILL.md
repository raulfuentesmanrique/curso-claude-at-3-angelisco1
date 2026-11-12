---
name: implement-plan
description: Implementa el plan que está como comentario de una issue de GitHub, aplicando TDD estricto, tarea a tarea, en un git worktree con su propia rama creada desde development, y deja la PR creada para revisión. Úsala cuando pidan implementar, ejecutar o desarrollar el plan de una issue.
argument-hint: <num_issue | url_issue>
---

# implement-plan

Obtiene con `gh` el plan publicado como comentario de una issue, lo implementa tarea a tarea con TDD estricto en un worktree aislado (un commit por tarea) y deja una PR abierta para que alguien la revise. **Nunca la mergees.**

## Pasos

### 1. Obtén la issue y el plan

- El usuario debe indicar el número (`42`, `#42`) o la URL de la issue en `$ARGUMENTS` o en la conversación. Si no la ha dado, pídela antes de continuar.
- Lee la issue con `gh issue view <num_o_url> --comments --json number,title,body,state,url,comments`. Con una URL, `gh` deduce el repositorio; con un número usa el del directorio actual. Si `gh` falla (no instalado, sin autenticar, issue inexistente), informa del error y detente.
- El plan es el comentario que sigue la plantilla de `plan-feature`: empieza por un encabezado `# <num_issue> - <título>` y contiene las secciones `## Objetivo`, `## Tareas`, etc. Si hay varios, usa el más reciente (y menciónalo al usuario). Si no hay ninguno, informa de que la issue no tiene plan y sugiere ejecutar `plan-feature`; no improvises uno.
- Guarda el cuerpo del comentario tal cual (sin modificarlo) para trabajar con él en el paso 3.
- Lee el plan completo (objetivo, alcance, archivos afectados, tareas, criterios de aceptación, dudas) y `CLAUDE.md`, y respeta sus convenciones (capas controllers/services/repositories/models/utils, funciones en snake_case, prettier sin `;` y con comillas simples, eslint, tests con vitest).
- Si en "Dudas y decisiones tomadas" hay dudas abiertas que bloquean la implementación, pregúntalas al usuario antes de empezar.

### 2. Prepara la rama y el worktree

El nombre de la rama es `<num_issue>-<breve-descripcion>`: `<breve-descripcion>` en kebab-case, minúsculas, sin tildes y de 2 a 5 palabras, derivada del título del plan (ej.: `42-paginacion-vendehumos`).

1. Comprueba `git branch --list development main` y `git status --short`. Si `development` **no existe**, créala a partir de `main` sin cambiar de rama: `git branch development main`. No la publiques salvo que el paso 6 lo requiera.
2. Asegúrate de que `.claude/worktrees/` está ignorada (`git check-ignore .claude/worktrees`); si no lo está, añádela a `.gitignore` y coméntalo al usuario en la respuesta final.
3. Crea el worktree con la rama nueva a partir de `development`: `git worktree add .claude/worktrees/<rama> -b <rama> development`.
4. Si la rama o el worktree ya existen, no los recrees ni sobrescribas: pregunta al usuario si continuar en ellos (útil para retomar un plan a medias; en ese caso salta las tareas ya marcadas `- [x]`).
5. **Varios agentes**: si el plan tiene bloques de tareas realmente independientes (sin dependencias ni archivos en común) y se van a repartir entre varios agentes, crea un worktree por agente: el principal `.claude/worktrees/<rama>` y uno por cada agente adicional con su propia rama derivada, `.claude/worktrees/<rama>-<parte>` con rama `<rama>-<parte>`, también desde `development`. Cada agente trabaja solo en su worktree; al terminar, integra cada rama derivada en la rama principal con `git merge` desde el worktree principal y resuelve los conflictos antes de continuar. Si hay dudas sobre la independencia de las tareas, usa un solo worktree.
6. **A partir de aquí, todos los comandos (git, tests, formato) se ejecutan dentro del worktree** (`cd` a él o `git -C`), nunca en el árbol principal. En un worktree recién creado instala las dependencias si hace falta (`npm install`).
7. Escribe el plan guardado en el paso 1 en `plans/<rama>.md` dentro del worktree (crea la carpeta si no existe). Es la copia de trabajo donde se marcan las tareas, y se commiteará junto con la primera tarea.

### 3. Implementa cada tarea con TDD estricto

Recorre las tareas `- [ ]` **en orden**, de una en una. Para cada tarea:

1. **Red**: escribe primero el test (vitest) que describe el comportamiento de la tarea. Ejecútalo (`npx vitest run <archivo>`) y **comprueba que falla** por la razón esperada (no por un error de sintaxis o de import). No escribas código de producción antes de ver el test en rojo.
2. **Green**: escribe el código **mínimo** necesario para que el test pase, en la capa que corresponda. Ejecuta el test y confirma que pasa.
3. **Refactor**: limpia el código manteniendo los tests en verde. Aplica prettier y eslint a los archivos tocados.
4. **Verifica**: ejecuta la suite completa (`npm test`) y comprueba que nada anterior se ha roto. Si algo falla, corrígelo antes de seguir.
5. **Marca la tarea como hecha** en `plans/<rama>.md` del worktree, cambiando `- [ ]` por `- [x]` solo para esa tarea y solo cuando el test pase con el código implementado.
6. **Commit**: invoca el slash command `/commit` (con la herramienta Skill, skill `commit`) pasando como argumento un contexto breve con el número y título de la tarea. El commit debe incluir el código, el test y el plan actualizado. No hagas `git commit` a mano.

Tareas sin comportamiento testable (instalar dependencias, crear archivos de configuración, documentar en `CLAUDE.md`, etc.):
- No inventes tests artificiales. Verifica el resultado con un comando observable (p. ej. `npm ls`, `npx eslint .`, `npx prettier --check .`, arrancar el comando) y, si pasa, marca la tarea y haz commit igualmente.
- Si la tarea es la que configura vitest y aún no existe, instálalo y configúralo primero, y usa su ejecución como verificación.

### 4. Cierre de la implementación

- Cuando todas las tareas estén en `- [x]`, recorre los **criterios de aceptación** del plan y comprueba cada uno (tests, ejecución real si procede). Marca `- [x]` los que se cumplan e informa de los que no.
- Ejecuta `git status` y `git log --oneline development..HEAD` en el worktree para confirmar que el árbol está limpio y hay un commit por tarea.

### 5. Deja la PR creada

1. Publica la rama: `git push -u origin <rama>` (desde el worktree). Solo se publica la rama del plan (no `development` ni `main`).
2. Crea la PR contra `development` con `gh pr create --base development --head <rama> --title "<título>" --body-file <archivo>`. Escribe el cuerpo en un archivo temporal (no en el repositorio) y úsalo con `--body-file`. El título sigue Conventional Commits (ej.: `feat(api): paginación de vendehumos`). El cuerpo, en español, incluye:
   - Resumen de lo implementado y enlace a la issue (`Closes #<num_issue>`).
   - Lista de tareas completadas y estado de los criterios de aceptación (marcando los que no se cumplan).
   - Decisiones o desviaciones respecto al plan y cualquier cosa que el revisor deba mirar con atención.
   - Al final, la línea de atribución indicada por las instrucciones del entorno para las descripciones de PR, si existe.
3. **No mergees la PR ni la apruebes**: debe revisarla otra persona. No pidas auto-merge. Si el usuario tiene revisores definidos, puedes añadirlos con `--reviewer` solo si los ha indicado.
4. Si el push o la creación de la PR fallan, informa del error sin reintentar en bucle; el trabajo queda commiteado en el worktree.

### 6. Responde

Indica: issue, rama y worktree usados, URL de la PR, tareas completadas, resultado de la suite de tests y cualquier decisión o desviación respecto al plan. Deja el worktree creado (el usuario lo eliminará con `git worktree remove` cuando la PR esté mergeada).

### 7. Avisa por Slack

- Como último paso, envía un mensaje al canal de Slack `curso-claude-ed3` indicando que el plan ya se ha implementado y que la PR está lista para revisión. Usa la herramienta MCP de Slack (`mcp__slack__slack_post_message` para publicar el mensaje en el canal con el id "C0CGZ01R9M2"; si no está cargada, cárgala antes con ToolSearch).
- El mensaje debe incluir el número de issue, la rama y la URL de la PR (ej.: `Ya se ha implementado la issue 42 (rama 42-paginacion-vendehumos). PR lista para revisar: <url>`). Si quedaron tareas sin completar o criterios sin cumplir, indícalo en el mensaje en lugar de decir que está terminado.
- No incluyas datos privados (emails, rutas locales, secretos). Si no se puede enviar el mensaje, informa al usuario del fallo, sin reintentar en bucle.

## Reglas

- Una tarea = un ciclo TDD = un commit. No agrupes varias tareas en un commit ni dejes tareas hechas sin commitear.
- Nunca marques una tarea como hecha si su test no pasa.
- No te saltes el paso rojo del test ni escribas código "por adelantado" de tareas posteriores.
- Trabaja siempre dentro de los worktrees de `.claude/worktrees/`; no cambies de rama ni modifiques archivos en el árbol de trabajo principal.
- Si una tarea no se puede completar o el plan es incorrecto, para, explica el problema y pregunta al usuario; no improvises cambios fuera del alcance del plan.
- El único `git push` permitido es el de la rama del plan en el paso 5. Nada de `--force`, `--amend`, `--no-verify` ni cambios en la configuración de git.
- No mergees la PR ni toques `main`, salvo para crear `development` a partir de ella si no existe.
