/**
 * Version Manager - Agente de Control de Versiones para Kiro
 * 
 * Ubicación: .kiro/agents/version-control/
 * Uso: node .kiro/agents/version-control/cli.js <comando>
 * 
 * Lógica:
 * - Archivo nuevo → se guarda completo en el snapshot
 * - Archivo modificado → se guarda con comentarios marcando cambios
 * - Conversación → se guarda completa en cada versión
 * - Cada sesión de chat = una versión nueva
 */

const fs = require('fs');
const path = require('path');

// Directorio de versiones relativo al root del proyecto
const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const VERSIONS_DIR = path.join(ROOT_DIR, '.kiro', 'agents', 'version-control', 'versions');
const MANIFEST_PATH = path.join(VERSIONS_DIR, 'manifest.json');
const SESSION_FILE = path.join(VERSIONS_DIR, '.active-session');

// Mapeo de extensiones a estilos de comentario
const COMMENT_STYLES = {
  '.js': { start: '// ', end: '' },
  '.ts': { start: '// ', end: '' },
  '.jsx': { start: '// ', end: '' },
  '.tsx': { start: '// ', end: '' },
  '.py': { start: '# ', end: '' },
  '.rb': { start: '# ', end: '' },
  '.sh': { start: '# ', end: '' },
  '.yaml': { start: '# ', end: '' },
  '.yml': { start: '# ', end: '' },
  '.css': { start: '/* ', end: ' */' },
  '.html': { start: '<!-- ', end: ' -->' },
  '.json': { start: '', end: '' },
  '.md': { start: '<!-- ', end: ' -->' },
  '.java': { start: '// ', end: '' },
  '.c': { start: '// ', end: '' },
  '.cpp': { start: '// ', end: '' },
  '.go': { start: '// ', end: '' },
  '.rs': { start: '// ', end: '' },
  '.php': { start: '// ', end: '' },
  '.swift': { start: '// ', end: '' },
  '.kt': { start: '// ', end: '' },
};

function getCommentStyle(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return COMMENT_STYLES[ext] || { start: '// ', end: '' };
}

// ═══════════════════════════════════════════════════════════════
// MANIFEST
// ═══════════════════════════════════════════════════════════════

function getManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    const initial = { currentVersion: 0, versions: [] };
    fs.mkdirSync(VERSIONS_DIR, { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
}

function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

// ═══════════════════════════════════════════════════════════════
// VERSIONES
// ═══════════════════════════════════════════════════════════════

function createVersion(summary = '') {
  const manifest = getManifest();
  const newId = manifest.currentVersion + 1;
  const versionDir = path.join(VERSIONS_DIR, `v${newId}`);
  const snapshotDir = path.join(versionDir, 'snapshot');

  fs.mkdirSync(snapshotDir, { recursive: true });

  const metadata = {
    id: newId,
    label: `v${newId}`,
    createdAt: new Date().toISOString(),
    summary: summary || `Versión ${newId}`,
    sessionId: `session-${String(newId).padStart(3, '0')}`,
    status: 'active',
    totalChanges: 0,
    filesAffected: [],
    autoSummary: ''
  };

  if (manifest.currentVersion > 0) {
    closeVersion(manifest.currentVersion);
  }

  fs.writeFileSync(path.join(versionDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
  fs.writeFileSync(path.join(versionDir, 'changes.json'), JSON.stringify({ version: newId, changes: [] }, null, 2));

  manifest.currentVersion = newId;
  manifest.versions.push({
    id: newId,
    label: `v${newId}`,
    createdAt: metadata.createdAt,
    summary: metadata.summary,
    status: 'active'
  });

  const prevInManifest = manifest.versions.find(v => v.id === newId - 1);
  if (prevInManifest) prevInManifest.status = 'closed';

  saveManifest(manifest);
  return metadata;
}

function closeVersion(versionId) {
  const versionDir = path.join(VERSIONS_DIR, `v${versionId}`);
  const metadataPath = path.join(versionDir, 'metadata.json');
  const changesPath = path.join(versionDir, 'changes.json');

  if (!fs.existsSync(metadataPath)) return;

  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  metadata.status = 'closed';
  metadata.closedAt = new Date().toISOString();

  if (fs.existsSync(changesPath)) {
    const changes = JSON.parse(fs.readFileSync(changesPath, 'utf-8'));
    metadata.autoSummary = generateSummary(changes.changes);
  }

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

function generateSummary(changes) {
  if (changes.length === 0) return 'Sin cambios registrados.';

  const created = changes.filter(c => c.type === 'created');
  const modified = changes.filter(c => c.type === 'modified');
  const deleted = changes.filter(c => c.type === 'deleted');
  const parts = [];

  if (created.length > 0) parts.push(`Creados (${created.length}): ${created.map(c => c.file).join(', ')}`);
  if (modified.length > 0) parts.push(`Modificados (${modified.length}): ${modified.map(c => c.file).join(', ')}`);
  if (deleted.length > 0) parts.push(`Eliminados (${deleted.length}): ${deleted.map(c => c.file).join(', ')}`);

  parts.push('');
  parts.push('Detalle:');
  for (const change of changes) {
    parts.push(`  - [${change.type}] ${change.file}: ${change.description}`);
  }

  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// TRACKING DE ARCHIVOS
// ═══════════════════════════════════════════════════════════════

function trackNewFile(filePath, description = '') {
  const manifest = getManifest();
  const currentVersion = manifest.currentVersion;
  if (currentVersion === 0) { console.error('No hay versión activa.'); return null; }

  const versionDir = path.join(VERSIONS_DIR, `v${currentVersion}`);
  const absolutePath = path.resolve(ROOT_DIR, filePath);

  if (!fs.existsSync(absolutePath)) { console.error(`No existe: ${filePath}`); return null; }

  const snapshotPath = path.join(versionDir, 'snapshot', filePath);
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.copyFileSync(absolutePath, snapshotPath);

  return registerChange(versionDir, filePath, 'created', description || `Archivo creado: ${filePath}`);
}

function trackModifiedFile(filePath, description = '') {
  const manifest = getManifest();
  const currentVersion = manifest.currentVersion;
  if (currentVersion === 0) { console.error('No hay versión activa.'); return null; }

  const versionDir = path.join(VERSIONS_DIR, `v${currentVersion}`);
  const absolutePath = path.resolve(ROOT_DIR, filePath);

  if (!fs.existsSync(absolutePath)) { console.error(`No existe: ${filePath}`); return null; }

  const newContent = fs.readFileSync(absolutePath, 'utf-8');
  const newLines = newContent.split('\n');

  const previousContent = findPreviousSnapshot(filePath, currentVersion);
  const previousLines = previousContent ? previousContent.split('\n') : [];

  // Determinar si el archivo ya fue trackeado antes en esta versión
  const changesPath = path.join(versionDir, 'changes.json');
  const changes = JSON.parse(fs.readFileSync(changesPath, 'utf-8'));
  const alreadyTracked = changes.changes.some(c => c.file === filePath);

  if (alreadyTracked) {
    // Crear sub-versión con solo este archivo modificado
    const subVersion = createSubVersion(currentVersion, filePath, newLines, previousLines, description);
    return subVersion;
  }

  // Primera vez que se trackea en esta versión - va al snapshot principal
  const annotatedContent = annotateChanges(newLines, previousLines, filePath, currentVersion);

  const snapshotPath = path.join(versionDir, 'snapshot', filePath);
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, annotatedContent, 'utf-8');

  return registerChange(versionDir, filePath, 'modified', description || `Archivo modificado: ${filePath}`);
}

function createSubVersion(parentVersion, filePath, newLines, previousLines, description) {
  const versionDir = path.join(VERSIONS_DIR, `v${parentVersion}`);
  const subversionsDir = path.join(versionDir, 'subversions');

  // Determinar siguiente número de sub-versión
  let nextSub = 1;
  if (fs.existsSync(subversionsDir)) {
    const existing = fs.readdirSync(subversionsDir).filter(d => 
      fs.statSync(path.join(subversionsDir, d)).isDirectory()
    );
    nextSub = existing.length + 1;
  }

  const subLabel = `v${parentVersion}.${nextSub}`;
  const subDir = path.join(subversionsDir, subLabel);
  const subSnapshotDir = path.join(subDir, 'snapshot');
  fs.mkdirSync(subSnapshotDir, { recursive: true });

  // Guardar solo el archivo modificado con anotaciones
  const annotatedContent = annotateChanges(newLines, previousLines, filePath, `${parentVersion}.${nextSub}`);
  const snapshotPath = path.join(subSnapshotDir, filePath);
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, annotatedContent, 'utf-8');

  // También actualizar el snapshot principal con la última versión
  const mainSnapshotPath = path.join(versionDir, 'snapshot', filePath);
  fs.mkdirSync(path.dirname(mainSnapshotPath), { recursive: true });
  fs.writeFileSync(mainSnapshotPath, annotatedContent, 'utf-8');

  // Metadata de la sub-versión
  const subMetadata = {
    label: subLabel,
    parentVersion: parentVersion,
    subVersion: nextSub,
    createdAt: new Date().toISOString(),
    description: description || `Modificación incremental de ${filePath}`,
    filesChanged: [filePath]
  };
  fs.writeFileSync(path.join(subDir, 'metadata.json'), JSON.stringify(subMetadata, null, 2));

  // Registrar en el changes.json principal
  const change = registerChange(versionDir, filePath, 'modified', `[${subLabel}] ${description || `Archivo modificado: ${filePath}`}`);

  // Actualizar metadata principal con info de sub-versiones
  const metadataPath = path.join(versionDir, 'metadata.json');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  if (!metadata.subVersions) metadata.subVersions = [];
  metadata.subVersions.push({ label: subLabel, createdAt: subMetadata.createdAt, files: [filePath], description: subMetadata.description });
  metadata.latestSubVersion = subLabel;
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  return { ...change, subVersion: subLabel };
}

function getSubVersions(versionId) {
  const subversionsDir = path.join(VERSIONS_DIR, `v${versionId}`, 'subversions');
  if (!fs.existsSync(subversionsDir)) return [];

  const dirs = fs.readdirSync(subversionsDir).filter(d =>
    fs.statSync(path.join(subversionsDir, d)).isDirectory()
  ).sort();

  return dirs.map(dir => {
    const metaPath = path.join(subversionsDir, dir, 'metadata.json');
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    }
    return { label: dir };
  });
}

function getFileAtSubVersion(filePath, parentVersion, subVersion) {
  const subLabel = `v${parentVersion}.${subVersion}`;
  const p = path.join(VERSIONS_DIR, `v${parentVersion}`, 'subversions', subLabel, 'snapshot', filePath);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf-8');
}

function trackDeletedFile(filePath, description = '') {
  const manifest = getManifest();
  const currentVersion = manifest.currentVersion;
  if (currentVersion === 0) return null;

  const versionDir = path.join(VERSIONS_DIR, `v${currentVersion}`);
  return registerChange(versionDir, filePath, 'deleted', description || `Archivo eliminado: ${filePath}`);
}

function trackChange(filePath, type = 'modified', description = '') {
  switch (type) {
    case 'created': return trackNewFile(filePath, description);
    case 'modified': return trackModifiedFile(filePath, description);
    case 'deleted': return trackDeletedFile(filePath, description);
    default: return trackModifiedFile(filePath, description);
  }
}

// ═══════════════════════════════════════════════════════════════
// DIFF & ANOTACIONES
// ═══════════════════════════════════════════════════════════════

function findPreviousSnapshot(filePath, currentVersion) {
  const currentSnapshotPath = path.join(VERSIONS_DIR, `v${currentVersion}`, 'snapshot', filePath);
  if (fs.existsSync(currentSnapshotPath)) {
    return stripAnnotations(fs.readFileSync(currentSnapshotPath, 'utf-8'));
  }

  for (let v = currentVersion - 1; v >= 1; v--) {
    const snapshotPath = path.join(VERSIONS_DIR, `v${v}`, 'snapshot', filePath);
    if (fs.existsSync(snapshotPath)) {
      return stripAnnotations(fs.readFileSync(snapshotPath, 'utf-8'));
    }
  }
  return null;
}

function stripAnnotations(content) {
  const lines = content.split('\n');
  return lines.filter(line => !line.match(/^\s*(\/\/|#|\/\*|<!--)\s*\[MODIFIED v\d+\]/)).join('\n');
}

function computeDiff(oldLines, newLines) {
  const m = oldLines.length;
  const n = newLines.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const ops = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ type: 'keep', line: newLines[j - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'add', line: newLines[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'remove', line: oldLines[i - 1] });
      i--;
    }
  }
  return ops;
}

function annotateChanges(newLines, previousLines, filePath, versionId) {
  const commentStyle = getCommentStyle(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') return newLines.join('\n');
  if (previousLines.length === 0) return newLines.join('\n');

  const ops = computeDiff(previousLines, newLines);
  const result = [];

  for (let idx = 0; idx < ops.length; idx++) {
    const op = ops[idx];
    if (op.type === 'keep') {
      result.push(op.line);
    } else if (op.type === 'add') {
      const prevOp = idx > 0 ? ops[idx - 1] : null;
      if (prevOp && prevOp.type === 'remove') {
        result.push(op.line);
      } else {
        result.push(`${commentStyle.start}[MODIFIED v${versionId}] Línea añadida${commentStyle.end}`);
        result.push(op.line);
      }
    } else if (op.type === 'remove') {
      const nextOp = idx + 1 < ops.length ? ops[idx + 1] : null;
      if (nextOp && nextOp.type === 'add') {
        result.push(`${commentStyle.start}[MODIFIED v${versionId}] Modificado (antes: "${op.line.trim()}")${commentStyle.end}`);
      } else {
        result.push(`${commentStyle.start}[MODIFIED v${versionId}] Eliminado: "${op.line.trim()}"${commentStyle.end}`);
      }
    }
  }

  return result.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// REGISTRO DE CAMBIOS
// ═══════════════════════════════════════════════════════════════

function registerChange(versionDir, filePath, type, description) {
  const changesPath = path.join(versionDir, 'changes.json');
  const metadataPath = path.join(versionDir, 'metadata.json');

  const changes = JSON.parse(fs.readFileSync(changesPath, 'utf-8'));
  const change = { timestamp: new Date().toISOString(), type, file: filePath, description };
  changes.changes.push(change);
  fs.writeFileSync(changesPath, JSON.stringify(changes, null, 2));

  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  metadata.totalChanges = changes.changes.length;
  if (!metadata.filesAffected.includes(filePath)) metadata.filesAffected.push(filePath);
  metadata.autoSummary = generateSummary(changes.changes);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  return change;
}

// ═══════════════════════════════════════════════════════════════
// CONVERSACIÓN
// ═══════════════════════════════════════════════════════════════

function logUserMessage(message) {
  const manifest = getManifest();
  if (manifest.currentVersion === 0) return null;
  return appendToConversation(manifest.currentVersion, 'user', message);
}

function logAgentMessage(message) {
  const manifest = getManifest();
  if (manifest.currentVersion === 0) return null;
  return appendToConversation(manifest.currentVersion, 'agent', message);
}

function appendToConversation(versionId, role, message) {
  const versionDir = path.join(VERSIONS_DIR, `v${versionId}`);
  const conversationPath = path.join(versionDir, 'conversation.md');
  const conversationJsonPath = path.join(versionDir, 'conversation.json');

  const timestamp = new Date().toISOString();
  const timeFormatted = new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' });

  // Markdown
  let mdEntry = '';
  if (!fs.existsSync(conversationPath)) {
    mdEntry += `# Conversación - v${versionId}\n\n> Sesión iniciada: ${timestamp}\n\n---\n\n`;
  }
  const icon = role === 'user' ? '🧑 Usuario' : '🤖 Agente';
  mdEntry += `## ${icon} (${timeFormatted})\n\n${message}\n\n---\n\n`;
  fs.appendFileSync(conversationPath, mdEntry, 'utf-8');

  // JSON
  let data = { versionId, messages: [] };
  if (fs.existsSync(conversationJsonPath)) {
    data = JSON.parse(fs.readFileSync(conversationJsonPath, 'utf-8'));
  }
  const entry = { id: data.messages.length + 1, timestamp, role, message };
  data.messages.push(entry);
  fs.writeFileSync(conversationJsonPath, JSON.stringify(data, null, 2));

  return entry;
}

function getConversation(versionId) {
  const vid = versionId || getManifest().currentVersion;
  const p = path.join(VERSIONS_DIR, `v${vid}`, 'conversation.json');
  if (!fs.existsSync(p)) return { versionId: vid, messages: [] };
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function getConversationMarkdown(versionId) {
  const vid = versionId || getManifest().currentVersion;
  const p = path.join(VERSIONS_DIR, `v${vid}`, 'conversation.md');
  if (!fs.existsSync(p)) return `No hay conversación registrada para v${vid}.`;
  return fs.readFileSync(p, 'utf-8');
}

function getConversationSummary(versionId) {
  const conversation = getConversation(versionId);
  const total = conversation.messages.length;
  const userMsgs = conversation.messages.filter(m => m.role === 'user').length;
  const agentMsgs = conversation.messages.filter(m => m.role === 'agent').length;
  return {
    versionId: conversation.versionId,
    totalMessages: total,
    userMessages: userMsgs,
    agentMessages: agentMsgs,
    firstMessage: total > 0 ? conversation.messages[0].timestamp : null,
    lastMessage: total > 0 ? conversation.messages[total - 1].timestamp : null
  };
}

// ═══════════════════════════════════════════════════════════════
// CONSULTAS
// ═══════════════════════════════════════════════════════════════

function getHistory() {
  const manifest = getManifest();
  return manifest.versions.map(v => ({ ...v, details: getVersionDetails(v.id) }));
}

function getVersionDetails(versionId) {
  const versionDir = path.join(VERSIONS_DIR, `v${versionId}`);
  const metadataPath = path.join(versionDir, 'metadata.json');
  const changesPath = path.join(versionDir, 'changes.json');
  if (!fs.existsSync(metadataPath)) return null;

  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  const changes = fs.existsSync(changesPath) ? JSON.parse(fs.readFileSync(changesPath, 'utf-8')) : { changes: [] };
  return { metadata, changes: changes.changes };
}

function getFileAtVersion(filePath, versionId) {
  const p = path.join(VERSIONS_DIR, `v${versionId}`, 'snapshot', filePath);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf-8');
}

function restoreVersion(versionId) {
  const snapshotDir = path.join(VERSIONS_DIR, `v${versionId}`, 'snapshot');
  if (!fs.existsSync(snapshotDir)) { console.error(`No existe snapshot para v${versionId}`); return false; }

  const files = getAllFiles(snapshotDir);
  const restored = [];
  for (const file of files) {
    const relativePath = path.relative(snapshotDir, file);
    const destPath = path.resolve(ROOT_DIR, relativePath);
    const content = stripAnnotations(fs.readFileSync(file, 'utf-8'));
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, content, 'utf-8');
    restored.push(relativePath);
  }
  return { versionId, restoredFiles: restored };
}

function getCurrentStatus() {
  const manifest = getManifest();
  if (manifest.currentVersion === 0) return { status: 'sin versiones', currentVersion: null };
  const details = getVersionDetails(manifest.currentVersion);
  return { status: 'activa', currentVersion: manifest.currentVersion, label: `v${manifest.currentVersion}`, ...details };
}

function getFormattedSummary(versionId) {
  const details = getVersionDetails(versionId || getManifest().currentVersion);
  if (!details) return 'Versión no encontrada.';

  const { metadata, changes } = details;
  const lines = [];
  lines.push(`══════════════════════════════════════`);
  lines.push(`  ${metadata.label.toUpperCase()} - ${metadata.summary}`);
  lines.push(`══════════════════════════════════════`);
  lines.push(`  Estado: ${metadata.status}`);
  lines.push(`  Creada: ${metadata.createdAt}`);
  if (metadata.closedAt) lines.push(`  Cerrada: ${metadata.closedAt}`);
  lines.push(`  Sesión: ${metadata.sessionId}`);
  lines.push(`  Total cambios: ${metadata.totalChanges}`);
  if (metadata.latestSubVersion) lines.push(`  Última sub-versión: ${metadata.latestSubVersion}`);
  lines.push('');

  if (metadata.filesAffected.length > 0) {
    lines.push('  Archivos afectados:');
    metadata.filesAffected.forEach(f => lines.push(`    • ${f}`));
    lines.push('');
  }

  // Mostrar sub-versiones si existen
  const subVersions = getSubVersions(metadata.id);
  if (subVersions.length > 0) {
    lines.push('  Sub-versiones (incrementales):');
    subVersions.forEach(sv => {
      lines.push(`    📌 ${sv.label} - ${sv.description}`);
      sv.filesChanged.forEach(f => lines.push(`       • ${f}`));
    });
    lines.push('');
  }

  if (changes.length > 0) {
    lines.push('  Historial de cambios:');
    changes.forEach(c => {
      const icon = c.type === 'created' ? '＋' : c.type === 'deleted' ? '－' : '～';
      lines.push(`    ${icon} [${c.type}] ${c.file}`);
      lines.push(`      ${c.description}`);
    });
  }

  lines.push('');
  lines.push(`══════════════════════════════════════`);
  return lines.join('\n');
}

function getAllFiles(dirPath, arr = []) {
  if (!fs.existsSync(dirPath)) return arr;
  for (const file of fs.readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) getAllFiles(fullPath, arr);
    else arr.push(fullPath);
  }
  return arr;
}

// ═══════════════════════════════════════════════════════════════
// DETECCIÓN DE SESIÓN
// ═══════════════════════════════════════════════════════════════

/**
 * Detecta si es una sesión nueva basándose en:
 * 1. Si no hay versiones → crear
 * 2. Si la versión activa no tiene actividad reciente (> 2 min sin log) → crear
 * 3. Si se pasa un sessionToken diferente al guardado → crear
 * 
 * El sessionToken es un ID efímero que el hook genera una sola vez
 * y envía en cada promptSubmit de la misma conversación.
 */
function getActiveSessionToken() {
  if (!fs.existsSync(SESSION_FILE)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    return data;
  } catch {
    return null;
  }
}

function setActiveSessionToken(token) {
  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  const data = { token, updatedAt: new Date().toISOString() };
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data), 'utf-8');
}

/**
 * Verifica si necesitamos crear una nueva versión.
 * 
 * Lógica simple y robusta:
 * - Si no hay versiones → needsNew
 * - Si se pasa un token y es diferente al guardado → needsNew
 * - Si no se pasa token: revisa si la última conversación fue hace > 2 min
 *   (asume nueva sesión si no hay actividad reciente)
 */
function checkSession(sessionToken) {
  const manifest = getManifest();

  // Sin versiones → siempre crear
  if (manifest.currentVersion === 0) {
    return { needsNew: true, reason: 'no-versions' };
  }

  const stored = getActiveSessionToken();

  // Con token explícito
  if (sessionToken) {
    // No hay token guardado → primera vez, registrar y no crear
    if (!stored) {
      setActiveSessionToken(sessionToken);
      return { needsNew: false, reason: 'token-initialized' };
    }

    // Token diferente → nueva sesión
    if (stored.token !== sessionToken) {
      return { needsNew: true, reason: 'new-session' };
    }

    // Mismo token → misma sesión, actualizar timestamp
    setActiveSessionToken(sessionToken);
    return { needsNew: false, reason: 'same-session' };
  }

  // Sin token: usar heurística de tiempo
  // Revisar último mensaje en la conversación actual
  const currentV = manifest.currentVersion;
  const convPath = path.join(VERSIONS_DIR, `v${currentV}`, 'conversation.json');
  
  if (!fs.existsSync(convPath)) {
    // Versión sin conversación aún → podría ser nueva sesión o primera interacción
    // Verificar si la versión fue creada hace poco (< 30 seg)
    const metaPath = path.join(VERSIONS_DIR, `v${currentV}`, 'metadata.json');
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      const created = new Date(meta.createdAt);
      const now = new Date();
      const diffSec = (now - created) / 1000;
      if (diffSec < 30) {
        return { needsNew: false, reason: 'version-just-created' };
      }
    }
    return { needsNew: true, reason: 'no-recent-activity' };
  }

  const conv = JSON.parse(fs.readFileSync(convPath, 'utf-8'));
  if (conv.messages.length === 0) {
    return { needsNew: true, reason: 'empty-conversation' };
  }

  const lastMsg = conv.messages[conv.messages.length - 1];
  const lastTime = new Date(lastMsg.timestamp);
  const now = new Date();
  const diffMin = (now - lastTime) / 1000 / 60;

  // Si la última actividad fue hace más de 2 minutos, asumir nueva sesión
  if (diffMin > 2) {
    return { needsNew: true, reason: 'session-timeout', lastActivity: lastMsg.timestamp, minutesAgo: Math.round(diffMin) };
  }

  return { needsNew: false, reason: 'recent-activity', lastActivity: lastMsg.timestamp };
}

/**
 * Inicia una nueva sesión: crea versión y guarda el token.
 */
function startNewSession(sessionToken, summary) {
  const version = createVersion(summary);
  if (sessionToken) {
    setActiveSessionToken(sessionToken);
  }
  return version;
}

module.exports = {
  getManifest, createVersion, closeVersion,
  trackChange, trackNewFile, trackModifiedFile, trackDeletedFile,
  getHistory, getVersionDetails, getFileAtVersion,
  restoreVersion, getCurrentStatus, getFormattedSummary, generateSummary,
  logUserMessage, logAgentMessage, getConversation, getConversationMarkdown, getConversationSummary,
  getSubVersions, getFileAtSubVersion, createSubVersion,
  checkSession, startNewSession, getActiveSessionToken, setActiveSessionToken
};
