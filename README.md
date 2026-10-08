# MeryCon

App personal (PWA) para el seguimiento diario de salud, actividad, ejercicio por niveles, pruebas funcionales, medicación, citas y documentos médicos. Se instala en la pantalla de inicio del iPhone y funciona sin conexión.

**Privacidad:** este repositorio contiene solo el código. Todos los datos (registros, informes, fotos) se guardan únicamente en el iPhone donde se usa la app (IndexedDB). No hay servidor ni cuentas. Nunca subas aquí copias de seguridad ni el archivo de datos iniciales (el `.gitignore` bloquea los `.json`).

> No sustituye a médicos ni fisioterapeutas. No modifica ni recomienda cambios de medicación.

## Publicar en GitHub Pages

1. En GitHub → **New repository** → nombre `merycon` → Public → Create.
2. **Add file → Upload files** → arrastra el **contenido** de esta carpeta (`index.html`, `sw.js`, `manifest.webmanifest`, `README.md`, `.gitignore` y el resto de archivos (todo está en la misma carpeta, sin subcarpetas)) → Commit.
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch `main` / `(root)` → Save.
4. En 1-2 minutos estará en `https://luisfergcc.github.io/merycon/`.

## Instalar en el iPhone

1. Abre la URL en **Safari** → botón Compartir → **Añadir a pantalla de inicio**.
2. Abre MeryCon desde el icono → Ficha → Ajustes → **Importar datos iniciales** y elige `merycon_datos_iniciales.json` (pásalo antes al iPhone por AirDrop o iCloud Drive).
3. En Ajustes, haz una **copia de seguridad** cada semana y guárdala en iCloud Drive.

## Actualizar la app

1. Cambia los archivos en el repositorio.
2. Sube el número de `CACHE` en `sw.js` (p. ej. `merycon-v2`).
3. En el iPhone, cierra la app del todo y vuelve a abrirla (a veces hace falta abrirla dos veces).

Los datos no se pierden al actualizar: viven en el iPhone, no en el código.

## Estructura

- `js/data.js` — biblioteca de ejercicios (niveles 1-5), pruebas funcionales, señales de alarma.
- `js/core.js` — base de datos local, utilidades, gráficas.
- `js/app.js` — navegación, semáforo, progresión, copias de seguridad.
- `js/views-*.js` — pantallas.
