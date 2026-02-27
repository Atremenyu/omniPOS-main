import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import unzipper from 'unzipper';
import { google } from 'googleapis';

const LOG_PATH = process.env.BACKUP_LOG_PATH || path.join(process.cwd(), 'data', 'backup_log.json');

/**
 * Agrega una entrada al log de backups.
 */
function appendBackupLog(entry) {
    let log = [];
    const dir = path.dirname(LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(LOG_PATH)) {
        try { log = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')); } catch { log = []; }
    }
    log.unshift({ ...entry, timestamp: new Date().toISOString() });
    // Mantener solo los últimos 50 registros
    fs.writeFileSync(LOG_PATH, JSON.stringify(log.slice(0, 50), null, 2));
}

/**
 * Lee el log de backups.
 */
export function getBackupLog() {
    if (!fs.existsSync(LOG_PATH)) return [];
    try { return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')); } catch { return []; }
}

const TOKEN_PATH = process.env.TOKEN_PATH || path.join(process.cwd(), 'data', 'google_token.json');

/**
 * Crea un cliente OAuth2 usando las variables de entorno.
 */
function getOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
}

/**
 * Genera la URL de autorización para que el usuario autorice el acceso.
 * Solo se necesita hacer UNA VEZ. Luego el refresh token se guarda automáticamente.
 */
export function getAuthUrl() {
    const oAuth2Client = getOAuth2Client();
    return oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.file'],
        prompt: 'consent', // Fuerza a obtener el refresh_token siempre
    });
}

/**
 * Intercambia el código de autorización de Google por tokens y los guarda en disco.
 */
export async function saveTokenFromCode(code) {
    const oAuth2Client = getOAuth2Client();
    const { tokens } = await oAuth2Client.getToken(code);
    const dir = path.dirname(TOKEN_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('[DriveBackup] Token guardado en:', TOKEN_PATH);
    return tokens;
}

/**
 * Verifica si ya existe un token guardado (es decir, ya fue autorizado).
 */
export function isAuthenticated() {
    return fs.existsSync(TOKEN_PATH);
}

/**
 * Retorna un cliente OAuth2 ya autenticado con el token guardado.
 * Actualiza automáticamente el token si expira.
 */
async function getAuthenticatedClient() {
    if (!fs.existsSync(TOKEN_PATH)) {
        throw new Error('No hay token de acceso. Visita /api/auth/google para autorizar.');
    }

    const oAuth2Client = getOAuth2Client();
    const savedTokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oAuth2Client.setCredentials(savedTokens);

    // Si el token de acceso se renueva, guardar el actualizado
    oAuth2Client.on('tokens', (newTokens) => {
        const updated = { ...savedTokens, ...newTokens };
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(updated, null, 2));
        console.log('[DriveBackup] Token de acceso renovado automáticamente.');
    });

    return oAuth2Client;
}

/**
 * Crea un archivo ZIP del directorio indicado.
 */
export async function createBackupZip(sourceDir, outPath) {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => resolve(outPath));
        archive.on('error', (err) => reject(err));

        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}

/**
 * Sube un archivo ZIP a Google Drive del usuario autorizado.
 * Retorna el objeto { id, name } del archivo subido.
 */
export async function uploadToDrive(filePath) {
    const auth = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });

    const fileName = `omnirest_backup_${new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]}.zip`;

    const fileMetadata = { name: fileName };
    const media = {
        mimeType: 'application/zip',
        body: fs.createReadStream(filePath),
    };

    const file = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name',
    });

    const result = { fileId: file.data.id, fileName: file.data.name, status: 'success' };
    appendBackupLog(result);
    console.log(`[DriveBackup] Backup subido: ${file.data.name} (ID: ${file.data.id})`);
    return file.data;
}

/**
 * Lista los respaldos disponibles en Google Drive (archivos ZIP de OmniRest).
 */
export async function listDriveBackups() {
    const auth = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });

    const res = await drive.files.list({
        q: "name contains 'omnirest_backup_' and mimeType='application/zip' and trashed=false",
        fields: 'files(id, name, createdTime, size)',
        orderBy: 'createdTime desc',
        pageSize: 30,
    });

    return res.data.files || [];
}

/**
 * Descarga un respaldo de Drive por fileId y extrae database.sqlite
 * reemplazando la base de datos actual.
 * ⚠️ Debes cerrar la conexión a la BD ANTES de llamar esta función.
 */
export async function downloadAndRestore(fileId, currentDbPath) {
    const auth = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });

    const dataDir = path.dirname(currentDbPath);
    const tempZip = path.join(dataDir, '_restore_temp.zip');
    const tempDb = path.join(dataDir, '_restore_temp.db');

    // 1. Descargar el ZIP desde Drive
    const response = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
    );
    await new Promise((resolve, reject) => {
        const dest = fs.createWriteStream(tempZip);
        response.data.pipe(dest);
        dest.on('finish', resolve);
        dest.on('error', reject);
    });
    console.log('[DriveRestore] ZIP descargado:', tempZip);

    // 2. Extraer database.sqlite del ZIP
    await new Promise((resolve, reject) => {
        fs.createReadStream(tempZip)
            .pipe(unzipper.Parse())
            .on('entry', (entry) => {
                // El ZIP contiene 'database.sqlite' en la raíz
                if (entry.path === 'database.sqlite') {
                    entry.pipe(fs.createWriteStream(tempDb))
                        .on('finish', resolve)
                        .on('error', reject);
                } else {
                    entry.autodrain();
                }
            })
            .on('error', reject)
            .on('close', () => {
                // Si database.sqlite no estaba en el ZIP
                if (!fs.existsSync(tempDb)) reject(new Error('database.sqlite no encontrado en el respaldo'));
            });
    });

    // 3. Reemplazar base de datos actual (movimiento atómico)
    fs.copyFileSync(tempDb, currentDbPath);
    console.log('[DriveRestore] Base de datos restaurada:', currentDbPath);

    // 4. Limpieza
    try { fs.unlinkSync(tempZip); } catch { }
    try { fs.unlinkSync(tempDb); } catch { }
}
