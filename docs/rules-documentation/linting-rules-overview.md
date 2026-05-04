---
title: Linting Rules Overview
---

# Linting Rules Overview

| Rule | Description |
| --- | --- |
| `metadata-required-non-empty` | Comprueba que el documento tenga `YAML front matter` al inicio y que el campo obligatorio configurado, por defecto `title`, exista y no esté vacío. |
| `no-trailing-spaces` | Detecta espacios o tabuladores al final de una línea. |
| `no-multiple-blank-lines` | Detecta líneas en blanco consecutivas para evitar bloques vacíos repetidos. |
| `require-links` | Exige que el documento contenga al menos un enlace, ya sea Markdown, autolink (`<https://...>`) o URL directa. |

## Notes

- Todas las reglas se pueden activar o desactivar desde la configuración.
- Algunas reglas pueden modificarse por fichero usando `overrides`, por ejemplo para desactivar `require-links` en `README.md`.
