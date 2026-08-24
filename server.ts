import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import * as genai from "@google/genai";
import * as db from './serverDb';

dotenv.config();

// Defensively handle different import styles
const GoogleGenAI = genai.GoogleGenAI || (genai as any).default?.GoogleGenAI;

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware xử lý CORS toàn diện & hỗ trợ Preflight cho tất cả các đường dẫn
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-facility-id, Authorization');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Middleware xác định facility (Cơ sở) — ưu tiên query param, fallback sang header
  app.use((req, res, next) => {
    const facilityId = (req.query as any).facilityId || req.headers['x-facility-id'] || '';
    (req as any).facilityId = String(facilityId);
    next();
  });

  // Logging middleware to debug requests
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[API Request] [Facility: "${(req as any).facilityId}"] ${req.method} ${req.url}`);
    }
    next();
  });

  // Helper to collect all Gemini API Keys
  const getGeminiApiKeys = () => {
    const rawKeys: string[] = [];
    if (process.env.GEMINI_API_KEY) rawKeys.push(...process.env.GEMINI_API_KEY.split(','));
    if (process.env.GEMINI_API_KEYS) rawKeys.push(...process.env.GEMINI_API_KEYS.split(/[\r\n,]+/));
    Object.keys(process.env).forEach(k => {
      if (/^GEMINI_API_KEY_\d+$/i.test(k) && process.env[k]) {
        rawKeys.push(process.env[k] as string);
      }
    });
    if (process.env.VITE_GEMINI_API_KEY) rawKeys.push(...process.env.VITE_GEMINI_API_KEY.split(','));
    return Array.from(new Set(
      rawKeys
        .map(k => (k || '').trim().replace(/^["']|["']$/g, ''))
        .filter(k => k && k !== 'your_actual_gemini_api_key_here' && k.length > 10)
    ));
  };

  // --- API Route for License Plate Scanning ---
  app.post("/api/scan-plate", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Không có dữ liệu hình ảnh." });
      }

      const apiKeys = getGeminiApiKeys();
      if (apiKeys.length === 0) {
        return res.status(500).json({ error: "Chưa cấu hình GEMINI_API_KEY trên server." });
      }

      const candidateModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'];
      let lastError: any = null;
      let plateResult: string | null = null;

      for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        const genAI = new GoogleGenAI({ apiKey });

        for (const modelName of candidateModels) {
          try {
            const result = await genAI.models.generateContent({
              model: modelName,
              contents: [{
                parts: [
                  { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
                  { text: "Hãy trích xuất chính xác biển số xe từ hình ảnh này. Chỉ trả về chuỗi biển số (ví dụ: 59A-123.45). Không thêm bất kỳ ghi chú hay văn bản nào khác. Nếu không tìm thấy, trả về 'NOT_FOUND'." }
                ]
              }]
            });

            let text = (result.text || "").trim();
            text = text.replace(/```[a-zA-Z]*\n?|\n?```/g, '').trim();
            plateResult = text;
            console.log(`[ScanPlate] Thành công với Key #${i + 1} và Model ${modelName}: "${text}"`);
            break;
          } catch (modelErr: any) {
            console.warn(`[ScanPlate] Key #${i + 1} với model ${modelName} thất bại:`, modelErr.message);
            lastError = modelErr;
            if (modelErr.message && (modelErr.message.includes('429') || modelErr.message.includes('Quota') || modelErr.message.includes('RESOURCE_EXHAUSTED'))) {
              console.warn(`[ScanPlate] Key #${i + 1} hết hạn ngạch / rate limit, chuyển sang Key tiếp theo.`);
              break;
            }
          }
        }

        if (plateResult !== null) break;
      }

      if (plateResult !== null) {
        return res.json({ plate: plateResult });
      }

      throw lastError || new Error("Không thể nhận diện biển số qua AI.");
    } catch (error: any) {
      console.error("[API Error] Gemini Error:", error);
      res.status(500).json({ error: error.message || "Failed to scan license plate" });
    }
  });

  // --- API Endpoints cho Bảng Tiến Độ (Multi-Tenant) ---

  // Lấy dữ liệu nhanh cho bảng tiến độ (Jobs, Users, Bays)
  app.get('/api/fast-data', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      const [jobs, users, bays] = await Promise.all([
        db.getAll(facilityId, 'jobs'),
        db.getAll(facilityId, 'users'),
        db.getAll(facilityId, 'bays')
      ]);
      res.json({ jobs, users, bays });
    } catch (error: any) {
      console.error("[API Error] Get Fast Data failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Lấy toàn bộ dữ liệu (Bao gồm danh sách Vehicles)
  app.get('/api/all-data', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      const [jobs, users, bays, vehicles] = await Promise.all([
        db.getAll(facilityId, 'jobs'),
        db.getAll(facilityId, 'users'),
        db.getAll(facilityId, 'bays'),
        db.getAll(facilityId, 'vehicles')
      ]);
      res.json({ jobs, users, bays, vehicles });
    } catch (error: any) {
      console.error("[API Error] Get All Data failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Lấy danh sách Vehicles
  app.get('/api/vehicles', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      const vehicles = await db.getAll(facilityId, 'vehicles');
      res.json(vehicles);
    } catch (error: any) {
      console.error("[API Error] Get Vehicles failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- JOBS API ---
  app.post('/api/jobs', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      const result = await db.insert(facilityId, 'jobs', req.body);
      res.json(result);
    } catch (error: any) {
      console.error("[API Error] Add Job failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/jobs', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      const result = await db.update(facilityId, 'jobs', req.body.id, req.body);
      res.json(result);
    } catch (error: any) {
      console.error("[API Error] Update Job failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/jobs/:id', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      await db.deleteItem(facilityId, 'jobs', req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[API Error] Delete Job failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- USERS API ---
  app.post('/api/users', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      const newUserId = String(req.body.id).trim();      
      // 1. Kiểm tra trùng với Super Admin
      const superAdmin = await db.getSuperAdmin(newUserId);
      if (superAdmin) {
        return res.status(400).json({ error: `Mã nhân viên "${newUserId}" trùng với tài khoản Quản Lý Chuỗi. Vui lòng chọn tên khác.` });
      }

      // 2. Quét qua tất cả cơ sở kiểm tra trùng lặp
      const duplicateUser = await db.findUserByUsername(newUserId);
      if (duplicateUser) {
        const facList = db.getFacilitiesList();
        const matchedFac = facList.find((f: any) => f.id === duplicateUser.facilityId);
        const facName = matchedFac ? matchedFac.name : duplicateUser.facilityId;
        return res.status(400).json({ 
          error: `Mã nhân viên (tên đăng nhập) "${newUserId}" đã tồn tại ở cơ sở "${facName}". Vui lòng chọn mã khác.` 
        });
      }

      const result = await db.insert(facilityId, 'users', req.body);
      res.json(result);
    } catch (error: any) {
      console.error("[API Error] Failed to create user:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/users', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      const result = await db.update(facilityId, 'users', req.body.id, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      await db.remove(facilityId, 'users', req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // === SUPER ADMIN CRUD & QUẢN TRỊ TÀI KHOẢN CHUỖI ===

  // GET /api/super-admins
  app.get('/api/super-admins', async (req, res) => {
    try {
      const list = await db.getAllSuperAdmins();
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/super-admins
  app.post('/api/super-admins', async (req, res) => {
    try {
      const { username, name, password, role, managedFacilities } = req.body;
      if (!username || !password || !name) {
        return res.status(400).json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập, họ tên và mật khẩu.' });
      }
      const result = await db.addSuperAdmin({ username, name, password, role, managedFacilities });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/super-admins/:id
  app.put('/api/super-admins/:id', async (req, res) => {
    try {
      const { name, role, managedFacilities } = req.body;
      await db.updateSuperAdmin(req.params.id, { name, role, managedFacilities });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/super-admins/:id
  app.delete('/api/super-admins/:id', async (req, res) => {
    try {
      await db.deleteSuperAdmin(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/super-admins/:id/reset-password
  app.post('/api/super-admins/:id/reset-password', async (req, res) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword || String(newPassword).trim() === '') {
        return res.status(400).json({ error: 'Mật khẩu mới không được để trống.' });
      }
      await db.resetSuperAdminPassword(req.params.id, newPassword);
      res.json({ success: true, message: 'Đặt lại mật khẩu thành công!' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/change-password: Tự đổi mật khẩu người dùng đang đăng nhập
  app.post('/api/change-password', async (req, res) => {
    try {
      const { username, currentPassword, newPassword, facilityId } = req.body;
      if (!username || !currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.' });
      }
      const strUser = String(username).trim();
      const strOldPass = String(currentPassword);
      const strNewPass = String(newPassword);

      // 1. Kiểm tra nếu là SuperAdmin
      const sa = await db.getSuperAdmin(strUser);
      if (sa) {
        if (String(sa.password) !== strOldPass) {
          return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác.' });
        }
        await db.updateSuperAdminPasswordByUsername(strUser, strNewPass);
        return res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
      }

      // 2. Kiểm tra nếu là tài khoản cơ sở
      const targetFacility = facilityId || (req as any).facilityId;
      if (!targetFacility) {
        return res.status(400).json({ error: 'Không xác định được cơ sở của tài khoản.' });
      }
      const userResult = await db.findUserInFacility(strUser, targetFacility);
      if (!userResult) {
        return res.status(404).json({ error: 'Không tìm thấy tài khoản người dùng.' });
      }
      if (String(userResult.user.password) !== strOldPass) {
        return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác.' });
      }

      await db.update(targetFacility, 'users', userResult.user.id, {
        ...userResult.user,
        password: strNewPass
      });
      return res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // === Quotation Follow-ups API routes ===
  app.get('/api/quotation-followups', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      const advisorId = req.query.advisorId as string | undefined;
      const followups = await db.getQuotationFollowups(facilityId, advisorId);
      res.set('Cache-Control', 'no-store');
      res.json(followups);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/quotation-followups', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      const result = await db.createQuotationFollowup(facilityId, req.body);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/quotation-followups/:id', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      const result = await db.updateQuotationFollowup(facilityId, req.params.id, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/quotation-followups/:id', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      const result = await db.deleteQuotationFollowup(facilityId, req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bays CRUD
  app.post('/api/bays', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      const result = await db.insert(facilityId, 'bays', req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/bays', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      const result = await db.update(facilityId, 'bays', req.body.id, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/bays/:id', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      await db.remove(facilityId, 'bays', req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vehicles
  app.post('/api/vehicles', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      const result = await db.insert(facilityId, 'vehicles', req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/vehicles', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      const result = await db.update(facilityId, 'vehicles', req.body.licensePlate, req.body);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/vehicles/import', async (req, res) => {
    try {
      const facilityId = (req as any).facilityId;
      const result = await db.importVehicles(facilityId, req.body.vehicles);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Xác thực đăng nhập
  app.post('/api/login', async (req, res) => {
    try {
      const { username, password, facilityId: requestedFacilityId } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Vui lòng nhập đầy đủ tài khoản và mật khẩu." });
      }

      const strUsername = String(username).trim();
      const strPassword = String(password);
      console.log(`[Login attempt] Username: "${strUsername}", Facility: "${requestedFacilityId || 'auto'}"`);

      // 1. Kiểm tra tài khoản Super Admin trước
      const superAdmin = await db.getSuperAdmin(strUsername);
      if (superAdmin && String(superAdmin.password) === strPassword) {
        console.log(`[Login success] SuperAdmin: "${strUsername}"`);
        const { password: _, ...userWithoutPassword } = superAdmin;
        return res.json({
          success: true,
          user: userWithoutPassword
        });
      }

      // 2. Tìm tài khoản người dùng — CHỈ trong cơ sở được chọn
      let searchResult;
      if (requestedFacilityId) {
        // Đã chọn cơ sở -> CHỈ tìm trong cơ sở đó, KHÔNG tìm sang cơ sở khác
        searchResult = await db.findUserInFacility(strUsername, requestedFacilityId);
        if (!searchResult) {
          return res.status(401).json({ error: `Tài khoản "${strUsername}" không tồn tại trong cơ sở đã chọn.` });
        }
      } else {
        // Không chọn cơ sở (Quản lý toàn chuỗi) -> quét tất cả cơ sở
        searchResult = await db.findUserByUsername(strUsername);
      }
      
      if (searchResult) {
        const { facilityId, user } = searchResult;
        console.log(`[Login DB Match] Found user in facility "${facilityId}":`, JSON.stringify(user));
        if (String(user.password) === strPassword) {
          console.log(`[Login success] User: "${strUsername}" at facility: "${facilityId}"`);
          const { password: _, ...userWithoutPassword } = user;
          return res.json({
            success: true,
            user: {
              ...userWithoutPassword,
              facilityId
            }
          });
        } else {
          console.log(`[Login fail] Password mismatch for user "${strUsername}".`);
        }
      } else {
        console.log(`[Login fail] No user found matching username: "${strUsername}"`);
      }

      return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không chính xác." });
    } catch (error: any) {
      console.error("[API Error] Login failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Lấy danh sách toàn bộ cơ sở
  app.get('/api/facilities', (req, res) => {
    try {
      const list = db.getFacilitiesList();
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Báo cáo tổng quan cho Super Admin (hỗ trợ lọc theo ngày)
  app.get('/api/super-admin/overview', async (req, res) => {
    try {
      const list = db.getFacilitiesList();
      const branchSummaries: any[] = [];
      let totalActiveJobs = 0;
      let totalWaitingJobs = 0;
      let totalAppointments = 0;
      let totalBays = 0;
      let totalRevenue = 0;
      let totalVehicleVisits = 0;
      let totalVehiclesInWorkshop = 0;
      let totalOnTimeJobs = 0;
      let totalCompletedJobs = 0;
      let totalAppointmentJobs = 0;
      let totalNonAppointmentJobs = 0;
      const slaViolations: any[] = [];
      const now = new Date();

      // Parse date range from query params
      const fromParam = req.query.from as string;
      const toParam = req.query.to as string;
      const fromDate = fromParam ? new Date(fromParam + 'T00:00:00') : null;
      const toDate = toParam ? new Date(toParam + 'T23:59:59') : null;

      for (const facility of list) {
        try {
          const [jobs, bays] = await Promise.all([
            db.getAll(facility.id, 'jobs'),
            db.getAll(facility.id, 'bays')
          ]);

          // --- Real-time stats (không lọc theo ngày) ---
          const activeJobs = jobs.filter(j => j.status === 'Đang làm');
          const waitingJobs = jobs.filter(j => j.status === 'Chờ sửa chữa' || j.status === 'Chờ tiếp nhận' || j.status === 'Đã mở phiếu');
          const appointmentsToday = jobs.filter(j => j.status === 'Hẹn');
          const vehiclesInWorkshop = jobs.filter(j =>
            j.status === 'Đang làm' || j.status === 'Chờ sửa chữa' || j.status === 'Dừng sửa chữa' ||
            j.status === 'Đã mở phiếu' || j.status === 'Chờ tiếp nhận' || j.status === 'Rửa xe'
          );

          totalActiveJobs += activeJobs.length;
          totalWaitingJobs += waitingJobs.length;
          totalAppointments += appointmentsToday.length;
          totalBays += bays.length;
          totalVehiclesInWorkshop += vehiclesInWorkshop.length;

          // --- Period-filtered stats (lọc theo khoảng thời gian) ---
          // Lọc job theo plannedStartTime nằm trong khoảng [fromDate, toDate]
          const periodJobs = jobs.filter(j => {
            if (!j.plannedStartTime) return false;
            const jobDate = new Date(j.plannedStartTime);
            if (fromDate && jobDate < fromDate) return false;
            if (toDate && jobDate > toDate) return false;
            return true;
          });

          // Lượt xe = job không phải continuation (đếm unique visits)
          const vehicleVisits = periodJobs.filter(j => !j.continuationOfJobId && j.status !== 'Hẹn' && j.status !== 'Bỏ hẹn').length;

          // Doanh thu = tổng từ jsonData
          let branchRevenue = 0;
          periodJobs.forEach(j => {
            if (j.jsonData) {
              try {
                const parsed = JSON.parse(j.jsonData);
                branchRevenue += (Number(parsed.congSCC) || 0) + (Number(parsed.congDong) || 0) +
                                 (Number(parsed.congSon) || 0) + (Number(parsed.phuTung) || 0);
              } catch (e) { /* skip */ }
            }
          });

          // Tỷ lệ đúng hẹn = job hoàn thành đúng hoặc sớm hơn plannedEndTime
          const completedInPeriod = periodJobs.filter(j =>
            j.status === 'Hoàn thành SC' || j.status === 'Rửa xe' || j.status === 'Sẵn sàng giao xe' || j.status === 'Đã ra cổng'
          );
          const onTimeInPeriod = completedInPeriod.filter(j => {
            if (!j.actualEndTime || !j.plannedEndTime) return false;
            return new Date(j.actualEndTime) <= new Date(j.plannedEndTime);
          });

          // Tỷ lệ lịch hẹn = xe có hẹn / tổng xe trong kỳ
          const appointmentJobsInPeriod = periodJobs.filter(j => j.isAppointment && !j.continuationOfJobId);
          const allUniqueJobsInPeriod = periodJobs.filter(j => !j.continuationOfJobId && j.status !== 'Hẹn' && j.status !== 'Bỏ hẹn');

          totalRevenue += branchRevenue;
          totalVehicleVisits += vehicleVisits;
          totalOnTimeJobs += onTimeInPeriod.length;
          totalCompletedJobs += completedInPeriod.length;
          totalAppointmentJobs += appointmentJobsInPeriod.length;
          totalNonAppointmentJobs += allUniqueJobsInPeriod.length;

          // SLA violations (real-time)
          jobs.forEach(j => {
            if (j.status === 'Đang làm' && j.plannedEndTime) {
              const plannedEnd = new Date(j.plannedEndTime);
              if (plannedEnd < now) {
                const diffMin = Math.round((now.getTime() - plannedEnd.getTime()) / 60000);
                slaViolations.push({
                  id: j.id, licensePlate: j.licensePlate, carModel: j.carModel,
                  facilityName: facility.name, status: j.status,
                  plannedTime: j.plannedEndTime, delayMinutes: diffMin, type: 'overdue_end'
                });
              }
            } else if ((j.status === 'Chờ sửa chữa' || j.status === 'Chờ tiếp nhận') && j.plannedStartTime) {
              const plannedStart = new Date(j.plannedStartTime);
              if (plannedStart < now) {
                const diffMin = Math.round((now.getTime() - plannedStart.getTime()) / 60000);
                if (diffMin > 10) {
                  slaViolations.push({
                    id: j.id, licensePlate: j.licensePlate, carModel: j.carModel,
                    facilityName: facility.name, status: j.status,
                    plannedTime: j.plannedStartTime, delayMinutes: diffMin, type: 'overdue_start'
                  });
                }
              }
            }
          });

          branchSummaries.push({
            facilityId: facility.id,
            facilityName: facility.name,
            activeCount: activeJobs.length,
            waitingCount: waitingJobs.length,
            appointmentCount: appointmentsToday.length,
            totalJobs: jobs.length,
            baysCount: bays.length,
            // Period stats
            revenue: branchRevenue,
            vehicleVisits,
            vehiclesInWorkshop: vehiclesInWorkshop.length,
            completedCount: completedInPeriod.length,
            onTimeCount: onTimeInPeriod.length,
            onTimeRate: completedInPeriod.length > 0 ? Math.round((onTimeInPeriod.length / completedInPeriod.length) * 100) : 0,
            appointmentJobCount: appointmentJobsInPeriod.length,
            uniqueJobCount: allUniqueJobsInPeriod.length,
            appointmentRate: allUniqueJobsInPeriod.length > 0 ? Math.round((appointmentJobsInPeriod.length / allUniqueJobsInPeriod.length) * 100) : 0,
          });
        } catch (e) {
          console.error(`Lỗi khi lấy số liệu cho cơ sở ${facility.id}:`, e);
        }
      }

      slaViolations.sort((a, b) => b.delayMinutes - a.delayMinutes);

      res.json({
        totalActiveJobs,
        totalWaitingJobs,
        totalAppointments,
        totalBays,
        totalRevenue,
        totalVehicleVisits,
        totalVehiclesInWorkshop,
        totalOnTimeRate: totalCompletedJobs > 0 ? Math.round((totalOnTimeJobs / totalCompletedJobs) * 100) : 0,
        totalAppointmentRate: totalNonAppointmentJobs > 0 ? Math.round((totalAppointmentJobs / totalNonAppointmentJobs) * 100) : 0,
        branchSummaries,
        slaViolations: slaViolations.slice(0, 10)
      });
    } catch (error: any) {
      console.error("[API Error] Super Admin Overview failed:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Frontend Static / Development mode routing ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get(/.*/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
