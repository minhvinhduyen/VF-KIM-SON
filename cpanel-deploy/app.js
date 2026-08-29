// Entry point cho cPanel Phusion Passenger
// Passenger tự quản lý port, không cần app.listen()

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

const app = express();
// Middleware CORS + Anti-Cache cho API
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-facility-id, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    // QUAN TRỌNG: Cấm LiteSpeed, Netlify CDN, và browser cache response API
    // Nguyên nhân: cache cũ gây ra bug user bị xóa tự xuất hiện lại
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// === DATABASE CONFIG (đọc từ config/databases.json) ===
const CONFIG_PATH = path.join(__dirname, 'config', 'databases.json');
let configs = {};
const mysqlPools = {};

const loadConfigs = () => {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            configs = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        }
    } catch (e) { console.error("Lỗi tải config:", e); }
};
loadConfigs();

const getMysqlPool = (facilityId, mysqlConfig) => {
    if (!mysqlPools[facilityId]) {
        mysqlPools[facilityId] = mysql.createPool({
            host: mysqlConfig.host || 'localhost',
            user: mysqlConfig.user || 'root',
            password: mysqlConfig.password || '',
            database: mysqlConfig.database,
            port: mysqlConfig.port || 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            timezone: '+07:00',
            dateStrings: true
        });
    }
    return mysqlPools[facilityId];
};

// === HELPERS ===
const formatFromDb = (table, row) => {
    if (!row) return null;
    const f = { ...row };
    const boolFields = { bays: ['supportsLift'], jobs: ['useLift', 'isAppointment', 'isWaitingCustomer'], vehicles: ['uio'] };
    if (boolFields[table]) boolFields[table].forEach(k => { if (f[k] !== undefined && f[k] !== null) f[k] = f[k] === 1 || f[k] === true; });
    if (table === 'jobs' && f.stageHistory) { try { f.stageHistory = typeof f.stageHistory === 'string' ? JSON.parse(f.stageHistory) : f.stageHistory; } catch(e) { f.stageHistory = []; } }
    return f;
};

const formatToDb = (table, data) => {
    const f = { ...data };
    const boolFields = { bays: ['supportsLift'], jobs: ['useLift', 'isAppointment', 'isWaitingCustomer'], vehicles: ['uio'] };
    if (boolFields[table]) boolFields[table].forEach(k => { if (f[k] !== undefined && f[k] !== null) f[k] = f[k] ? 1 : 0; });
    const dateFields = ['plannedStartTime', 'plannedEndTime', 'actualStartTime', 'actualEndTime', 'actualExitTime', 'actualArrivalTime', 'appointmentCreatedAt', 'appointmentTime', 'purchaseDate'];
    dateFields.forEach(field => {
        if (f[field]) {
            const d = new Date(f[field]);
            if (!isNaN(d.getTime())) {
                f[field] = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
            } else { f[field] = null; }
        }
    });
    if (table === 'jobs' && f.stageHistory !== undefined) f.stageHistory = JSON.stringify(f.stageHistory || []);
    return f;
};

// === DB OPERATIONS ===
const getFacilityConfig = (fId) => { loadConfigs(); return configs[fId]; };

const initBaysTable = async (fId) => {
    try {
        const c = getFacilityConfig(fId); if (!c) return;
        const pool = getMysqlPool(fId, c.mysql);
        try {
            await pool.query(`ALTER TABLE \`bays\` ADD COLUMN \`orderIndex\` INT DEFAULT 0`);
        } catch(e) {}
    } catch(e) {}
};

const dbGetAll = async (fId, table) => {
    const c = getFacilityConfig(fId); if (!c) return [];
    const pool = getMysqlPool(fId, c.mysql);
    if (table === 'bays') {
        await initBaysTable(fId);
        const [rows] = await pool.query(`SELECT * FROM \`bays\` ORDER BY \`orderIndex\` ASC, \`name\` ASC`);
        return rows.map(r => formatFromDb(table, r));
    }
    const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
    return rows.map(r => formatFromDb(table, r));
};

const dbInsert = async (fId, table, data) => {
    const c = getFacilityConfig(fId); if (!c) throw new Error('Config not found');
    const pool = getMysqlPool(fId, c.mysql);
    const f = formatToDb(table, data);
    const keys = Object.keys(f);
    await pool.query(`INSERT INTO \`${table}\` (${keys.map(k=>`\`${k}\``).join(',')}) VALUES (${keys.map(()=>'?').join(',')})`, Object.values(f));
    return data;
};

const dbUpdate = async (fId, table, id, data) => {
    const c = getFacilityConfig(fId); if (!c) throw new Error('Config not found');
    const pool = getMysqlPool(fId, c.mysql);
    const f = formatToDb(table, data); delete f.id;
    const keys = Object.keys(f);
    await pool.query(`UPDATE \`${table}\` SET ${keys.map(k=>`\`${k}\`=?`).join(',')} WHERE \`id\`=?`, [...Object.values(f), id]);
    return data;
};

const dbDelete = async (fId, table, id) => {
    const c = getFacilityConfig(fId); if (!c) throw new Error('Config not found');
    const pool = getMysqlPool(fId, c.mysql);
    await pool.query(`DELETE FROM \`${table}\` WHERE \`id\`=?`, [id]);
};

// Load .env if present (supports cPanel or local env files)
const loadEnvFile = () => {
    try {
        const candidatePaths = [
            path.join(__dirname, '.env'),
            path.join(process.cwd(), '.env')
        ];
        for (const envPath of candidatePaths) {
            if (fs.existsSync(envPath)) {
                const content = fs.readFileSync(envPath, 'utf-8');
                content.split('\n').forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                        const idx = trimmed.indexOf('=');
                        const k = trimmed.substring(0, idx).trim();
                        const v = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
                        if (k && !process.env[k]) {
                            process.env[k] = v;
                        }
                    }
                });
            }
        }
    } catch(e) { console.error("Error loading .env:", e); }
};
loadEnvFile();

const getPrimaryPool = () => {
    const c = getFacilityConfig('facility_1');
    if (!c) return null;
    return getMysqlPool('facility_1', c.mysql);
};

let tableInitialized = false;
const initSuperAdminsTable = async () => {
    if (tableInitialized) return;
    try {
        const pool = getPrimaryPool();
        if (!pool) return;
        await pool.query(`
            CREATE TABLE IF NOT EXISTS \`super_admins\` (
                \`id\` VARCHAR(50) PRIMARY KEY,
                \`username\` VARCHAR(50) UNIQUE NOT NULL,
                \`name\` VARCHAR(100) NOT NULL,
                \`password\` VARCHAR(255) NOT NULL,
                \`role\` VARCHAR(50) DEFAULT 'SuperAdmin',
                \`managedFacilities\` TEXT,
                \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Seed initial accounts if table is empty
        const [rows] = await pool.query(`SELECT COUNT(*) as count FROM \`super_admins\``);
        if (rows[0].count === 0) {
            console.log('[SuperAdmin] Seeding initial super_admins into MySQL...');
            const defaultAccounts = [
                {
                    id: 'sa_superadmin',
                    username: 'superadmin',
                    name: 'Quản Lý Dịch Vụ Chuỗi Vinfast Kim Sơn',
                    password: process.env.SA_PASS_superadmin || 'Lethiduyen1212@',
                    role: 'SuperAdmin',
                    managedFacilities: JSON.stringify(["facility_1", "facility_2", "facility_3", "facility_4"])
                },
                {
                    id: 'sa_kscl_ks',
                    username: 'kscl-ks',
                    name: 'Kiểm Soát Chất Lượng',
                    password: process.env.SA_PASS_kscl_ks || process.env['SA_PASS_kscl-ks'] || '1',
                    role: 'SuperAdmin',
                    managedFacilities: JSON.stringify(["facility_1", "facility_2", "facility_3", "facility_4"])
                }
            ];
            for (const acc of defaultAccounts) {
                await pool.query(
                    `INSERT INTO \`super_admins\` (\`id\`, \`username\`, \`name\`, \`password\`, \`role\`, \`managedFacilities\`) VALUES (?, ?, ?, ?, ?, ?)`,
                    [acc.id, acc.username, acc.name, acc.password, acc.role, acc.managedFacilities]
                );
            }
            console.log('[SuperAdmin] Initial accounts seeded successfully.');
        }
        tableInitialized = true;
    } catch (e) {
        console.error('[SuperAdmin] Error initializing super_admins table:', e.message);
    }
};

const initQuotationFollowupsTable = async (facilityId) => {
    try {
        const c = getFacilityConfig(facilityId);
        if (!c) return;
        const pool = getMysqlPool(facilityId, c.mysql);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS \`quotation_followups\` (
                \`id\` VARCHAR(50) PRIMARY KEY,
                \`originalJobId\` VARCHAR(50) NOT NULL,
                \`licensePlate\` VARCHAR(20) NOT NULL,
                \`customerName\` VARCHAR(100) NOT NULL,
                \`customerPhone\` VARCHAR(20),
                \`carModel\` VARCHAR(50) NOT NULL,
                \`vin\` VARCHAR(50),
                \`jobType\` VARCHAR(50) NOT NULL,
                \`advisorName\` VARCHAR(100) NOT NULL,
                \`advisorId\` VARCHAR(50) NOT NULL,
                \`km\` INT,
                \`quotationDate\` DATETIME NOT NULL,
                \`followupStatus\` VARCHAR(50) NOT NULL DEFAULT 'Chờ duyệt',
                \`appointmentJobId\` VARCHAR(50),
                \`notes\` TEXT,
                \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
    } catch (e) {
        console.error(`[QuotationFollowups] Error initializing table for facility ${facilityId}:`, e.message);
    }
};

const getSuperAdmin = async (identifier) => {
    loadEnvFile();
    await initSuperAdminsTable();
    try {
        const pool = getPrimaryPool();
        if (pool) {
            const [rows] = await pool.query(`SELECT * FROM \`super_admins\` WHERE \`username\` = ? OR \`id\` = ? LIMIT 1`, [identifier, identifier]);
            if (rows && rows.length > 0) {
                const row = rows[0];
                let managedFacilities = [];
                try {
                    managedFacilities = typeof row.managedFacilities === 'string' ? JSON.parse(row.managedFacilities) : (row.managedFacilities || []);
                } catch(e) { managedFacilities = []; }
                return {
                    id: row.id,
                    username: row.username,
                    name: row.name,
                    password: row.password,
                    role: row.role || 'SuperAdmin',
                    managedFacilities,
                    created_at: row.created_at,
                    updated_at: row.updated_at
                };
            }
        }
    } catch(e) {
        console.error('[getSuperAdmin DB error, fallback to env]:', e.message);
    }

    // Fallback to config / env
    loadConfigs();
    const sa = (configs.super_admins || []).find(sa => sa.username === identifier || sa.id === identifier);
    if (!sa) return null;
    
    const cleanUser = sa.username.replace(/[^a-zA-Z0-9]/g, '_');
    const candidates = [
        `SA_PASS_${sa.username}`,
        `SA_PASS_${cleanUser}`,
        `SA_PASS_${sa.username.toUpperCase()}`,
        `SA_PASS_${cleanUser.toUpperCase()}`,
        `SA_PASS_${sa.username.toLowerCase()}`,
        `SA_PASS_${cleanUser.toLowerCase()}`
    ];
    
    let password = '';
    for (const key of candidates) {
        if (process.env[key]) {
            password = process.env[key];
            break;
        }
    }
    
    if (!password && sa.password) {
        password = sa.password;
    }
    
    return { ...sa, password };
};

const findUserByUsername = async (username) => {
    loadConfigs();
    for (const fId of Object.keys(configs).filter(k => k.startsWith('facility_'))) {
        try {
            const users = await dbGetAll(fId, 'users');
            const match = users.find(u => String(u.id) === username);
            if (match) return { facilityId: fId, user: match };
        } catch(e) { continue; }
    }
    return null;
};

const findUserInFacility = async (username, facilityId) => {
    loadConfigs();
    try {
        const users = await dbGetAll(facilityId, 'users');
        const match = users.find(u => String(u.id) === username);
        if (match) return { facilityId, user: match };
    } catch(e) { console.error(`Error finding user ${username} in ${facilityId}:`, e); }
    return null;
};

const getFacilitiesList = () => {
    loadConfigs();
    return Object.keys(configs).filter(k => k.startsWith('facility_')).map(k => ({ id: k, name: configs[k].name }));
};

// === MIDDLEWARE ===
app.use((req, res, next) => {
    // Ưu tiên query param, fallback sang header (tương thích ngược)
    req.facilityId = String(req.query.facilityId || req.headers['x-facility-id'] || '');
    if (req.url.includes('/api/') && !req.url.includes('/api/login') && !req.url.includes('/api/facilities')) {
        console.log(`[FACILITY] ${req.method} ${req.url} → facilityId: "${req.facilityId}"`);
    }
    next();
});

// === API ROUTES (Hỗ trợ cả /api/... và /vf-api/api/...) ===

// Debug endpoint — kiểm tra Netlify proxy, headers và trạng thái SuperAdmin
app.get(['/api/debug', '/vf-api/api/debug'], async (req, res) => {
    loadEnvFile();
    const sa_superadmin = await getSuperAdmin('superadmin');
    const sa_kscl = await getSuperAdmin('kscl-ks');

    const envKeys = Object.keys(process.env).filter(k => k.startsWith('SA_PASS') || k.includes('GEMINI'));

    res.json({
        facilityId: req.facilityId,
        queryParams: req.query,
        headers: {
            'x-facility-id': req.headers['x-facility-id'] || '(missing)',
            'host': req.headers['host'],
            'x-forwarded-for': req.headers['x-forwarded-for'] || '(missing)',
        },
        superAdminStatus: {
            superadmin: {
                found: !!sa_superadmin,
                hasPassword: !!sa_superadmin?.password,
                passwordLength: sa_superadmin?.password ? sa_superadmin.password.length : 0
            },
            'kscl-ks': {
                found: !!sa_kscl,
                hasPassword: !!sa_kscl?.password,
                passwordLength: sa_kscl?.password ? sa_kscl.password.length : 0
            }
        },
        detectedEnvKeys: envKeys,
        timestamp: new Date().toISOString()
    });
});


// Helper to collect all Gemini API Keys (supports comma-separated list, GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.)
const getGeminiApiKeys = () => {
    loadEnvFile();
    const rawKeys = [];
    if (process.env.GEMINI_API_KEY) {
        rawKeys.push(...process.env.GEMINI_API_KEY.split(','));
    }
    if (process.env.GEMINI_API_KEYS) {
        rawKeys.push(...process.env.GEMINI_API_KEYS.split(/[\r\n,]+/));
    }
    Object.keys(process.env).forEach(k => {
        if (/^GEMINI_API_KEY_\d+$/i.test(k) && process.env[k]) {
            rawKeys.push(process.env[k]);
        }
    });
    if (process.env.VITE_GEMINI_API_KEY) {
        rawKeys.push(...process.env.VITE_GEMINI_API_KEY.split(','));
    }
    return Array.from(new Set(
        rawKeys
            .map(k => (k || '').trim().replace(/^["']|["']$/g, ''))
            .filter(k => k && k !== 'your_actual_gemini_api_key_here' && k.length > 10)
    ));
};

// Scan Plate AI (Powered by Gemini 3.1 Flash Lite with Multi-Key Rotation)
app.post(['/api/scan-plate', '/vf-api/api/scan-plate'], async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) return res.status(400).json({ error: 'Không có dữ liệu hình ảnh.' });

        const apiKeys = getGeminiApiKeys();
        if (apiKeys.length === 0) {
            return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên server.' });
        }

        const MODEL_NAME = 'gemini-3.1-flash-lite';
        const { GoogleGenAI } = require('@google/genai');

        let lastError = null;
        let plateResult = null;

        // Thử lần lượt từng API Key nếu gặp lỗi hạn ngạch (429 Rate Limit / Quota Exceeded)
        for (let i = 0; i < apiKeys.length; i++) {
            const apiKey = apiKeys[i];
            const client = new GoogleGenAI({ apiKey });

            try {
                const result = await client.models.generateContent({
                    model: MODEL_NAME,
                    contents: [{ parts: [
                        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
                        { text: "Hãy trích xuất chính xác biển số xe từ hình ảnh này. Chỉ trả về chuỗi biển số (ví dụ: 59A-123.45). Không thêm bất kỳ ghi chú hay văn bản nào khác. Nếu không tìm thấy, trả về 'NOT_FOUND'." }
                    ]}]
                });

                let text = (result.text || '').trim();
                text = text.replace(/```[a-zA-Z]*\n?|\n?```/g, '').trim();
                plateResult = text;
                console.log(`[ScanPlate] Nhận diện thành công với Key #${i + 1} (${MODEL_NAME}): "${text}"`);
                break;
            } catch (err) {
                console.warn(`[ScanPlate] Key #${i + 1} gặp lỗi:`, err.message);
                lastError = err;
                // Nếu lỗi hạn ngạch hoặc lỗi API, thử tiếp key tiếp theo
                continue;
            }
        }

        if (plateResult !== null) {
            return res.json({ plate: plateResult });
        }

        throw lastError || new Error('Không thể nhận diện biển số qua AI.');
    } catch (e) {
        console.error('[ScanPlate Error]:', e.message);
        res.status(500).json({ error: e.message || 'Lỗi khi quét biển số xe.' });
    }
});

// Fast Data
app.get(['/api/fast-data', '/vf-api/api/fast-data'], async (req, res) => {
    try {
        const [jobs, users, bays] = await Promise.all([dbGetAll(req.facilityId, 'jobs'), dbGetAll(req.facilityId, 'users'), dbGetAll(req.facilityId, 'bays')]);
        res.json({ jobs, users, bays });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(['/api/all-data', '/vf-api/api/all-data'], async (req, res) => {
    try {
        const [jobs, users, bays, vehicles] = await Promise.all([dbGetAll(req.facilityId, 'jobs'), dbGetAll(req.facilityId, 'users'), dbGetAll(req.facilityId, 'bays'), dbGetAll(req.facilityId, 'vehicles')]);
        res.json({ jobs, users, bays, vehicles });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(['/api/vehicles', '/vf-api/api/vehicles'], async (req, res) => {
    try { res.json(await dbGetAll(req.facilityId, 'vehicles')); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Jobs CRUD
app.post(['/api/jobs', '/vf-api/api/jobs'], async (req, res) => {
    try {
        const newJob = await dbInsert(req.facilityId, 'jobs', req.body);
        
        if (newJob.isAppointment === true || newJob.isAppointment === 'true' || newJob.status === 'Hẹn') {
            await initQuotationFollowupsTable(req.facilityId);
            const pool = getMysqlPool(req.facilityId, getFacilityConfig(req.facilityId).mysql);
            const [followups] = await pool.query(
                `SELECT id FROM \`quotation_followups\` WHERE \`licensePlate\` = ? AND \`followupStatus\` != 'Đã đặt hẹn'`,
                [newJob.licensePlate]
            );
            if (followups.length > 0) {
                const qfId = followups[0].id;
                await pool.query(
                    `UPDATE \`quotation_followups\` SET \`followupStatus\` = 'Đã đặt hẹn', \`appointmentJobId\` = ? WHERE \`id\` = ?`,
                    [newJob.id, qfId]
                );
            }
        }
        
        res.json(newJob);
    } catch(e) {
        res.status(500).json({error:e.message});
    }
});

app.put(['/api/jobs', '/vf-api/api/jobs'], async (req, res) => {
    try {
        const updatedJob = await dbUpdate(req.facilityId, 'jobs', req.body.id, req.body);
        
        if (req.body.status === 'Đã ra cổng') {
            await initQuotationFollowupsTable(req.facilityId);
            const pool = getMysqlPool(req.facilityId, getFacilityConfig(req.facilityId).mysql);
            await pool.query(
                `DELETE FROM \`quotation_followups\` WHERE \`appointmentJobId\` = ?`,
                [req.body.id]
            );
        }
        
        res.json(updatedJob);
    } catch(e) {
        res.status(500).json({error:e.message});
    }
});

app.delete(['/api/jobs/:id', '/vf-api/api/jobs/:id'], async (req, res) => { try { await dbDelete(req.facilityId, 'jobs', req.params.id); res.json({success:true}); } catch(e) { res.status(500).json({error:e.message}); }});

// Quotation Followups CRUD
app.get(['/api/quotation-followups', '/vf-api/api/quotation-followups'], async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        await initQuotationFollowupsTable(req.facilityId);
        const pool = getMysqlPool(req.facilityId, getFacilityConfig(req.facilityId).mysql);
        let query = `SELECT * FROM \`quotation_followups\``;
        const params = [];
        if (req.query.advisorId) {
            query += ` WHERE \`advisorId\` = ?`;
            params.push(req.query.advisorId);
        }
        query += ` ORDER BY \`quotationDate\` DESC`;
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post(['/api/quotation-followups', '/vf-api/api/quotation-followups'], async (req, res) => {
    try {
        await initQuotationFollowupsTable(req.facilityId);
        const newRecord = {
            id: 'qf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            originalJobId: req.body.originalJobId,
            licensePlate: req.body.licensePlate,
            customerName: req.body.customerName,
            customerPhone: req.body.customerPhone || null,
            carModel: req.body.carModel,
            vin: req.body.vin || null,
            jobType: req.body.jobType,
            advisorName: req.body.advisorName,
            advisorId: req.body.advisorId,
            km: req.body.km || null,
            quotationDate: new Date(),
            followupStatus: 'Chờ duyệt',
            notes: req.body.notes || null
        };
        const pool = getMysqlPool(req.facilityId, getFacilityConfig(req.facilityId).mysql);
        const keys = Object.keys(newRecord);
        await pool.query(
            `INSERT INTO \`quotation_followups\` (${keys.map(k => `\`${k}\``).join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
            Object.values(newRecord)
        );
        res.json(newRecord);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put(['/api/quotation-followups/:id', '/vf-api/api/quotation-followups/:id'], async (req, res) => {
    try {
        await initQuotationFollowupsTable(req.facilityId);
        const updates = [];
        const params = [];
        if (req.body.followupStatus !== undefined) {
            updates.push(`\`followupStatus\` = ?`);
            params.push(req.body.followupStatus);
        }
        if (req.body.notes !== undefined) {
            updates.push(`\`notes\` = ?`);
            params.push(req.body.notes);
        }
        if (req.body.appointmentJobId !== undefined) {
            updates.push(`\`appointmentJobId\` = ?`);
            params.push(req.body.appointmentJobId);
        }
        if (updates.length > 0) {
            params.push(req.params.id);
            const pool = getMysqlPool(req.facilityId, getFacilityConfig(req.facilityId).mysql);
            await pool.query(`UPDATE \`quotation_followups\` SET ${updates.join(', ')} WHERE \`id\` = ?`, params);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete(['/api/quotation-followups/:id', '/vf-api/api/quotation-followups/:id'], async (req, res) => {
    try {
        await initQuotationFollowupsTable(req.facilityId);
        const pool = getMysqlPool(req.facilityId, getFacilityConfig(req.facilityId).mysql);
        await pool.query(`DELETE FROM \`quotation_followups\` WHERE \`id\` = ?`, [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Users CRUD
app.post(['/api/users', '/vf-api/api/users'], async (req, res) => {
    try {
        const newUserId = String(req.body.id).trim();
        if (!newUserId) return res.status(400).json({ error: "Mã nhân viên không được để trống." });
        const sa = await getSuperAdmin(newUserId);
        if (sa) return res.status(400).json({ error: `Mã "${newUserId}" trùng với tài khoản Quản Lý Chuỗi.` });
        const dup = await findUserByUsername(newUserId);
        if (dup) {
            const fn = getFacilitiesList().find(f => f.id === dup.facilityId)?.name || dup.facilityId;
            return res.status(400).json({ error: `Mã "${newUserId}" đã tồn tại ở cơ sở "${fn}".` });
        }
        res.json(await dbInsert(req.facilityId, 'users', req.body));
    } catch(e) { res.status(500).json({error:e.message}); }
});
app.put(['/api/users', '/vf-api/api/users'], async (req, res) => { try { res.json(await dbUpdate(req.facilityId, 'users', req.body.id, req.body)); } catch(e) { res.status(500).json({error:e.message}); }});
app.delete(['/api/users/:id', '/vf-api/api/users/:id'], async (req, res) => { try { await dbDelete(req.facilityId, 'users', req.params.id); res.json({success:true}); } catch(e) { res.status(500).json({error:e.message}); }});

// Bays CRUD
app.post(['/api/bays', '/vf-api/api/bays'], async (req, res) => { try { res.json(await dbInsert(req.facilityId, 'bays', req.body)); } catch(e) { res.status(500).json({error:e.message}); }});
app.put(['/api/bays', '/vf-api/api/bays'], async (req, res) => { try { res.json(await dbUpdate(req.facilityId, 'bays', req.body.id, req.body)); } catch(e) { res.status(500).json({error:e.message}); }});
app.delete(['/api/bays/:id', '/vf-api/api/bays/:id'], async (req, res) => { try { await dbDelete(req.facilityId, 'bays', req.params.id); res.json({success:true}); } catch(e) { res.status(500).json({error:e.message}); }});

// Vehicles
app.post(['/api/vehicles', '/vf-api/api/vehicles'], async (req, res) => { try { res.json(await dbInsert(req.facilityId, 'vehicles', req.body)); } catch(e) { res.status(500).json({error:e.message}); }});
app.put(['/api/vehicles', '/vf-api/api/vehicles'], async (req, res) => { try { res.json(await dbUpdate(req.facilityId, 'vehicles', req.body.id, req.body)); } catch(e) { res.status(500).json({error:e.message}); }});
app.post(['/api/vehicles/import', '/vf-api/api/vehicles/import'], async (req, res) => {
    try {
        const pool = getMysqlPool(req.facilityId, getFacilityConfig(req.facilityId).mysql);
        let imported = 0, skipped = 0;
        for (const v of req.body.vehicles) {
            try {
                const f = formatToDb('vehicles', v);
                const keys = Object.keys(f);
                await pool.query(`INSERT INTO \`vehicles\` (${keys.map(k=>`\`${k}\``).join(',')}) VALUES (${keys.map(()=>'?').join(',')})`, Object.values(f));
                imported++;
            } catch(e) { if (e.code === 'ER_DUP_ENTRY') skipped++; else throw e; }
        }
        res.json({ imported, skipped, total: req.body.vehicles.length });
    } catch(e) { res.status(500).json({error:e.message}); }
});

// === SUPER ADMIN CRUD & QUẢN TRỊ TÀI KHOẢN CHUỖI ===

// GET /api/super-admins: Lấy danh sách tài khoản chuỗi
app.get(['/api/super-admins', '/vf-api/api/super-admins'], async (req, res) => {
    try {
        await initSuperAdminsTable();
        const pool = getPrimaryPool();
        if (!pool) return res.status(500).json({ error: 'Không thể kết nối cơ sở dữ liệu chính.' });
        const [rows] = await pool.query(`SELECT \`id\`, \`username\`, \`name\`, \`role\`, \`managedFacilities\`, \`created_at\`, \`updated_at\` FROM \`super_admins\` ORDER BY \`created_at\` ASC`);
        const list = rows.map(r => {
            let managedFacilities = [];
            try { managedFacilities = typeof r.managedFacilities === 'string' ? JSON.parse(r.managedFacilities) : (r.managedFacilities || []); } catch(e) { managedFacilities = []; }
            return { ...r, managedFacilities };
        });
        res.json(list);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/super-admins: Thêm tài khoản chuỗi mới
app.post(['/api/super-admins', '/vf-api/api/super-admins'], async (req, res) => {
    try {
        await initSuperAdminsTable();
        const { username, name, password, role, managedFacilities } = req.body;
        if (!username || !password || !name) {
            return res.status(400).json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập, họ tên và mật khẩu.' });
        }
        const strUser = String(username).trim().toLowerCase();
        const pool = getPrimaryPool();
        
        // Kiểm tra trùng username
        const [existing] = await pool.query(`SELECT \`id\` FROM \`super_admins\` WHERE \`username\` = ?`, [strUser]);
        if (existing.length > 0) {
            return res.status(400).json({ error: `Tên đăng nhập "${strUser}" đã tồn tại.` });
        }
        
        const id = 'sa_' + strUser.replace(/[^a-zA-Z0-9_]/g, '_') + '_' + Date.now().toString().slice(-4);
        const facilitiesJson = JSON.stringify(Array.isArray(managedFacilities) && managedFacilities.length > 0 ? managedFacilities : ["facility_1", "facility_2", "facility_3", "facility_4"]);
        
        await pool.query(
            `INSERT INTO \`super_admins\` (\`id\`, \`username\`, \`name\`, \`password\`, \`role\`, \`managedFacilities\`) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, strUser, String(name).trim(), String(password), role || 'SuperAdmin', facilitiesJson]
        );
        res.json({ success: true, id, username: strUser, name, role: role || 'SuperAdmin' });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT /api/super-admins/:id: Sửa thông tin tài khoản chuỗi
app.put(['/api/super-admins/:id', '/vf-api/api/super-admins/:id'], async (req, res) => {
    try {
        await initSuperAdminsTable();
        const { name, role, managedFacilities } = req.body;
        const id = req.params.id;
        const pool = getPrimaryPool();
        const facilitiesJson = JSON.stringify(Array.isArray(managedFacilities) ? managedFacilities : ["facility_1", "facility_2", "facility_3", "facility_4"]);
        
        await pool.query(
            `UPDATE \`super_admins\` SET \`name\` = ?, \`role\` = ?, \`managedFacilities\` = ? WHERE \`id\` = ?`,
            [String(name).trim(), role || 'SuperAdmin', facilitiesJson, id]
        );
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/super-admins/:id: Xóa tài khoản chuỗi
app.delete(['/api/super-admins/:id', '/vf-api/api/super-admins/:id'], async (req, res) => {
    try {
        await initSuperAdminsTable();
        const id = req.params.id;
        const pool = getPrimaryPool();
        
        // Không cho phép xóa hết toàn bộ tài khoản chuỗi
        const [rows] = await pool.query(`SELECT COUNT(*) as count FROM \`super_admins\``);
        if (rows[0].count <= 1) {
            return res.status(400).json({ error: 'Không thể xóa tài khoản Quản trị chuỗi duy nhất còn lại.' });
        }
        
        await pool.query(`DELETE FROM \`super_admins\` WHERE \`id\` = ?`, [id]);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/super-admins/:id/reset-password: Reset mật khẩu cho tài khoản chuỗi
app.post(['/api/super-admins/:id/reset-password', '/vf-api/api/super-admins/:id/reset-password'], async (req, res) => {
    try {
        await initSuperAdminsTable();
        const { newPassword } = req.body;
        const id = req.params.id;
        if (!newPassword || String(newPassword).trim() === '') {
            return res.status(400).json({ error: 'Mật khẩu mới không được để trống.' });
        }
        const pool = getPrimaryPool();
        await pool.query(`UPDATE \`super_admins\` SET \`password\` = ? WHERE \`id\` = ?`, [String(newPassword), id]);
        res.json({ success: true, message: 'Đặt lại mật khẩu thành công!' });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/change-password: Tự đổi mật khẩu người dùng đang đăng nhập
app.post(['/api/change-password', '/vf-api/api/change-password'], async (req, res) => {
    try {
        const { username, currentPassword, newPassword, facilityId } = req.body;
        if (!username || !currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.' });
        }
        const strUser = String(username).trim();
        const strOldPass = String(currentPassword);
        const strNewPass = String(newPassword);

        // 1. Kiểm tra nếu là SuperAdmin
        const sa = await getSuperAdmin(strUser);
        if (sa) {
            if (String(sa.password) !== strOldPass) {
                return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác.' });
            }
            const pool = getPrimaryPool();
            await pool.query(`UPDATE \`super_admins\` SET \`password\` = ? WHERE \`username\` = ?`, [strNewPass, strUser]);
            return res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
        }

        // 2. Kiểm tra nếu là tài khoản cơ sở
        const targetFacility = facilityId || req.facilityId;
        if (!targetFacility) {
            return res.status(400).json({ error: 'Không xác định được cơ sở của tài khoản.' });
        }
        const userResult = await findUserInFacility(strUser, targetFacility);
        if (!userResult) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản người dùng.' });
        }
        if (String(userResult.user.password) !== strOldPass) {
            return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác.' });
        }

        // Cập nhật mật khẩu trong bảng users của cơ sở
        await dbUpdate(targetFacility, 'users', userResult.user.id, {
            ...userResult.user,
            password: strNewPass
        });
        return res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// Login
app.post(['/api/login', '/vf-api/api/login'], async (req, res) => {
    try {
        const { username, password, facilityId: requestedFacilityId } = req.body;
        if (!username || !password) return res.status(400).json({ error: "Vui lòng nhập đầy đủ." });
        const strUser = String(username).trim(), strPass = String(password);
        // SuperAdmin - tài khoản quản lý toàn chuỗi
        const sa = await getSuperAdmin(strUser);
        if (sa && String(sa.password) === strPass) { const { password: _, ...u } = sa; return res.json({ success: true, user: u }); }
        
        let result = null;
        if (requestedFacilityId) {
            // Đã chọn cơ sở -> CHỈ tìm trong cơ sở đó, KHÔNG tìm sang cơ sở khác
            result = await findUserInFacility(strUser, requestedFacilityId);
            if (!result) {
                return res.status(401).json({ error: `Tài khoản "${strUser}" không tồn tại trong cơ sở đã chọn.` });
            }
        } else {
            // Không chọn cơ sở (Quản lý toàn chuỗi) -> quét tất cả cơ sở
            result = await findUserByUsername(strUser);
        }
        
        if (result && String(result.user.password) === strPass) {
            const { password: _, ...u } = result.user;
            return res.json({ success: true, user: { ...u, facilityId: result.facilityId } });
        }
        return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không chính xác." });
    } catch(e) { res.status(500).json({error:e.message}); }
});

// Facilities
app.get(['/api/facilities', '/vf-api/api/facilities'], (req, res) => { try { res.json(getFacilitiesList()); } catch(e) { res.status(500).json({error:e.message}); }});

// Super Admin Overview
app.get(['/api/super-admin/overview', '/vf-api/api/super-admin/overview'], async (req, res) => {
    try {
        const list = getFacilitiesList();
        const branchSummaries = [];
        let totalActiveJobs=0,totalWaitingJobs=0,totalAppointments=0,totalBays=0,totalRevenue=0,totalVehicleVisits=0,totalVehiclesInWorkshop=0,totalOnTimeJobs=0,totalCompletedJobs=0,totalAppointmentJobs=0,totalNonAppointmentJobs=0,totalQuotationPending=0;
        const fromDate = req.query.from ? new Date(req.query.from + 'T00:00:00') : null;
        const toDate = req.query.to ? new Date(req.query.to + 'T23:59:59') : null;
        for (const facility of list) {
            try {
                const [jobs, bays] = await Promise.all([dbGetAll(facility.id, 'jobs'), dbGetAll(facility.id, 'bays')]);
                await initQuotationFollowupsTable(facility.id);
                const pool = getMysqlPool(facility.id, getFacilityConfig(facility.id).mysql);
                const [qfRows] = await pool.query(`SELECT COUNT(*) as count FROM \`quotation_followups\` WHERE \`followupStatus\` = 'Chờ duyệt'`);
                const quotationPendingCount = qfRows[0].count || 0;
                
                const activeJobs = jobs.filter(j=>j.status==='Đang làm');
                const waitingJobs = jobs.filter(j=>['Chờ sửa chữa','Chờ tiếp nhận','Đã mở phiếu'].includes(j.status));
                const appointmentsToday = jobs.filter(j=>j.status==='Hẹn');
                const vehiclesInWorkshop = jobs.filter(j=>['Đang làm','Chờ sửa chữa','Dừng sửa chữa','Đã mở phiếu','Chờ tiếp nhận','Rửa xe'].includes(j.status));
                totalActiveJobs+=activeJobs.length; totalWaitingJobs+=waitingJobs.length; totalAppointments+=appointmentsToday.length; totalBays+=bays.length; totalVehiclesInWorkshop+=vehiclesInWorkshop.length; totalQuotationPending+=quotationPendingCount;
                const periodJobs = jobs.filter(j => { if(!j.plannedStartTime)return false; const d=new Date(j.plannedStartTime); if(fromDate&&d<fromDate)return false; if(toDate&&d>toDate)return false; return true; });
                const vehicleVisits = periodJobs.filter(j=>!j.continuationOfJobId&&j.status!=='Hẹn'&&j.status!=='Bỏ hẹn').length;
                let branchRevenue = 0;
                periodJobs.forEach(j => { if(j.jsonData){ try{ const p=JSON.parse(j.jsonData); branchRevenue+=(Number(p.congSCC)||0)+(Number(p.congDong)||0)+(Number(p.congSon)||0)+(Number(p.phuTung)||0); }catch(e){} }});
                const completedInPeriod = periodJobs.filter(j=>['Hoàn thành SC','Rửa xe','Sẵn sàng giao xe','Đã ra cổng'].includes(j.status));
                const onTimeInPeriod = completedInPeriod.filter(j=>j.actualEndTime&&j.plannedEndTime&&new Date(j.actualEndTime)<=new Date(j.plannedEndTime));
                const appointmentJobsInPeriod = periodJobs.filter(j=>j.isAppointment&&!j.continuationOfJobId);
                const allUniqueJobsInPeriod = periodJobs.filter(j=>!j.continuationOfJobId&&j.status!=='Hẹn'&&j.status!=='Bỏ hẹn');
                totalRevenue+=branchRevenue; totalVehicleVisits+=vehicleVisits; totalOnTimeJobs+=onTimeInPeriod.length; totalCompletedJobs+=completedInPeriod.length; totalAppointmentJobs+=appointmentJobsInPeriod.length; totalNonAppointmentJobs+=allUniqueJobsInPeriod.length;
                branchSummaries.push({ facilityId:facility.id, facilityName:facility.name, activeCount:activeJobs.length, waitingCount:waitingJobs.length, appointmentCount:appointmentsToday.length, totalJobs:jobs.length, baysCount:bays.length, revenue:branchRevenue, vehicleVisits, vehiclesInWorkshop:vehiclesInWorkshop.length, completedCount:completedInPeriod.length, onTimeCount:onTimeInPeriod.length, onTimeRate:completedInPeriod.length>0?Math.round((onTimeInPeriod.length/completedInPeriod.length)*100):0, appointmentJobCount:appointmentJobsInPeriod.length, uniqueJobCount:allUniqueJobsInPeriod.length, appointmentRate:allUniqueJobsInPeriod.length>0?Math.round((appointmentJobsInPeriod.length/allUniqueJobsInPeriod.length)*100):0, quotationPendingCount });
            } catch(e) { console.error(`Error ${facility.id}:`, e); }
        }
        res.json({ totalActiveJobs, totalWaitingJobs, totalAppointments, totalBays, totalRevenue, totalVehicleVisits, totalVehiclesInWorkshop, totalOnTimeRate:totalCompletedJobs>0?Math.round((totalOnTimeJobs/totalCompletedJobs)*100):0, totalAppointmentRate:totalNonAppointmentJobs>0?Math.round((totalAppointmentJobs/totalNonAppointmentJobs)*100):0, totalQuotationPending, branchSummaries, slaViolations:[] });
    } catch(e) { res.status(500).json({error:e.message}); }
});

// Phục vụ frontend static
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use(['/', '/vf-api'], express.static(distPath));
}

// Passenger không cần app.listen() - chỉ cần module.exports
if (typeof(PhusionPassenger) !== 'undefined') {
    module.exports = app;
} else {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}
