---
inclusion: always
---

# Version Control Agent

## Activación

El agente **NO crea versiones automáticamente**. Tú decides cuándo crear una nueva versión pidiéndoselo a tu IDE agéntico (Kiro).

### Crear una nueva versión
Simplemente pídelo en el chat:
- "Crea una nueva versión"
- "Inicia versión 2: Refactor del módulo de pagos"
- "Nueva versión: Implementar login"

El agente ejecutará internamente:
```
node .kiro/agents/version-control/cli.js new "Tu descripción"
```

### Botón manual (alternativa)
En el panel lateral de Kiro → sección "Agent Hooks" → click en "▶ Iniciar Version Control".

### Desde terminal (si prefieres)
```
node .kiro/agents/version-control/cli.js new "Mi descripción"
```

## Ubicación

Todo está autocontenido en `.kiro/`:
```
.kiro/
├── steering/version-control.md          ← Este archivo (reglas)
├── hooks/
│   ├── log-conversation.hook.json       ← Log conversación + track cambios
│   ├── start-version.hook.json          ← Botón manual para nueva versión
│   ├── track-changes.hook.json          ← Auto-detecta archivos nuevos
│   └── track-edits.hook.json            ← Auto-detecta ediciones
└── agents/version-control/
    ├── cli.js                           ← CLI
    ├── version-manager.js               ← Lógica core
    └── versions/
        ├── manifest.json                ← Índice global
        ├── .active-session              ← Token de sesión activa (auto-generado)
        └── vX/
            ├── metadata.json            ← Info de la versión
            ├── changes.json             ← Cambios técnicos
            ├── conversation.md          ← Conversación legible
            ├── conversation.json        ← Conversación estructurada
            ├── snapshot/                ← Archivos guardados
            └── subversions/             ← Cambios incrementales
                └── vX.Y/
                    ├── metadata.json    ← Info de la sub-versión
                    └── snapshot/        ← Solo archivos modificados
```

## Comportamiento

### Crear versiones (MANUAL - el usuario lo pide)
Las versiones se crean **solo cuando el usuario lo solicita explícitamente**. No hay auto-detección de sesiones ni timeouts.

Ejemplos de cómo el usuario puede pedirlo:
- "Crea una nueva versión"
- "Inicia v2"  
- "Nueva versión: descripción de lo que voy a hacer"
- "Versión nueva para este feature"

El agente entonces ejecuta:
```
node .kiro/agents/version-control/cli.js new "Descripción"
```

### Tracking de archivos (AUTOMÁTICO dentro de una versión activa)
Una vez que existe una versión activa, el tracking de cambios sí es automático:

#### Archivo creado
```
node .kiro/agents/version-control/cli.js track-new <ruta> "descripción"
```
Se guarda el archivo completo en el snapshot.

#### Archivo modificado
```
node .kiro/agents/version-control/cli.js track-mod <ruta> "descripción"
```
Se guarda con anotaciones `[MODIFIED vX]` en las líneas cambiadas.
Si el archivo ya fue trackeado antes en la misma versión, se crea automáticamente una **sub-versión** (v1.1, v1.2, etc.) con solo ese archivo.

### Conversación (AUTOMÁTICO)
```
node .kiro/agents/version-control/cli.js log-user "Lo que pidió"
node .kiro/agents/version-control/cli.js log-agent "Lo que hice"
```

### Consultas
```
node .kiro/agents/version-control/cli.js status
node .kiro/agents/version-control/cli.js history
node .kiro/agents/version-control/cli.js conversation
node .kiro/agents/version-control/cli.js show <archivo> [versión]
node .kiro/agents/version-control/cli.js subversions [N]
node .kiro/agents/version-control/cli.js show-sub <archivo> <N.M>
```

## Reglas
- **Las versiones se crean SOLO cuando el usuario lo pide explícitamente**
- NO crear versiones automáticamente por timeout o detección de sesiones
- NO registrar cambios en archivos dentro de `.kiro/agents/version-control/versions/`
- NO registrar cambios en `.kiro/hooks/` ni `.kiro/steering/`
- Al restaurar, se limpian anotaciones automáticamente
- JSON se guarda sin comentarios (no los soporta)
- La conversación se guarda en MD (legible) y JSON (consultas)
- Si no hay versión activa y el usuario no pide crear una, simplemente trabaja normal sin trackear

## Instalación en otro proyecto

Copiar la carpeta `.kiro/` completa a cualquier proyecto. El agente funciona de inmediato.
