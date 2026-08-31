import express from "express";
import serverless from "serverless-http";
import cors from "cors";
import mysql from "mysql2/promise";
import * as genai from "@google/genai";

// Defensively handle different import styles
const GoogleGenAI = genai.GoogleGenAI || (genai as any).default?.GoogleGenAI;

// ========================
// DATABASE MODULE (INLINE)
// ========================

interface DbConfig {
    name: string;
    type: 'mysql';
    mysql: {
        host: string;
        user: string;
        password: string;
        database: string;
        port: number;
    };
}

const mysqlPools: { [key: string]: mysql.Pool } = {};

// Cấu hình từ ENV thay vì file JSON (Netlify không có filesystem)
const getConfigs = () => {
    const dbHost = process.env.DB_HOST || '103.75.187.26';
    const dbUser = process.env.DB_USER || 'sphehuqehosting_User1';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbPort = parseInt(process.env.DB_PORT || '3306');

    return {
        super_admins: JSON.parse(process.env.SUPER_ADMINS || JSON.stringify([
            {
                username: "superadmin",
                password: process.env.SUPER_ADMIN_PASSWORD || "admin",
                name: "Quản Lý Dịch Vụ Chuỗi Vinfast Kim Sơn",
                role: "SuperAdmin",
                managedFacilities: ["facility_1", "facility_2", "facility_3", "facility_4"]
            }
        ])),
        facility_1: {
            name: "Vinfast Kim Sơn Long Bình",
            type: "mysql",
            mysql: { host: dbHost, user: dbUser, password: dbPassword, database: process.env.DB_NAME_F1 || 'sphehuqehosting_Kimson-LongBinh', port: dbPort }
        },
        facility_2: {
            name: "Vinfast Kim Sơn Tân Hiệp",
            type: "mysql",
            mysql: { host: dbHost, user: dbUser, password: dbPassword, database: process.env.DB_NAME_F2 || 'sphehuqehosting_Kimson-TanHiep', port: dbPort }
        },
        facility_3: {
            name: "Vinfast Kim Sơn Long Thành",
            type: "mysql",
            mysql: { host: dbHost, user: dbUser, password: dbPassword, database: process.env.DB_NAME_F3 || 'sphehuqehosting_Kimson-LongThanh', port: dbPort }
        },
        facility_4: {
            name: "Vinfast Kim Sơn Long Khánh",
            type: "mysql",
            mysql: { host: dbHost, user: dbUser, password: dbPassword, database: process.env.DB_NAME_F4 || 'sphehuqehosting_Kimson-LongKhanh', port: dbPort }
        }
    } as any;
};

const getMysqlPool = (facilityId: string, mysqlConfig: any) => {
    if (!mysqlPools[facilityId]) {
        mysqlPools[facilityId] = mysql.createPool({
            host: mysqlConfig.host || 'localhost',
            user: mysqlConfig.user || 'root',
            password: mysqlConfig.password || '',
            database: mysqlConfig.database,
            port: mysqlConfig.port || 3306,
            waitForConnections: true,
            connectionLimit: 5, // Lower for serverless
            queueLimit: 0,
            timezone: '+07:00',
            dateStrings: true
        });
    }
    return mysqlPools[facilityId];
};

const formatFromDb = (table: string, row: any) => {
    if (!row) return null;
    const formatted = { ...row };
    const booleanFields: { [key: string]: string[] } = {
        bays: ['supportsLift'],
        jobs: ['useLift', 'isAppointment', 'isWaitingCustomer'],
        vehicles: ['uio']
    };
    if (booleanFields[table]) {
        booleanFields[table].forEach(field => {
            if (formatted[field] !== undefined && formatted[field] !== null) {
                formatted[field] = formatted[field] === 1 || formatted[field] === true;
            }
        });
    }
    if (table === 'jobs' && formatted.stageHistory) {
        try {
            formatted.stageHistory = typeof formatted.stageHistory === 'string'
                ? JSON.parse(formatted.stageHistory)
                : formatted.stageHistory;
        } catch (e) { formatted.stageHistory = []; }
    }
    return formatted;
};

const formatToDb = (table: string, data: any) => {
    const formatted = { ...data };
    const booleanFields: { [key: string]: string[] } = {
        bays: ['supportsLift'],
        jobs: ['useLift', 'isAppointment', 'isWaitingCustomer'],
        vehicles: ['uio']
    };
    if (booleanFields[table]) {
        booleanFields[table].forEach(field => {
            if (formatted[field] !== undefined) {
                formatted[field] = formatted[field] ? 1 : 0;
            }
        });
    }
    if (table === 'jobs' && formatted.stageHistory) {
        formatted.stageHistory = typeof formatted.stageHistory === 'string'
            ? formatted.stageHistory
            : JSON.stringify(formatted.stageHistory);
    }
    return formatted;
};

const DB_COLUMNS: { [key: string]: string[] } = {
    jobs: ['id', 'licensePlate', 'customerName', 'customerPhone', 'carModel', 'vin', 'jobType', 'advisorName',
           'bayId', 'technician', 'status', 'plannedStartTime', 'plannedEndTime', 'actualStartTime', 'actualEndTime',
           'km', 'useLift', 'notes', 'isAppointment', 'appointmentTime', 'currentStage', 'bodyShopNotes',
           'stageHistory', 'jsonData', 'laborCost', 'appointmentCreatedAt', 'actualArrivalTime', 'isWaitingCustomer',
           'continuationOfJobId'],
    users: ['id', 'name', 'role', 'password', 'team'],
    bays: ['id', 'name', 'type', 'supportsLift', 'technician', 'orderIndex'],
    vehicles: ['id', 'licensePlate', 'customerName', 'customerPhone', 'carModel', 'vin', 'color', 'uio']
};

// Auto-migration: đảm bảo bảng bays có cột orderIndex và technician
const initBaysTable = async (facilityId: string, pool: mysql.Pool) => {
    try { await pool.query(`ALTER TABLE \`bays\` ADD COLUMN \`orderIndex\` INT DEFAULT 0`); } catch(e) {}
    try { await pool.query(`ALTER TABLE \`bays\` ADD COLUMN \`technician\` VARCHAR(100) NULL`); } catch(e) {}
};

// DB Operations
const dbGetAll = async (facilityId: string, table: string) => {
    const configs = getConfigs();
    const config = configs[facilityId];
    if (!config || config.type !== 'mysql') return [];
    const pool = getMysqlPool(facilityId, config.mysql);
    if (table === 'bays') {
        await initBaysTable(facilityId, pool);
        const [rows] = await pool.query(`SELECT * FROM \`bays\` ORDER BY \`orderIndex\` ASC, \`name\` ASC`);
        return (rows as any[]).map(row => formatFromDb(table, row));
    }
    const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
    return (rows as any[]).map(row => formatFromDb(table, row));
};

const dbInsert = async (facilityId: string, table: string, data: any) => {
    const configs = getConfigs();
    const config = configs[facilityId];
    if (!config || config.type !== 'mysql') throw new Error('Config not found');
    const pool = getMysqlPool(facilityId, config.mysql);
    const formatted = formatToDb(table, data);
    const columns = DB_COLUMNS[table];
    if (!columns) throw new Error(`Unknown table: ${table}`);
    const values = columns.map(col => formatted[col] !== undefined ? formatted[col] : null);
    const placeholders = columns.map(() => '?').join(', ');
    const colNames = columns.map(c => `\`${c}\``).join(', ');
    await pool.query(`INSERT INTO \`${table}\` (${colNames}) VALUES (${placeholders})`, values);
    return data;
};

const dbUpdate = async (facilityId: string, table: string, id: string, data: any) => {
    const configs = getConfigs();
    const config = configs[facilityId];
    if (!config || config.type !== 'mysql') throw new Error('Config not found');
    const pool = getMysqlPool(facilityId, config.mysql);
    const formatted = formatToDb(table, data);
    const columns = DB_COLUMNS[table];
    if (!columns) throw new Error(`Unknown table: ${table}`);
    const setClauses = columns.filter(c => c !== 'id').map(c => `\`${c}\` = ?`);
    const values = columns.filter(c => c !== 'id').map(col => formatted[col] !== undefined ? formatted[col] : null);
    values.push(id);
    await pool.query(`UPDATE \`${table}\` SET ${setClauses.join(', ')} WHERE \`id\` = ?`, values);
    return data;
};

const dbDelete = async (facilityId: string, table: string, id: string) => {
    const configs = getConfigs();
    const config = configs[facilityId];
    if (!config || config.type !== 'mysql') throw new Error('Config not found');
    const pool = getMysqlPool(facilityId, config.mysql);
    await pool.query(`DELETE FROM \`${table}\` WHERE \`id\` = ?`, [id]);
};

const dbImportVehicles = async (facilityId: string, vehicles: any[]) => {
    const configs = getConfigs();
    const config = configs[facilityId];
    if (!config || config.type !== 'mysql') throw new Error('Config not found');
    const pool = getMysqlPool(facilityId, config.mysql);
    let imported = 0;
    let skipped = 0;
    for (const v of vehicles) {
        try {
            const formatted = formatToDb('vehicles', v);
            const columns = DB_COLUMNS['vehicles'];
            const values = columns.map(col => formatted[col] !== undefined ? formatted[col] : null);
            const placeholders = columns.map(() => '?').join(', ');
            const colNames = columns.map(c => `\`${c}\``).join(', ');
            await pool.query(`INSERT INTO \`vehicles\` (${colNames}) VALUES (${placeholders})`, values);
            imported++;
        } catch (e: any) {
            if (e.code === 'ER_DUP_ENTRY') { skipped++; } else { throw e; }
        }
    }
    return { imported, skipped, total: vehicles.length };
};

const getSuperAdmin = (username: string) => {
    const configs = getConfigs();
    const admins = configs.super_admins || [];
    return admins.find((a: any) => a.username === username) || null;
};

const findUserByUsername = async (username: string) => {
    const configs = getConfigs();
    const facilityIds = Object.keys(configs).filter(k => k.startsWith('facility_'));
    for (const fId of facilityIds) {
        try {
            const users = await dbGetAll(fId, 'users');
            const match = users.find((u: any) => u.id === username);
            if (match) return { facilityId: fId, user: match };
        } catch (e) { continue; }
    }
    return null;
};

const getFacilitiesList = () => {
    const configs = getConfigs();
    return Object.keys(configs)
        .filter(k => k.startsWith('facility_'))
        .map(k => ({ id: k, name: (configs[k] as any).name }));
};

// ========================
// EXPRESS APP
// ========================

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Middleware xác định facility
app.use((req, _res, next) => {
    const facilityId = req.headers['x-facility-id'] || 'facility_1';
    (req as any).facilityId = String(facilityId);
    next();
});

// --- Scan Plate AI ---
app.post("/api/scan-plate", async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) return res.status(400).json({ error: "No image data" });

        const rawKeys: string[] = [];
        if (process.env.GEMINI_API_KEY) rawKeys.push(...process.env.GEMINI_API_KEY.split(','));
        if (process.env.GEMINI_API_KEYS) rawKeys.push(...process.env.GEMINI_API_KEYS.split(/[\r\n,]+/));
        Object.keys(process.env).forEach(k => {
            if (/^GEMINI_API_KEY_\d+$/i.test(k) && process.env[k]) {
                rawKeys.push(process.env[k] as string);
            }
        });
        if (process.env.VITE_GEMINI_API_KEY) rawKeys.push(...process.env.VITE_GEMINI_API_KEY.split(','));
        const apiKeys = Array.from(new Set(
            rawKeys
                .map(k => (k || '').trim().replace(/^["']|["']$/g, ''))
                .filter(k => k && k !== 'your_actual_gemini_api_key_here' && k.length > 10)
        ));

        if (apiKeys.length === 0) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

        const MODEL_NAME = 'gemini-3.1-flash-lite';
        let lastError: any = null;
        let plateResult: string | null = null;

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

                let text = (result.text || "").trim();
                text = text.replace(/```[a-zA-Z]*\n?|\n?```/g, '').trim();
                plateResult = text;
                break;
            } catch (modelErr: any) {
                lastError = modelErr;
                continue;
            }
        }

        if (plateResult !== null) {
            return res.json({ plate: plateResult });
        }

        throw lastError || new Error("Failed to scan");
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to scan" });
    }
});

// --- Fast Data ---
app.get('/api/fast-data', async (req, res) => {
    try {
        const fId = (req as any).facilityId;
        const [jobs, users, bays] = await Promise.all([dbGetAll(fId, 'jobs'), dbGetAll(fId, 'users'), dbGetAll(fId, 'bays')]);
        res.json({ jobs, users, bays });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/api/all-data', async (req, res) => {
    try {
        const fId = (req as any).facilityId;
        const [jobs, users, bays, vehicles] = await Promise.all([dbGetAll(fId, 'jobs'), dbGetAll(fId, 'users'), dbGetAll(fId, 'bays'), dbGetAll(fId, 'vehicles')]);
        res.json({ jobs, users, bays, vehicles });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/api/vehicles', async (req, res) => {
    try { res.json(await dbGetAll((req as any).facilityId, 'vehicles')); } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// --- JOBS ---
app.post('/api/jobs', async (req, res) => {
    try { res.json(await dbInsert((req as any).facilityId, 'jobs', req.body)); } catch (error: any) { res.status(500).json({ error: error.message }); }
});
app.put('/api/jobs', async (req, res) => {
    try { res.json(await dbUpdate((req as any).facilityId, 'jobs', req.body.id, req.body)); } catch (error: any) { res.status(500).json({ error: error.message }); }
});
app.delete('/api/jobs/:id', async (req, res) => {
    try { await dbDelete((req as any).facilityId, 'jobs', req.params.id); res.json({ success: true }); } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// --- USERS ---
app.post('/api/users', async (req, res) => {
    try {
        const fId = (req as any).facilityId;
        const newUserId = String(req.body.id).trim();
        if (!newUserId) return res.status(400).json({ error: "Mã nhân viên không được để trống." });
        const sa = getSuperAdmin(newUserId);
        if (sa) return res.status(400).json({ error: `Mã "${newUserId}" trùng với tài khoản Quản Lý Chuỗi.` });
        const dup = await findUserByUsername(newUserId);
        if (dup) {
            const facList = getFacilitiesList();
            const fn = facList.find((f: any) => f.id === dup.facilityId)?.name || dup.facilityId;
            return res.status(400).json({ error: `Mã "${newUserId}" đã tồn tại ở cơ sở "${fn}".` });
        }
        res.json(await dbInsert(fId, 'users', req.body));
    } catch (error: any) { res.status(500).json({ error: error.message }); }
});
app.put('/api/users', async (req, res) => {
    try { res.json(await dbUpdate((req as any).facilityId, 'users', req.body.id, req.body)); } catch (error: any) { res.status(500).json({ error: error.message }); }
});
app.delete('/api/users/:id', async (req, res) => {
    try { await dbDelete((req as any).facilityId, 'users', req.params.id); res.json({ success: true }); } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// --- BAYS ---
app.post('/api/bays', async (req, res) => {
    try { res.json(await dbInsert((req as any).facilityId, 'bays', req.body)); } catch (error: any) { res.status(500).json({ error: error.message }); }
});
app.put('/api/bays', async (req, res) => {
    try { res.json(await dbUpdate((req as any).facilityId, 'bays', req.body.id, req.body)); } catch (error: any) { res.status(500).json({ error: error.message }); }
});
app.delete('/api/bays/:id', async (req, res) => {
    try { await dbDelete((req as any).facilityId, 'bays', req.params.id); res.json({ success: true }); } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// --- VEHICLES ---
app.post('/api/vehicles', async (req, res) => {
    try { res.json(await dbInsert((req as any).facilityId, 'vehicles', req.body)); } catch (error: any) { res.status(500).json({ error: error.message }); }
});
app.put('/api/vehicles', async (req, res) => {
    try { res.json(await dbUpdate((req as any).facilityId, 'vehicles', req.body.id, req.body)); } catch (error: any) { res.status(500).json({ error: error.message }); }
});
app.post('/api/vehicles/import', async (req, res) => {
    try { res.json(await dbImportVehicles((req as any).facilityId, req.body.vehicles)); } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// --- LOGIN ---
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: "Vui lòng nhập đầy đủ tài khoản và mật khẩu." });
        const strUser = String(username).trim();
        const strPass = String(password);
        
        const sa = getSuperAdmin(strUser);
        if (sa && String(sa.password) === strPass) {
            const { password: _, ...u } = sa;
            return res.json({ success: true, user: u });
        }
        
        const result = await findUserByUsername(strUser);
        if (result && String(result.user.password) === strPass) {
            const { password: _, ...u } = result.user;
            return res.json({ success: true, user: { ...u, facilityId: result.facilityId } });
        }
        
        return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không chính xác." });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// --- FACILITIES ---
app.get('/api/facilities', (_req, res) => {
    try { res.json(getFacilitiesList()); } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// --- SUPER ADMIN OVERVIEW ---
app.get('/api/super-admin/overview', async (req, res) => {
    try {
        const list = getFacilitiesList();
        const branchSummaries: any[] = [];
        let totalActiveJobs = 0, totalWaitingJobs = 0, totalAppointments = 0, totalBays = 0;
        let totalRevenue = 0, totalVehicleVisits = 0, totalVehiclesInWorkshop = 0;
        let totalOnTimeJobs = 0, totalCompletedJobs = 0, totalAppointmentJobs = 0, totalNonAppointmentJobs = 0;
        const slaViolations: any[] = [];
        const now = new Date();
        const fromParam = req.query.from as string;
        const toParam = req.query.to as string;
        const fromDate = fromParam ? new Date(fromParam + 'T00:00:00') : null;
        const toDate = toParam ? new Date(toParam + 'T23:59:59') : null;

        for (const facility of list) {
            try {
                const [jobs, bays] = await Promise.all([dbGetAll(facility.id, 'jobs'), dbGetAll(facility.id, 'bays')]);
                const activeJobs = jobs.filter((j: any) => j.status === 'Đang làm');
                const waitingJobs = jobs.filter((j: any) => j.status === 'Chờ sửa chữa' || j.status === 'Chờ tiếp nhận' || j.status === 'Đã mở phiếu');
                const appointmentsToday = jobs.filter((j: any) => j.status === 'Hẹn');
                const vehiclesInWorkshop = jobs.filter((j: any) =>
                    j.status === 'Đang làm' || j.status === 'Chờ sửa chữa' || j.status === 'Dừng sửa chữa' ||
                    j.status === 'Đã mở phiếu' || j.status === 'Chờ tiếp nhận' || j.status === 'Rửa xe'
                );
                totalActiveJobs += activeJobs.length;
                totalWaitingJobs += waitingJobs.length;
                totalAppointments += appointmentsToday.length;
                totalBays += bays.length;
                totalVehiclesInWorkshop += vehiclesInWorkshop.length;

                const periodJobs = jobs.filter((j: any) => {
                    if (!j.plannedStartTime) return false;
                    const jobDate = new Date(j.plannedStartTime);
                    if (fromDate && jobDate < fromDate) return false;
                    if (toDate && jobDate > toDate) return false;
                    return true;
                });
                const vehicleVisits = periodJobs.filter((j: any) => !j.continuationOfJobId && j.status !== 'Hẹn' && j.status !== 'Bỏ hẹn').length;
                let branchRevenue = 0;
                periodJobs.forEach((j: any) => {
                    if (j.jsonData) {
                        try {
                            const parsed = JSON.parse(j.jsonData);
                            branchRevenue += (Number(parsed.congSCC) || 0) + (Number(parsed.congDong) || 0) +
                                             (Number(parsed.congSon) || 0) + (Number(parsed.phuTung) || 0);
                        } catch (e) {}
                    }
                });
                const completedInPeriod = periodJobs.filter((j: any) => ['Hoàn thành SC', 'Rửa xe', 'Sẵn sàng giao xe', 'Đã ra cổng'].includes(j.status));
                const onTimeInPeriod = completedInPeriod.filter((j: any) => j.actualEndTime && j.plannedEndTime && new Date(j.actualEndTime) <= new Date(j.plannedEndTime));
                const appointmentJobsInPeriod = periodJobs.filter((j: any) => j.isAppointment && !j.continuationOfJobId);
                const allUniqueJobsInPeriod = periodJobs.filter((j: any) => !j.continuationOfJobId && j.status !== 'Hẹn' && j.status !== 'Bỏ hẹn');

                totalRevenue += branchRevenue;
                totalVehicleVisits += vehicleVisits;
                totalOnTimeJobs += onTimeInPeriod.length;
                totalCompletedJobs += completedInPeriod.length;
                totalAppointmentJobs += appointmentJobsInPeriod.length;
                totalNonAppointmentJobs += allUniqueJobsInPeriod.length;

                branchSummaries.push({
                    facilityId: facility.id, facilityName: facility.name,
                    activeCount: activeJobs.length, waitingCount: waitingJobs.length,
                    appointmentCount: appointmentsToday.length, totalJobs: jobs.length,
                    baysCount: bays.length, revenue: branchRevenue, vehicleVisits,
                    vehiclesInWorkshop: vehiclesInWorkshop.length,
                    completedCount: completedInPeriod.length, onTimeCount: onTimeInPeriod.length,
                    onTimeRate: completedInPeriod.length > 0 ? Math.round((onTimeInPeriod.length / completedInPeriod.length) * 100) : 0,
                    appointmentJobCount: appointmentJobsInPeriod.length, uniqueJobCount: allUniqueJobsInPeriod.length,
                    appointmentRate: allUniqueJobsInPeriod.length > 0 ? Math.round((appointmentJobsInPeriod.length / allUniqueJobsInPeriod.length) * 100) : 0,
                });
            } catch (e) { console.error(`Error for ${facility.id}:`, e); }
        }
        slaViolations.sort((a, b) => b.delayMinutes - a.delayMinutes);
        res.json({
            totalActiveJobs, totalWaitingJobs, totalAppointments, totalBays, totalRevenue,
            totalVehicleVisits, totalVehiclesInWorkshop,
            totalOnTimeRate: totalCompletedJobs > 0 ? Math.round((totalOnTimeJobs / totalCompletedJobs) * 100) : 0,
            totalAppointmentRate: totalNonAppointmentJobs > 0 ? Math.round((totalAppointmentJobs / totalNonAppointmentJobs) * 100) : 0,
            branchSummaries, slaViolations: slaViolations.slice(0, 10)
        });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// Export as serverless handler
export const handler = serverless(app);
