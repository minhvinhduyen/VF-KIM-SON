import React, { useState, useEffect } from 'react';
import * as apiService from '../../services/apiService';
import { useAuth } from '../../hooks/useAuth';

interface SuperAdminUser {
  id: string;
  username: string;
  name: string;
  role: string;
  managedFacilities: string[];
  created_at?: string;
  updated_at?: string;
}

interface FacilityOption {
  id: string;
  name: string;
}

const SuperAdminManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [admins, setAdmins] = useState<SuperAdminUser[]>([]);
  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPassModalOpen, setIsResetPassModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<SuperAdminUser | null>(null);

  // Form states - Add
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    password: '',
    role: 'SuperAdmin',
    managedFacilities: [] as string[],
  });

  // Form states - Edit
  const [editFormData, setEditFormData] = useState({
    name: '',
    role: 'SuperAdmin',
    managedFacilities: [] as string[],
  });

  // Form states - Reset Password
  const [newPassword, setNewPassword] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [adminList, facList] = await Promise.all([
        apiService.fetchSuperAdmins(),
        apiService.fetchFacilities(),
      ]);
      setAdmins(adminList || []);
      setFacilities(facList || []);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách tài khoản chuỗi.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Add SuperAdmin
  const handleOpenAddModal = () => {
    setFormData({
      username: '',
      name: '',
      password: '',
      role: 'SuperAdmin',
      managedFacilities: facilities.map(f => f.id),
    });
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await apiService.addSuperAdmin(formData);
      setSuccess(`Đã tạo tài khoản "${formData.username}" thành công!`);
      setIsAddModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo tài khoản.');
    }
  };

  // Handle Edit SuperAdmin
  const handleOpenEditModal = (admin: SuperAdminUser) => {
    setSelectedAdmin(admin);
    setEditFormData({
      name: admin.name,
      role: admin.role || 'SuperAdmin',
      managedFacilities: admin.managedFacilities || facilities.map(f => f.id),
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin) return;
    setError('');
    setSuccess('');
    try {
      await apiService.updateSuperAdmin(selectedAdmin.id, editFormData);
      setSuccess(`Đã cập nhật thông tin tài khoản "${selectedAdmin.username}" thành công!`);
      setIsEditModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật tài khoản.');
    }
  };

  // Handle Reset Password
  const handleOpenResetPassModal = (admin: SuperAdminUser) => {
    setSelectedAdmin(admin);
    setNewPassword('');
    setIsResetPassModalOpen(true);
  };

  const handleResetPassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin) return;
    if (!newPassword) {
      setError('Vui lòng nhập mật khẩu mới.');
      return;
    }
    setError('');
    setSuccess('');
    try {
      await apiService.resetSuperAdminPassword(selectedAdmin.id, newPassword);
      setSuccess(`Đã đặt lại mật khẩu cho tài khoản "${selectedAdmin.username}" thành công!`);
      setIsResetPassModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi đặt lại mật khẩu.');
    }
  };

  // Handle Delete
  const handleOpenDeleteModal = (admin: SuperAdminUser) => {
    setSelectedAdmin(admin);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAdmin) return;
    setError('');
    setSuccess('');
    try {
      await apiService.deleteSuperAdmin(selectedAdmin.id);
      setSuccess(`Đã xóa tài khoản "${selectedAdmin.username}" thành công!`);
      setIsDeleteModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa tài khoản.');
    }
  };

  const toggleFacility = (list: string[], facId: string): string[] => {
    if (list.includes(facId)) {
      return list.filter(id => id !== facId);
    } else {
      return [...list, facId];
    }
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <span>🛡️</span> Quản lý Tài khoản Cấp Chuỗi
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý tài khoản Ban Giám Đốc, Kiểm Soát Chất Lượng (KSCL) và Quản Trị Viên Chuỗi Vinfast Kim Sơn.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="bg-brand-blue hover:bg-blue-800 text-white font-bold px-4 py-2.5 rounded-xl shadow-md transition flex items-center space-x-2 text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          <span>+ Thêm tài khoản Chuỗi</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg mb-4 text-sm text-red-700 font-medium flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 font-bold">&times;</button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg mb-4 text-sm text-green-700 font-medium flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-green-500 font-bold">&times;</button>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100/80 border-b border-gray-200 text-xs font-extrabold text-gray-600 uppercase tracking-wider">
                <th className="py-3.5 px-4">Tên đăng nhập</th>
                <th className="py-3.5 px-4">Họ và tên</th>
                <th className="py-3.5 px-4">Chức vụ / Vai trò</th>
                <th className="py-3.5 px-4">Xưởng phụ trách</th>
                <th className="py-3.5 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm font-semibold text-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-400">
                    <div className="flex justify-center items-center space-x-2">
                      <svg className="animate-spin h-5 w-5 text-brand-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Đang tải danh sách tài khoản...</span>
                    </div>
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-400">
                    Chưa có tài khoản quản lý chuỗi nào trong hệ thống.
                  </td>
                </tr>
              ) : (
                admins.map((adm) => (
                  <tr key={adm.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-extrabold text-brand-blue bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                        {adm.username}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      {adm.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full text-xs font-extrabold border border-purple-100">
                        {adm.role || 'SuperAdmin'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(!adm.managedFacilities || adm.managedFacilities.length === 0 || adm.managedFacilities.length === facilities.length) ? (
                          <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-[11px] font-bold border border-green-200">
                            Tất cả cơ sở
                          </span>
                        ) : (
                          adm.managedFacilities.map(fId => {
                            const fName = facilities.find(f => f.id === fId)?.name.replace('Vinfast Kim Sơn ', '') || fId;
                            return (
                              <span key={fId} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[11px] font-bold border border-gray-200">
                                {fName}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center space-x-2">
                        {/* Reset Password Button */}
                        <button
                          onClick={() => handleOpenResetPassModal(adm)}
                          title="Đặt lại mật khẩu"
                          className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold px-2.5 py-1.5 rounded-lg text-xs transition flex items-center space-x-1"
                        >
                          <span>🔑</span>
                          <span>Đổi MK</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEditModal(adm)}
                          title="Chỉnh sửa thông tin"
                          className="bg-blue-50 hover:bg-blue-100 text-brand-blue border border-blue-200 font-bold px-2.5 py-1.5 rounded-lg text-xs transition flex items-center space-x-1"
                        >
                          <span>✏️</span>
                          <span>Sửa</span>
                        </button>

                        {/* Delete Button */}
                        {admins.length > 1 && (
                          <button
                            onClick={() => handleOpenDeleteModal(adm)}
                            title="Xóa tài khoản"
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold px-2.5 py-1.5 rounded-lg text-xs transition flex items-center space-x-1"
                          >
                            <span>🗑️</span>
                            <span>Xóa</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL 1: THÊM TÀI KHOẢN --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-brand-blue to-blue-800 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg">Thêm tài khoản Quản trị Chuỗi</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-white/80 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Tên đăng nhập (Mã tài khoản) *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Ví dụ: giamdoc-kd, kscl-ks2"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-blue outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Họ và tên người dùng *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn A (Phụ trách KSCL)"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-blue outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Mật khẩu khởi tạo *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Nhập mật khẩu cho tài khoản"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-blue outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Chức danh / Vai trò</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-blue outline-none bg-white"
                >
                  <option value="SuperAdmin">SuperAdmin (Quản lý cấp cao nhất)</option>
                  <option value="KSCL">Kiểm Soát Chất Lượng (KSCL)</option>
                  <option value="BanGiámĐốc">Ban Giám Đốc</option>
                  <option value="ThanhTra">Thanh Tra Chuỗi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Các cơ sở được phân quyền quản lý:</label>
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  {facilities.map(f => (
                    <label key={f.id} className="flex items-center space-x-2 text-xs font-bold text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.managedFacilities.includes(f.id)}
                        onChange={() => setFormData({ ...formData, managedFacilities: toggleFacility(formData.managedFacilities, f.id) })}
                        className="rounded text-brand-blue focus:ring-brand-blue"
                      />
                      <span>{f.name.replace('Vinfast Kim Sơn ', '')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 font-bold text-sm hover:bg-gray-100">Hủy</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-brand-blue hover:bg-blue-800 text-white font-bold text-sm shadow-md">Tạo tài khoản</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: SỬA TÀI KHOẢN --- */}
      {isEditModalOpen && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-brand-blue to-blue-800 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg">Chỉnh sửa tài khoản: {selectedAdmin.username}</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-white/80 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Họ và tên người dùng *</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-blue outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Chức danh / Vai trò</label>
                <select
                  value={editFormData.role}
                  onChange={e => setEditFormData({ ...editFormData, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-blue outline-none bg-white"
                >
                  <option value="SuperAdmin">SuperAdmin (Quản lý cấp cao nhất)</option>
                  <option value="KSCL">Kiểm Soát Chất Lượng (KSCL)</option>
                  <option value="BanGiámĐốc">Ban Giám Đốc</option>
                  <option value="ThanhTra">Thanh Tra Chuỗi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Các cơ sở được phân quyền quản lý:</label>
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  {facilities.map(f => (
                    <label key={f.id} className="flex items-center space-x-2 text-xs font-bold text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editFormData.managedFacilities.includes(f.id)}
                        onChange={() => setEditFormData({ ...editFormData, managedFacilities: toggleFacility(editFormData.managedFacilities, f.id) })}
                        className="rounded text-brand-blue focus:ring-brand-blue"
                      />
                      <span>{f.name.replace('Vinfast Kim Sơn ', '')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 font-bold text-sm hover:bg-gray-100">Hủy</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-brand-blue hover:bg-blue-800 text-white font-bold text-sm shadow-md">Lưu thay đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: ĐẶT LẠI MẬT KHẨU --- */}
      {isResetPassModalOpen && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-amber-500 to-amber-700 text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span>🔑</span>
                <h3 className="font-bold text-lg">Đặt lại mật khẩu</h3>
              </div>
              <button onClick={() => setIsResetPassModalOpen(false)} className="text-white/80 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleResetPassSubmit} className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800 font-semibold">
                Bạn đang đặt lại mật khẩu cho tài khoản: <span className="font-extrabold text-gray-900">{selectedAdmin.name} ({selectedAdmin.username})</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Mật khẩu mới *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsResetPassModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 font-bold text-sm hover:bg-gray-100">Hủy</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md">Xác nhận đổi MK</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 4: XÁC NHẬN XÓA --- */}
      {isDeleteModalOpen && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
            <div className="bg-red-600 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg">Xác nhận xóa tài khoản</h3>
              <button onClick={() => setIsDeleteModalOpen(false)} className="text-white/80 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700">
                Bạn có chắc chắn muốn xóa tài khoản Quản trị chuỗi <span className="font-bold text-red-600">{selectedAdmin.name} ({selectedAdmin.username})</span> không?
              </p>
              <p className="text-xs text-gray-500 bg-red-50 p-3 rounded-xl border border-red-200">
                ⚠️ Hành động này không thể hoàn tác. Người dùng này sẽ không thể đăng nhập vào hệ thống nữa.
              </p>

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600 font-bold text-sm hover:bg-gray-100">Hủy</button>
                <button onClick={handleDeleteConfirm} className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md">Xóa vĩnh viễn</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminManagement;
