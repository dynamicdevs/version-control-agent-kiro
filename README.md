# 🗂️ Version Control Agent para Kiro

Un agente que versiona todo lo que haces en una conversación con Kiro: archivos creados, modificaciones (con anotaciones de qué cambió), y la conversación completa.

## ¿Qué hace?

| Lo que pasa | Lo que guarda |
|-------------|---------------|
| Creas un archivo | Copia completa en el snapshot |
| Modificas un archivo | Versión anotada con `[MODIFIED vX]` en cada línea cambiada |
| Hablas con el agente | Conversación completa (Markdown + JSON) |
| Pides una nueva versión | Crea nueva versión (V1, V2, V3...) |

## Instalación

1. Copia la carpeta `.kiro/` al root de tu proyecto
2. Abre el proyecto en Kiro
3. Pide crear una versión: "Crea una nueva versión: mi feature"

Eso es todo. A partir de ahí el tracking es automático.

## Requisitos

- [Kiro](https://kiro.dev)
- Node.js (cualquier versión reciente)

## ¿Cómo funciona?

```
Tú: "Crea una nueva versión: Login system"
        │
        ▼
Se crea V(n+1) con esa descripción
        │
        ▼
Trabajas normal (creas/modificas archivos)
        │
        ▼
El agente guarda snapshot de cada archivo + registra cambios
        │
        ▼
La conversación se registra automáticamente
        │
        ▼
Cuando quieras otra versión: "Crea versión 2: Refactor"
```

## Crear versiones

Las versiones se crean **solo cuando tú lo pides**. Ejemplos:

- "Crea una nueva versión"
- "Inicia versión 2: Refactor del módulo de pagos"
- "Nueva versión: Implementar login"

También puedes usar el botón manual en el panel lateral de Kiro → sección "Agent Hooks" → "▶ Iniciar Version Control".

## Estructura

```
tu-proyecto/
└── .kiro/
    ├── steering/version-control.md       ← Reglas del agente
    ├── hooks/
    │   ├── log-conversation.hook.json    ← Registra conversación y trackea
    │   ├── start-version.hook.json       ← Botón manual (panel lateral)
    │   ├── track-changes.hook.json       ← Detecta archivos nuevos
    │   └── track-edits.hook.json         ← Detecta ediciones
    └── agents/version-control/
        ├── cli.js                        ← Punto de entrada
        ├── version-manager.js            ← Lógica core
        └── versions/
            ├── manifest.json             ← Índice de versiones
            └── vX/
                ├── metadata.json         ← Info de la versión
                ├── changes.json          ← Log de cambios técnicos
                ├── conversation.md       ← 💬 Conversación completa
                ├── conversation.json     ← Conversación (estructurada)
                ├── snapshot/             ← 📁 Archivos guardados
                └── subversions/          ← Cambios incrementales
                    └── vX.Y/
                        ├── metadata.json
                        └── snapshot/
```

## Ejemplo de archivo anotado

Cuando un archivo se modifica, el snapshot guarda la versión nueva con comentarios indicando qué cambió:

```python
def saludar(nombre):
    """Saluda a un usuario"""
    return f"Hola, {nombre}!"

# [MODIFIED v2] Línea añadida
def despedir(nombre):
# [MODIFIED v2] Línea añadida
    """Despide a un usuario"""
# [MODIFIED v2] Línea añadida
    return f"Adiós, {nombre}!"
```

## Ejemplo de conversación guardada

```markdown
# Conversación - v1

## 🧑 Usuario (9/7/26, 16:23:17)
Necesito crear un sistema de login con usuario y contraseña

## 🤖 Agente (9/7/26, 16:23:29)
Creé auth.py con funciones login() y register(). Se usa bcrypt para hashear contraseñas.
```

## CLI (uso manual)

Si quieres interactuar directamente:

```bash
# Ver estado
node .kiro/agents/version-control/cli.js status

# Historial de versiones
node .kiro/agents/version-control/cli.js history

# Ver conversación
node .kiro/agents/version-control/cli.js conversation

# Ver un archivo en una versión específica
node .kiro/agents/version-control/cli.js show src/app.py 2

# Ver sub-versiones
node .kiro/agents/version-control/cli.js subversions 1

# Crear versión manualmente
node .kiro/agents/version-control/cli.js new "Descripción"
```

## Hecho por

[DynamicDevs](https://github.com/DynamicDevs)

Mauricio De Juan · [mdejuan@dynamicdevs.io](mailto:mdejuan@dynamicdevs.io)
