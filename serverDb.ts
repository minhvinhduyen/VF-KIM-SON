import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

// Cấu hình cơ sở dữ liệu cho các cơ sở
interface DbConfig {
    name: string;
    type: 'json' | 'mysql';
    filePath?: string;
    mysql?: {
        host?: string;
        user?: string;
        password?: string;
        database?: string;
        port?: number;
    };
}

let configs: any = {};
const mysqlPools: { [key: string]: mysql.Pool } = {};
const CONFIG_PATH = path.join(process.cwd(), 'config', 'databases.json');

// Tải cấu hình từ config/databases.json hoặc ENV (cho cloud deployment)
const loadConfigs = () => {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
            configs = JSON.parse(data);
        } else if (process.env.DB_HOST) {
            // Fallback: Đọc từ environment variables (Render, Netlify, etc.)
            console.log("[ServerDb] Không tìm thấy databases.json, sử dụng ENV variables.");
            const dbHost = process.env.DB_HOST;
            const dbUser = process.env.DB_USER || 'root';
            const dbPassword = process.env.DB_PASSWORD || '';
            const dbPort = parseInt(process.env.DB_PORT || '3306');

            configs = {
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
                    name: "Vinfast Kim Sơn Long Bình", type: "mysql",
                    mysql: { host: dbHost, user: dbUser, password: dbPassword, database: process.env.DB_NAME_F1 || 'sphehuqehosting_Kimson-LongBinh', port: dbPort }
                },
                facility_2: {
                    name: "Vinfast Kim Sơn Tân Hiệp", type: "mysql",
                    mysql: { host: dbHost, user: dbUser, password: dbPassword, database: process.env.DB_NAME_F2 || 'sphehuqehosting_Kimson-TanHiep', port: dbPort }
                },
                facility_3: {
                    name: "Vinfast Kim Sơn Long Thành", type: "mysql",
                    mysql: { host: dbHost, user: dbUser, password: dbPassword, database: process.env.DB_NAME_F3 || 'sphehuqehosting_Kimson-LongThanh', port: dbPort }
                },
                facility_4: {
                    name: "Vinfast Kim Sơn Long Khánh", type: "mysql",
                    mysql: { host: dbHost, user: dbUser, password: dbPassword, database: process.env.DB_NAME_F4 || 'sphehuqehosting_Kimson-LongKhanh', port: dbPort }
                }
            };
        } else {
            console.warn("Chưa tìm thấy file config/databases.json và không có ENV, sử dụng cấu hình mặc định (JSON).");
            configs = {
                "facility_1": { "name": "Cơ sở 1", "type": "json", "filePath": "./db/facility_1.json" },
                "facility_2": { "name": "Cơ sở 2", "type": "json", "filePath": "./db/facility_2.json" }
            };
        }
    } catch (e) {
        console.error("Lỗi khi tải cấu hình CSDL:", e);
    }
};

loadConfigs();

// Lấy kết nối MySQL Pool
const getMysqlPool = (facilityId: string, mysqlConfig: any) => {
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
            timezone: '+07:00',   // Múi giờ Việt Nam
            dateStrings: true     // Trả về ngày dạng string, tránh mysql2 tự chuyển sang UTC Date
        });
    }
    return mysqlPools[facilityId];
};

// Đọc CSDL JSON
const readJsonDb = (filePath: string) => {
    try {
        const fullPath = path.resolve(process.cwd(), filePath);
        if (!fs.existsSync(fullPath)) {
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const initialData = { users: [], bays: [], jobs: [], vehicles: [] };
            fs.writeFileSync(fullPath, JSON.stringify(initialData, null, 2), 'utf-8');
            return initialData;
        }
        const data = fs.readFileSync(fullPath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error(`Lỗi khi đọc file CSDL JSON ${filePath}:`, e);
        return { users: [], bays: [], jobs: [], vehicles: [] };
    }
};

// Ghi CSDL JSON
const writeJsonDb = (filePath: string, data: any) => {
    try {
        const fullPath = path.resolve(process.cwd(), filePath);
        fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error(`Lỗi khi ghi file CSDL JSON ${filePath}:`, e);
    }
};

// Định dạng dữ liệu lấy từ MySQL
const formatFromDb = (table: string, row: any) => {
    if (!row) return null;
    const formatted = { ...row };

    // Chuyển TINYINT (0/1) sang Boolean
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

    // Parse cột JSON (lưu lịch sử đổi giai đoạn Đồng sơn)
    if (table === 'jobs' && formatted.stageHistory) {
        try {
            formatted.stageHistory = typeof formatted.stageHistory === 'string'
                ? JSON.parse(formatted.stageHistory)
                : formatted.stageHistory;
        } catch (e) {
            formatted.stageHistory = [];
        }
    }

    return formatted;
};

// Định dạng dữ liệu trước khi lưu vào MySQL
const formatToDb = (table: string, data: any) => {
    const formatted = { ...data };

    // Chuyển Boolean sang TINYINT (0/1)
    const booleanFields: { [key: string]: string[] } = {
        bays: ['supportsLift'],
        jobs: ['useLift', 'isAppointment', 'isWaitingCustomer'],
        vehicles: ['uio']
    };

    if (booleanFields[table]) {
        booleanFields[table].forEach(field => {
            if (formatted[field] !== undefined && formatted[field] !== null) {
                formatted[field] = formatted[field] ? 1 : 0;
            }
        });
    }

    // Convert Date objects to MySQL DATETIME format (YYYY-MM-DD HH:mm:ss)
    // QUAN TRỌNG: Phải giữ nguyên giờ LOCAL (Việt Nam UTC+7), KHÔNG dùng toISOString() vì nó chuyển sang UTC
    const dateFields = ['plannedStartTime', 'plannedEndTime', 'actualStartTime', 'actualEndTime', 'actualExitTime', 'actualArrivalTime', 'appointmentCreatedAt', 'appointmentTime', 'purchaseDate'];
    dateFields.forEach(field => {
        if (formatted[field]) {
            const date = new Date(formatted[field]);
            if (!isNaN(date.getTime())) {
                // Dùng các hàm getFullYear/getMonth/... để lấy giờ LOCAL thay vì UTC
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                const hh = String(date.getHours()).padStart(2, '0');
                const min = String(date.getMinutes()).padStart(2, '0');
                const ss = String(date.getSeconds()).padStart(2, '0');
                formatted[field] = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
            } else {
                formatted[field] = null;
            }
        }
    });

    // Stringify mảng JSON lịch sử giai đoạn
    if (table === 'jobs' && formatted.stageHistory !== undefined) {
        formatted.stageHistory = JSON.stringify(formatted.stageHistory || []);
    }

    return formatted;
};

// --- DATABASE INTERACTION METHODS ---

export const getFacilityConfig = (facilityId: string): DbConfig => {
    // Reload configs in case it changed
    loadConfigs();
    const config = configs[facilityId];
    if (!config) {
        throw new Error(`Mã cơ sở "${facilityId}" không hợp lệ hoặc chưa được cấu hình.`);
    }
    return config;
};

export const initBaysTable = async (facilityId: string) => {
    try {
        const config = getFacilityConfig(facilityId);
        if (config.type === 'mysql') {
            const pool = getMysqlPool(facilityId, config.mysql);
            try {
                await pool.query(`ALTER TABLE \`bays\` ADD COLUMN \`orderIndex\` INT DEFAULT 0`);
            } catch(e) {}
        }
    } catch(e) {}
};

export const getAll = async (facilityId: string, table: string): Promise<any[]> => {
    const config = getFacilityConfig(facilityId);
    if (config.type === 'json') {
        const db = readJsonDb(config.filePath || `./db/${facilityId}.json`);
        return db[table] || [];
    } else {
        const pool = getMysqlPool(facilityId, config.mysql);
        if (table === 'bays') {
            await initBaysTable(facilityId);
            const [rows]: any = await pool.query(`SELECT * FROM \`bays\` ORDER BY \`orderIndex\` ASC, \`name\` ASC`);
            return rows.map((r: any) => formatFromDb(table, r));
        }
        const [rows]: any = await pool.query(`SELECT * FROM \`${table}\``);
        return rows.map((r: any) => formatFromDb(table, r));
    }
};

export const getById = async (facilityId: string, table: string, id: string): Promise<any | null> => {
    const config = getFacilityConfig(facilityId);
    if (config.type === 'json') {
        const db = readJsonDb(config.filePath || `./db/${facilityId}.json`);
        const list = db[table] || [];
        return list.find((item: any) => item.id === id) || null;
    } else {
        const pool = getMysqlPool(facilityId, config.mysql);
        const [rows]: any = await pool.query(`SELECT * FROM \`${table}\` WHERE \`id\` = ?`, [id]);
        if (rows.length === 0) return null;
        return formatFromDb(table, rows[0]);
    }
};

export const insert = async (facilityId: string, table: string, data: any): Promise<any> => {
    const config = getFacilityConfig(facilityId);
    if (config.type === 'json') {
        const db = readJsonDb(config.filePath || `./db/${facilityId}.json`);
        if (!db[table]) db[table] = [];
        db[table].push(data);
        writeJsonDb(config.filePath || `./db/${facilityId}.json`, db);
        return data;
    } else {
        const pool = getMysqlPool(facilityId, config.mysql);
        const formatted = formatToDb(table, data);
        const keys = Object.keys(formatted);
        const values = Object.values(formatted);
        const placeholders = keys.map(() => '?').join(', ');
        const columns = keys.map(k => `\`${k}\``).join(', ');
        const sql = `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`;
        await pool.query(sql, values);
        return data;
    }
};

export const update = async (facilityId: string, table: string, id: string, data: any): Promise<any> => {
    const config = getFacilityConfig(facilityId);
    if (config.type === 'json') {
        const db = readJsonDb(config.filePath || `./db/${facilityId}.json`);
        const list = db[table] || [];
        const index = list.findIndex((item: any) => item.id === id || (table === 'vehicles' && item.licensePlate === id));
        if (index === -1) {
            // If not found, insert it
            list.push(data);
        } else {
            list[index] = { ...list[index], ...data };
        }
        db[table] = list;
        writeJsonDb(config.filePath || `./db/${facilityId}.json`, db);
        return data;
    } else {
        const pool = getMysqlPool(facilityId, config.mysql);
        const formatted = formatToDb(table, data);
        delete formatted.id; // Không cập nhật khoá chính
        const keys = Object.keys(formatted);
        const values = Object.values(formatted);
        const setClause = keys.map(k => `\`${k}\` = ?`).join(', ');
        const sql = `UPDATE \`${table}\` SET ${setClause} WHERE \`id\` = ?`;
        await pool.query(sql, [...values, id]);
        return data;
    }
};

export const deleteItem = async (facilityId: string, table: string, id: string): Promise<void> => {
    const config = getFacilityConfig(facilityId);
    if (config.type === 'json') {
        const db = readJsonDb(config.filePath || `./db/${facilityId}.json`);
        if (db[table]) {
            db[table] = db[table].filter((item: any) => item.id !== id);
            writeJsonDb(config.filePath || `./db/${facilityId}.json`, db);
        }
    } else {
        const pool = getMysqlPool(facilityId, config.mysql);
        await pool.query(`DELETE FROM \`${table}\` WHERE \`id\` = ?`, [id]);
    }
};

export const importVehicles = async (facilityId: string, vehicles: any[]): Promise<any[]> => {
    const config = getFacilityConfig(facilityId);
    if (config.type === 'json') {
        const db = readJsonDb(config.filePath || `./db/${facilityId}.json`);
        if (!db.vehicles) db.vehicles = [];
        
        vehicles.forEach(v => {
            const index = db.vehicles.findIndex((item: any) => item.licensePlate === v.licensePlate);
            if (index === -1) {
                db.vehicles.push(v);
            } else {
                db.vehicles[index] = { ...db.vehicles[index], ...v };
            }
        });
        
        writeJsonDb(config.filePath || `./db/${facilityId}.json`, db);
        return vehicles;
    } else {
        const pool = getMysqlPool(facilityId, config.mysql);
        for (const v of vehicles) {
            const formatted = formatToDb('vehicles', v);
            const keys = Object.keys(formatted);
            const values = Object.values(formatted);
            const placeholders = keys.map(() => '?').join(', ');
            const columns = keys.map(k => `\`${k}\``).join(', ');
            const updateClause = keys.map(k => `\`${k}\` = VALUES(\`${k}\`)`).join(', ');
            const sql = `INSERT INTO \`vehicles\` (${columns}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`;
            await pool.query(sql, values);
        }
        return vehicles;
    }
};

let superAdminsTableInitialized = false;
export const initSuperAdminsTable = async () => {
    if (superAdminsTableInitialized) return;
    try {
        const pool = getPool('facility_1');
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
        const [rows]: any = await pool.query(`SELECT COUNT(*) as count FROM \`super_admins\``);
        if (rows[0].count === 0) {
            console.log('[serverDb] Seeding initial super_admins into MySQL...');
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
            console.log('[serverDb] Initial super admin accounts seeded.');
        }
        superAdminsTableInitialized = true;
    } catch (e: any) {
        console.error('[serverDb] Error initializing super_admins table:', e.message);
    }
};

export const getSuperAdmin = async (identifier: string): Promise<any | null> => {
    loadConfigs();
    await initSuperAdminsTable();
    try {
        const pool = getPool('facility_1');
        if (pool) {
            const [rows]: any = await pool.query(`SELECT * FROM \`super_admins\` WHERE \`username\` = ? OR \`id\` = ? LIMIT 1`, [identifier, identifier]);
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
    } catch(e: any) {
        console.error('[serverDb] getSuperAdmin DB error, fallback to env:', e.message);
    }

    if (configs && Array.isArray(configs.super_admins)) {
        const sa = configs.super_admins.find((sa: any) => sa.username === identifier || sa.id === identifier);
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
    }
    return null;
};

export const getAllSuperAdmins = async (): Promise<any[]> => {
    await initSuperAdminsTable();
    const pool = getPool('facility_1');
    if (!pool) return [];
    const [rows]: any = await pool.query(`SELECT \`id\`, \`username\`, \`name\`, \`role\`, \`managedFacilities\`, \`created_at\`, \`updated_at\` FROM \`super_admins\` ORDER BY \`created_at\` ASC`);
    return rows.map((r: any) => {
        let managedFacilities = [];
        try { managedFacilities = typeof r.managedFacilities === 'string' ? JSON.parse(r.managedFacilities) : (r.managedFacilities || []); } catch(e) { managedFacilities = []; }
        return { ...r, managedFacilities };
    });
};

export const addSuperAdmin = async (data: { username: string; name: string; password: string; role?: string; managedFacilities?: string[] }): Promise<any> => {
    await initSuperAdminsTable();
    const pool = getPool('facility_1');
    if (!pool) throw new Error('Cannot connect to database');
    const strUser = String(data.username).trim().toLowerCase();
    const [existing]: any = await pool.query(`SELECT \`id\` FROM \`super_admins\` WHERE \`username\` = ?`, [strUser]);
    if (existing.length > 0) {
        throw new Error(`Tên đăng nhập "${strUser}" đã tồn tại.`);
    }
    const id = 'sa_' + strUser.replace(/[^a-zA-Z0-9_]/g, '_') + '_' + Date.now().toString().slice(-4);
    const facilitiesJson = JSON.stringify(Array.isArray(data.managedFacilities) && data.managedFacilities.length > 0 ? data.managedFacilities : ["facility_1", "facility_2", "facility_3", "facility_4"]);
    await pool.query(
        `INSERT INTO \`super_admins\` (\`id\`, \`username\`, \`name\`, \`password\`, \`role\`, \`managedFacilities\`) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, strUser, String(data.name).trim(), String(data.password), data.role || 'SuperAdmin', facilitiesJson]
    );
    return { success: true, id, username: strUser, name: data.name, role: data.role || 'SuperAdmin' };
};

export const updateSuperAdmin = async (id: string, data: { name: string; role?: string; managedFacilities?: string[] }): Promise<void> => {
    await initSuperAdminsTable();
    const pool = getPool('facility_1');
    if (!pool) throw new Error('Cannot connect to database');
    const facilitiesJson = JSON.stringify(Array.isArray(data.managedFacilities) ? data.managedFacilities : ["facility_1", "facility_2", "facility_3", "facility_4"]);
    await pool.query(
        `UPDATE \`super_admins\` SET \`name\` = ?, \`role\` = ?, \`managedFacilities\` = ? WHERE \`id\` = ?`,
        [String(data.name).trim(), data.role || 'SuperAdmin', facilitiesJson, id]
    );
};

export const deleteSuperAdmin = async (id: string): Promise<void> => {
    await initSuperAdminsTable();
    const pool = getPool('facility_1');
    if (!pool) throw new Error('Cannot connect to database');
    const [rows]: any = await pool.query(`SELECT COUNT(*) as count FROM \`super_admins\``);
    if (rows[0].count <= 1) {
        throw new Error('Không thể xóa tài khoản Quản trị chuỗi duy nhất còn lại.');
    }
    await pool.query(`DELETE FROM \`super_admins\` WHERE \`id\` = ?`, [id]);
};

export const resetSuperAdminPassword = async (id: string, newPassword: string): Promise<void> => {
    await initSuperAdminsTable();
    const pool = getPool('facility_1');
    if (!pool) throw new Error('Cannot connect to database');
    await pool.query(`UPDATE \`super_admins\` SET \`password\` = ? WHERE \`id\` = ?`, [String(newPassword), id]);
};

export const updateSuperAdminPasswordByUsername = async (username: string, newPassword: string): Promise<void> => {
    await initSuperAdminsTable();
    const pool = getPool('facility_1');
    if (!pool) throw new Error('Cannot connect to database');
    await pool.query(`UPDATE \`super_admins\` SET \`password\` = ? WHERE \`username\` = ?`, [String(newPassword), username]);
};

export const findUserByUsername = async (username: string): Promise<{ facilityId: string, user: any } | null> => {
    loadConfigs();
    const facilityIds = Object.keys(configs).filter(key => key !== 'super_admins');
    for (const fId of facilityIds) {
        try {
            const users = await getAll(fId, 'users');
            const matchedUser = users.find((u: any) => String(u.id) === username);
            if (matchedUser) {
                return { facilityId: fId, user: matchedUser };
            }
        } catch (e) {
            console.error(`Lỗi khi quét tìm user ${username} ở cơ sở ${fId}:`, e);
        }
    }
    return null;
};

export const findUserInFacility = async (username: string, facilityId: string): Promise<{ facilityId: string, user: any } | null> => {
    loadConfigs();
    try {
        const users = await getAll(facilityId, 'users');
        const matchedUser = users.find((u: any) => String(u.id) === username);
        if (matchedUser) {
            return { facilityId, user: matchedUser };
        }
    } catch (e) {
        console.error(`Lỗi khi tìm user ${username} ở cơ sở ${facilityId}:`, e);
    }
    return null;
};

export const getFacilitiesList = (): any[] => {
    loadConfigs();
    return Object.keys(configs)
        .filter(key => key !== 'super_admins')
        .map(key => ({
            id: key,
            name: configs[key].name,
            type: configs[key].type
        }));
};

// === Quotation Follow-up DB Helpers ===

export const initQuotationFollowupsTable = async (facilityId: string) => {
    try {
        const pool = getPool(facilityId);
        if (!pool) return;
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
    } catch (e: any) {
        console.error(`[serverDb] Error initializing quotation_followups table for ${facilityId}:`, e.message);
    }
};

export const getQuotationFollowups = async (facilityId: string, advisorId?: string) => {
    await initQuotationFollowupsTable(facilityId);
    try {
        const pool = getPool(facilityId);
        if (!pool) return [];
        let query = 'SELECT * FROM `quotation_followups`';
        const params: any[] = [];
        if (advisorId) {
            query += ' WHERE `advisorId` = ?';
            params.push(advisorId);
        }
        query += ' ORDER BY `quotationDate` DESC';
        const [rows]: any = await pool.query(query, params);
        return rows || [];
    } catch (e: any) {
        console.error(`[serverDb] Error fetching quotation followups for ${facilityId}:`, e.message);
        return [];
    }
};

export const createQuotationFollowup = async (facilityId: string, data: any) => {
    await initQuotationFollowupsTable(facilityId);
    try {
        const pool = getPool(facilityId);
        if (!pool) throw new Error('Không thể kết nối cơ sở dữ liệu.');
        const id = data.id || ('qf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));
        const quotationDate = data.quotationDate || new Date();
        const followupStatus = data.followupStatus || 'Chờ duyệt';
        await pool.query(
            `INSERT INTO \`quotation_followups\` 
            (\`id\`, \`originalJobId\`, \`licensePlate\`, \`customerName\`, \`customerPhone\`, \`carModel\`, \`vin\`, \`jobType\`, \`advisorName\`, \`advisorId\`, \`km\`, \`quotationDate\`, \`followupStatus\`, \`notes\`)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                data.originalJobId || '',
                data.licensePlate || '',
                data.customerName || '',
                data.customerPhone || null,
                data.carModel || '',
                data.vin || null,
                data.jobType || '',
                data.advisorName || '',
                data.advisorId || '',
                data.km || 0,
                quotationDate,
                followupStatus,
                data.notes || null,
            ]
        );
        return { id, ...data, quotationDate, followupStatus };
    } catch (e: any) {
        console.error(`[serverDb] Error creating quotation followup for ${facilityId}:`, e.message);
        throw e;
    }
};

export const updateQuotationFollowup = async (facilityId: string, id: string, data: any) => {
    await initQuotationFollowupsTable(facilityId);
    try {
        const pool = getPool(facilityId);
        if (!pool) throw new Error('Không thể kết nối cơ sở dữ liệu.');
        const fields: string[] = [];
        const values: any[] = [];
        if (data.followupStatus !== undefined) {
            fields.push('`followupStatus` = ?');
            values.push(data.followupStatus);
        }
        if (data.notes !== undefined) {
            fields.push('`notes` = ?');
            values.push(data.notes);
        }
        if (data.appointmentJobId !== undefined) {
            fields.push('`appointmentJobId` = ?');
            values.push(data.appointmentJobId);
        }
        if (fields.length === 0) return { success: true };
        values.push(id);
        await pool.query(`UPDATE \`quotation_followups\` SET ${fields.join(', ')} WHERE \`id\` = ?`, values);
        return { success: true };
    } catch (e: any) {
        console.error(`[serverDb] Error updating quotation followup ${id}:`, e.message);
        throw e;
    }
};

export const deleteQuotationFollowup = async (facilityId: string, id: string) => {
    await initQuotationFollowupsTable(facilityId);
    try {
        const pool = getPool(facilityId);
        if (!pool) throw new Error('Không thể kết nối cơ sở dữ liệu.');
        await pool.query('DELETE FROM `quotation_followups` WHERE `id` = ?', [id]);
        return { success: true };
    } catch (e: any) {
        console.error(`[serverDb] Error deleting quotation followup ${id}:`, e.message);
        throw e;
    }
};

