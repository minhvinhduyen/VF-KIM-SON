// Entry point cho cPanel Phusion Passenger
// Passenger tự quản lý port, không cần app.listen()

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
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

const dbGetAll = async (fId, table) => {
    const c = getFacilityConfig(fId); if (!c) return [];
    const pool = getMysqlPool(fId, c.mysql);
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

const getSuperAdmin = (username) => {
    loadConfigs();
    return (configs.super_admins || []).find(sa => sa.username === username) || null;
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

const getFacilitiesList = () => {
    loadConfigs();
    return Object.keys(configs).filter(k => k.startsWith('facility_')).map(k => ({ id: k, name: configs[k].name }));
};

// === MIDDLEWARE ===
app.use((req, res, next) => {
    req.facilityId = String(req.headers['x-facility-id'] || 'facility_1');
    next();
});

// === API ROUTES ===

// Scan Plate AI
app.post('/vf-api/api/scan-plate', async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        const apiKey = (process.env.GEMINI_API_KEY || '').trim();
        if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
        if (!imageBase64) return res.status(400).json({ error: 'No image data' });
        const { GoogleGenAI } = require('@google/genai');
        const client = new GoogleGenAI({ apiKey });
        const result = await client.models.generateContent({
            model: 'gemini-2.0-flash-lite',
            contents: [{ parts: [
                { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
                { text: "Hãy trích xuất chính xác biển số xe từ hình ảnh này. Chỉ trả về chuỗi biển số (ví dụ: 59A-123.45). Không thêm bất kỳ ghi chú hay văn bản nào khác. Nếu không tìm thấy, trả về 'NOT_FOUND'." }
            ]}]
        });
        res.json({ plate: (result.text || '').trim() });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Fast Data
app.get('/vf-api/api/fast-data', async (req, res) => {
    try {
        const [jobs, users, bays] = await Promise.all([dbGetAll(req.facilityId, 'jobs'), dbGetAll(req.facilityId, 'users'), dbGetAll(req.facilityId, 'bays')]);
        res.json({ jobs, users, bays });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/vf-api/api/all-data', async (req, res) => {
    try {
        const [jobs, users, bays, vehicles] = await Promise.all([dbGetAll(req.facilityId, 'jobs'), dbGetAll(req.facilityId, 'users'), dbGetAll(req.facilityId, 'bays'), dbGetAll(req.facilityId, 'vehicles')]);
        res.json({ jobs, users, bays, vehicles });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/vf-api/api/vehicles', async (req, res) => {
    try { res.json(await dbGetAll(req.facilityId, 'vehicles')); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Jobs CRUD
app.post('/vf-api/api/jobs', async (req, res) => { try { res.json(await dbInsert(req.facilityId, 'jobs', req.body)); } catch(e) { res.status(500).json({error:e.message}); }});
app.put('/vf-api/api/jobs', async (req, res) => { try { res.json(await dbUpdate(req.facilityId, 'jobs', req.body.id, req.body)); } catch(e) { res.status(500).json({error:e.message}); }});
app.delete('/vf-api/api/jobs/:id', async (req, res) => { try { await dbDelete(req.facilityId, 'jobs', req.params.id); res.json({success:true}); } catch(e) { res.status(500).json({error:e.message}); }});

// Users CRUD
app.post('/vf-api/api/users', async (req, res) => {
    try {
        const newUserId = String(req.body.id).trim();
        if (!newUserId) return res.status(400).json({ error: "Mã nhân viên không được để trống." });
        const sa = getSuperAdmin(newUserId);
        if (sa) return res.status(400).json({ error: `Mã "${newUserId}" trùng với tài khoản Quản Lý Chuỗi.` });
        const dup = await findUserByUsername(newUserId);
        if (dup) {
            const fn = getFacilitiesList().find(f => f.id === dup.facilityId)?.name || dup.facilityId;
            return res.status(400).json({ error: `Mã "${newUserId}" đã tồn tại ở cơ sở "${fn}".` });
        }
        res.json(await dbInsert(req.facilityId, 'users', req.body));
    } catch(e) { res.status(500).json({error:e.message}); }
});
app.put('/vf-api/api/users', async (req, res) => { try { res.json(await dbUpdate(req.facilityId, 'users', req.body.id, req.body)); } catch(e) { res.status(500).json({error:e.message}); }});
app.delete('/vf-api/api/users/:id', async (req, res) => { try { await dbDelete(req.facilityId, 'users', req.params.id); res.json({success:true}); } catch(e) { res.status(500).json({error:e.message}); }});

// Bays CRUD
app.post('/vf-api/api/bays', async (req, res) => { try { res.json(await dbInsert(req.facilityId, 'bays', req.body)); } catch(e) { res.status(500).json({error:e.message}); }});
app.put('/vf-api/api/bays', async (req, res) => { try { res.json(await dbUpdate(req.facilityId, 'bays', req.body.id, req.body)); } catch(e) { res.status(500).json({error:e.message}); }});
app.delete('/vf-api/api/bays/:id', async (req, res) => { try { await dbDelete(req.facilityId, 'bays', req.params.id); res.json({success:true}); } catch(e) { res.status(500).json({error:e.message}); }});

// Vehicles
app.post('/vf-api/api/vehicles', async (req, res) => { try { res.json(await dbInsert(req.facilityId, 'vehicles', req.body)); } catch(e) { res.status(500).json({error:e.message}); }});
app.put('/vf-api/api/vehicles', async (req, res) => { try { res.json(await dbUpdate(req.facilityId, 'vehicles', req.body.id, req.body)); } catch(e) { res.status(500).json({error:e.message}); }});
app.post('/vf-api/api/vehicles/import', async (req, res) => {
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

// Login
app.post('/vf-api/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: "Vui lòng nhập đầy đủ." });
        const strUser = String(username).trim(), strPass = String(password);
        const sa = getSuperAdmin(strUser);
        if (sa && String(sa.password) === strPass) { const { password: _, ...u } = sa; return res.json({ success: true, user: u }); }
        const result = await findUserByUsername(strUser);
        if (result && String(result.user.password) === strPass) { const { password: _, ...u } = result.user; return res.json({ success: true, user: { ...u, facilityId: result.facilityId } }); }
        return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không chính xác." });
    } catch(e) { res.status(500).json({error:e.message}); }
});

// Facilities
app.get('/vf-api/api/facilities', (req, res) => { try { res.json(getFacilitiesList()); } catch(e) { res.status(500).json({error:e.message}); }});

// Super Admin Overview
app.get('/vf-api/api/super-admin/overview', async (req, res) => {
    try {
        const list = getFacilitiesList();
        const branchSummaries = [];
        let totalActiveJobs=0,totalWaitingJobs=0,totalAppointments=0,totalBays=0,totalRevenue=0,totalVehicleVisits=0,totalVehiclesInWorkshop=0,totalOnTimeJobs=0,totalCompletedJobs=0,totalAppointmentJobs=0,totalNonAppointmentJobs=0;
        const fromDate = req.query.from ? new Date(req.query.from + 'T00:00:00') : null;
        const toDate = req.query.to ? new Date(req.query.to + 'T23:59:59') : null;
        for (const facility of list) {
            try {
                const [jobs, bays] = await Promise.all([dbGetAll(facility.id, 'jobs'), dbGetAll(facility.id, 'bays')]);
                const activeJobs = jobs.filter(j=>j.status==='Đang làm');
                const waitingJobs = jobs.filter(j=>['Chờ sửa chữa','Chờ tiếp nhận','Đã mở phiếu'].includes(j.status));
                const appointmentsToday = jobs.filter(j=>j.status==='Hẹn');
                const vehiclesInWorkshop = jobs.filter(j=>['Đang làm','Chờ sửa chữa','Dừng sửa chữa','Đã mở phiếu','Chờ tiếp nhận','Rửa xe'].includes(j.status));
                totalActiveJobs+=activeJobs.length; totalWaitingJobs+=waitingJobs.length; totalAppointments+=appointmentsToday.length; totalBays+=bays.length; totalVehiclesInWorkshop+=vehiclesInWorkshop.length;
                const periodJobs = jobs.filter(j => { if(!j.plannedStartTime)return false; const d=new Date(j.plannedStartTime); if(fromDate&&d<fromDate)return false; if(toDate&&d>toDate)return false; return true; });
                const vehicleVisits = periodJobs.filter(j=>!j.continuationOfJobId&&j.status!=='Hẹn'&&j.status!=='Bỏ hẹn').length;
                let branchRevenue = 0;
                periodJobs.forEach(j => { if(j.jsonData){ try{ const p=JSON.parse(j.jsonData); branchRevenue+=(Number(p.congSCC)||0)+(Number(p.congDong)||0)+(Number(p.congSon)||0)+(Number(p.phuTung)||0); }catch(e){} }});
                const completedInPeriod = periodJobs.filter(j=>['Hoàn thành SC','Rửa xe','Sẵn sàng giao xe','Đã ra cổng'].includes(j.status));
                const onTimeInPeriod = completedInPeriod.filter(j=>j.actualEndTime&&j.plannedEndTime&&new Date(j.actualEndTime)<=new Date(j.plannedEndTime));
                const appointmentJobsInPeriod = periodJobs.filter(j=>j.isAppointment&&!j.continuationOfJobId);
                const allUniqueJobsInPeriod = periodJobs.filter(j=>!j.continuationOfJobId&&j.status!=='Hẹn'&&j.status!=='Bỏ hẹn');
                totalRevenue+=branchRevenue; totalVehicleVisits+=vehicleVisits; totalOnTimeJobs+=onTimeInPeriod.length; totalCompletedJobs+=completedInPeriod.length; totalAppointmentJobs+=appointmentJobsInPeriod.length; totalNonAppointmentJobs+=allUniqueJobsInPeriod.length;
                branchSummaries.push({ facilityId:facility.id, facilityName:facility.name, activeCount:activeJobs.length, waitingCount:waitingJobs.length, appointmentCount:appointmentsToday.length, totalJobs:jobs.length, baysCount:bays.length, revenue:branchRevenue, vehicleVisits, vehiclesInWorkshop:vehiclesInWorkshop.length, completedCount:completedInPeriod.length, onTimeCount:onTimeInPeriod.length, onTimeRate:completedInPeriod.length>0?Math.round((onTimeInPeriod.length/completedInPeriod.length)*100):0, appointmentJobCount:appointmentJobsInPeriod.length, uniqueJobCount:allUniqueJobsInPeriod.length, appointmentRate:allUniqueJobsInPeriod.length>0?Math.round((appointmentJobsInPeriod.length/allUniqueJobsInPeriod.length)*100):0 });
            } catch(e) { console.error(`Error ${facility.id}:`, e); }
        }
        res.json({ totalActiveJobs, totalWaitingJobs, totalAppointments, totalBays, totalRevenue, totalVehicleVisits, totalVehiclesInWorkshop, totalOnTimeRate:totalCompletedJobs>0?Math.round((totalOnTimeJobs/totalCompletedJobs)*100):0, totalAppointmentRate:totalNonAppointmentJobs>0?Math.round((totalAppointmentJobs/totalNonAppointmentJobs)*100):0, branchSummaries, slaViolations:[] });
    } catch(e) { res.status(500).json({error:e.message}); }
});

// Phục vụ frontend static
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    app.use('/vf-api', express.static(distPath));
}

// Passenger không cần app.listen() - chỉ cần module.exports
if (typeof(PhusionPassenger) !== 'undefined') {
    module.exports = app;
} else {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}
