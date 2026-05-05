---
title: Linting Rules Overview
description: Quick overview of the existing rules
author: César
---

# Linting Rules Overview

| Rule                          | Description                                                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metadata-required-non-empty` | Comprueba que el documento tenga `YAML front matter` al inicio y que uno o varios campos obligatorios configurados, por defecto `title`, existan y no estén vacíos. |
| `no-trailing-spaces`          | Detecta espacios o tabuladores al final de una línea.                                                                                               |
| `no-multiple-blank-lines`     | Detecta líneas en blanco consecutivas para evitar bloques vacíos repetidos.                                                                         |
| `require-links`               | Exige que el documento contenga al menos un enlace, ya sea Markdown, autolink (`<https://...>`) o URL directa.                                      |

## Notes

- Todas las reglas se pueden activar o desactivar desde la configuración.
- Algunas reglas pueden modificarse por fichero usando `overrides`, por ejemplo para desactivar `require-links` en `README.md`.
- `metadata-required-non-empty` acepta `field` para un único campo o `fields` para varios, pero no ambos a la vez.
