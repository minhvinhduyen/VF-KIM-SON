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

export const getAll = async (facilityId: string, table: string): Promise<any[]> => {
    const config = getFacilityConfig(facilityId);
    if (config.type === 'json') {
        const db = readJsonDb(config.filePath || `./db/${facilityId}.json`);
        return db[table] || [];
    } else {
        const pool = getMysqlPool(facilityId, config.mysql);
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

export const getSuperAdmin = (username: string): any | null => {
    loadConfigs();
    if (configs && Array.isArray(configs.super_admins)) {
        const sa = configs.super_admins.find((sa: any) => sa.username === username);
        if (!sa) return null;
        const cleanUser = username.replace(/[^a-zA-Z0-9]/g, '_');
        const candidates = [
            `SA_PASS_${username}`,
            `SA_PASS_${cleanUser}`,
            `SA_PASS_${username.toUpperCase()}`,
            `SA_PASS_${cleanUser.toUpperCase()}`,
            `SA_PASS_${username.toLowerCase()}`,
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
