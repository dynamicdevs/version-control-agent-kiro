#!/usr/bin/env node

/**
 * CLI del Version Control Agent
 * Uso: node .kiro/agents/version-control/cli.js <comando> [args]
 */

const vm = require('./version-manager');
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'status': {
    const status = vm.getCurrentStatus();
    if (!status.metadata) { console.log('No hay versiones registradas.'); break; }
    console.log(vm.getFormattedSummary());
    break;
  }

  case 'history': {
    const manifest = vm.getManifest();
    console.log('\n=== HISTORIAL DE VERSIONES ===\n');
    if (manifest.versions.length === 0) { console.log('  Sin versiones.'); break; }
    for (const v of manifest.versions) {
      const icon = v.status === 'active' ? '● (activa)' : '○ (cerrada)';
      console.log(`  ${v.label} ${icon}`);
      console.log(`    ${v.summary}`);
      console.log(`    ${v.createdAt}\n`);
    }
    break;
  }

  case 'new': {
    const summary = args.join(' ') || undefined;
    const version = vm.createVersion(summary);
    console.log(`\n✓ Versión creada: ${version.label}`);
    console.log(`  ${version.summary}`);
    console.log(`  Sesión: ${version.sessionId}\n`);
    break;
  }

  case 'track-new': {
    const [file, ...desc] = args;
    if (!file) { console.error('Uso: cli.js track-new <archivo> [desc]'); process.exit(1); }
    const c = vm.trackNewFile(file, desc.join(' '));
    if (c) console.log(`✓ Nuevo: ${c.file}`);
    break;
  }

  case 'track-mod': {
    const [file, ...desc] = args;
    if (!file) { console.error('Uso: cli.js track-mod <archivo> [desc]'); process.exit(1); }
    const c = vm.trackModifiedFile(file, desc.join(' '));
    if (c && c.subVersion) {
      console.log(`✓ Sub-versión creada: ${c.subVersion}`);
      console.log(`  Modificado: ${c.file}`);
    } else if (c) {
      console.log(`✓ Modificado: ${c.file} (con anotaciones)`);
    }
    break;
  }

  case 'track-del': {
    const [file, ...desc] = args;
    if (!file) { console.error('Uso: cli.js track-del <archivo> [desc]'); process.exit(1); }
    const c = vm.trackDeletedFile(file, desc.join(' '));
    if (c) console.log(`✓ Eliminado: ${c.file}`);
    break;
  }

  case 'show': {
    const [file, vid] = args;
    if (!file) { console.error('Uso: cli.js show <archivo> [versión]'); process.exit(1); }
    const v = vid ? parseInt(vid) : vm.getManifest().currentVersion;
    const content = vm.getFileAtVersion(file, v);
    if (content) { console.log(`\n--- ${file} @ v${v} ---\n${content}\n--- fin ---\n`); }
    else console.log(`No encontrado: ${file} en v${v}`);
    break;
  }

  case 'restore': {
    const vid = parseInt(args[0]);
    if (!vid) { console.error('Uso: cli.js restore <versión>'); process.exit(1); }
    const r = vm.restoreVersion(vid);
    if (r) { console.log(`✓ Restaurada v${r.versionId}`); r.restoredFiles.forEach(f => console.log(`  • ${f}`)); }
    break;
  }

  case 'log-user': {
    const msg = args.join(' ');
    if (!msg) { console.error('Uso: cli.js log-user <mensaje>'); process.exit(1); }
    const e = vm.logUserMessage(msg);
    if (e) console.log(`✓ Usuario #${e.id}`);
    break;
  }

  case 'log-agent': {
    const msg = args.join(' ');
    if (!msg) { console.error('Uso: cli.js log-agent <mensaje>'); process.exit(1); }
    const e = vm.logAgentMessage(msg);
    if (e) console.log(`✓ Agente #${e.id}`);
    break;
  }

  case 'conversation': {
    const vid = args[0] ? parseInt(args[0]) : undefined;
    console.log(vm.getConversationMarkdown(vid));
    break;
  }

  case 'conversation-summary': {
    const s = vm.getConversationSummary(args[0] ? parseInt(args[0]) : undefined);
    console.log(`\n  v${s.versionId} | ${s.totalMessages} mensajes (${s.userMessages} user, ${s.agentMessages} agent)\n`);
    break;
  }

  case 'subversions': {
    const vid = args[0] ? parseInt(args[0]) : vm.getManifest().currentVersion;
    const subs = vm.getSubVersions(vid);
    if (subs.length === 0) { console.log(`\n  v${vid}: Sin sub-versiones.\n`); break; }
    console.log(`\n  === SUB-VERSIONES de v${vid} ===\n`);
    subs.forEach(sv => {
      console.log(`  📌 ${sv.label}`);
      console.log(`     ${sv.description}`);
      console.log(`     Archivos: ${sv.filesChanged.join(', ')}`);
      console.log(`     Creada: ${sv.createdAt}\n`);
    });
    break;
  }

  case 'show-sub': {
    const [file, sub] = args;
    if (!file || !sub) { console.error('Uso: cli.js show-sub <archivo> <sub-versión>'); console.error('Ej: cli.js show-sub src/App.jsx 1.1'); process.exit(1); }
    const parts = sub.split('.');
    const parentV = parseInt(parts[0]);
    const subV = parseInt(parts[1]);
    const content = vm.getFileAtSubVersion(file, parentV, subV);
    if (content) { console.log(`\n--- ${file} @ v${sub} ---\n${content}\n--- fin ---\n`); }
    else console.log(`No encontrado: ${file} en v${sub}`);
    break;
  }

  case 'check-session': {
    const token = args[0] === '__none__' ? null : args[0];
    const result = vm.checkSession(token || null);
    console.log(JSON.stringify(result));
    break;
  }

  case 'start-session': {
    const token = args[0] === '__none__' ? null : args[0];
    const summary = args.slice(1).join(' ') || undefined;
    const version = vm.startNewSession(token, summary);
    console.log(`\n✓ Nueva sesión iniciada: ${version.label}`);
    console.log(`  ${version.summary}`);
    console.log(`  Sesión: ${version.sessionId}\n`);
    break;
  }

  case 'set-token': {
    const token = args[0];
    if (!token) { console.error('Uso: cli.js set-token <session-token>'); process.exit(1); }
    vm.setActiveSessionToken(token);
    console.log(`✓ Token de sesión actualizado`);
    break;
  }

  case 'summary': {
    const vid = args[0] ? parseInt(args[0]) : undefined;
    console.log(vm.getFormattedSummary(vid));
    break;
  }

  default:
    console.log(`
  Version Control Agent para Kiro
  ════════════════════════════════

  node .kiro/agents/version-control/cli.js <comando>

  VERSIONES:
    new [resumen]           Crear nueva versión
    status                  Estado actual
    history                 Historial
    summary [N]             Resumen de versión
    subversions [N]         Ver sub-versiones de vN

  SESIÓN:
    check-session <token>   Verifica si es sesión nueva (retorna JSON)
    start-session <token> [resumen]  Crea versión + guarda token
    set-token <token>       Actualiza token sin crear versión

  ARCHIVOS:
    track-new <file> [desc] Registrar archivo nuevo
    track-mod <file> [desc] Registrar modificación (crea sub-versión si ya existía)
    track-del <file> [desc] Registrar eliminación
    show <file> [N]         Ver archivo en versión
    show-sub <file> <N.M>   Ver archivo en sub-versión (ej: 1.1)
    restore <N>             Restaurar versión

  CONVERSACIÓN:
    log-user <msg>          Registrar mensaje usuario
    log-agent <msg>         Registrar respuesta agente
    conversation [N]        Ver conversación
    conversation-summary    Resumen
`);
}
