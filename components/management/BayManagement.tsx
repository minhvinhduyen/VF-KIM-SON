
import React, { useState } from 'react';
import { useApp } from '../../hooks/useApp';
import { useAuth } from '../../hooks/useAuth';
import { Bay, Role } from '../../types';
import BayFormModal from '../modals/BayFormModal';
import ConfirmationModal from '../modals/ConfirmationModal';

const BayManagement: React.FC = () => {
  const { state, addBay, updateBay, deleteBay } = useApp();
  const { user } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);
  const [bayToDelete, setBayToDelete] = useState<Bay | null>(null);

  // Chỉ Quản lý cơ sở (Manager) và Quản lý chuỗi (SuperAdmin) mới được phép sắp xếp & chỉnh sửa khoang
  const canManageOrder = user?.role === Role.Manager || user?.role === Role.SuperAdmin;

  const handleAdd = () => {
    setSelectedBay(null);
    setIsFormOpen(true);
  };

  const handleEdit = (bay: Bay) => {
    setSelectedBay(bay);
    setIsFormOpen(true);
  };
  
  const handleDeleteRequest = (bay: Bay) => {
    setBayToDelete(bay);
    setIsConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (bayToDelete) {
      try {
        await deleteBay(bayToDelete.id);
      } catch (e) {
        alert("Lỗi khi xóa khoang: " + (e as Error).message);
      }
    }
    setIsConfirmOpen(false);
    setBayToDelete(null);
  };

  const handleFormSave = async (bayData: Omit<Bay, 'id'>) => {
    try {
      if (selectedBay) {
        await updateBay({ ...bayData, id: selectedBay.id });
      } else {
        const newBay = { 
          ...bayData, 
          id: crypto.randomUUID(),
          orderIndex: bayData.orderIndex !== undefined ? bayData.orderIndex : (state.bays.length + 1)
        };
        await addBay(newBay);
      }
      setIsFormOpen(false);
    } catch (e) {
      alert("Lỗi khi lưu khoang: " + (e as Error).message);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (!canManageOrder) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= state.bays.length) return;

    const baysCopy = [...state.bays];
    const temp = baysCopy[index];
    baysCopy[index] = baysCopy[targetIndex];
    baysCopy[targetIndex] = temp;

    try {
      await Promise.all(
        baysCopy.map((b, idx) => {
          const newOrder = idx + 1;
          if (b.orderIndex !== newOrder) {
            return updateBay({ ...b, orderIndex: newOrder });
          }
          return Promise.resolve();
        })
      );
    } catch (e) {
      alert("Lỗi khi sắp xếp khoang: " + (e as Error).message);
    }
  };

  const handleOrderBlur = async (bay: Bay, value: string) => {
    if (!canManageOrder) return;
    const num = parseInt(value, 10);
    if (isNaN(num) || num === bay.orderIndex) return;
    try {
      await updateBay({ ...bay, orderIndex: num });
    } catch (e) {
      alert("Lỗi khi cập nhật thứ tự: " + (e as Error).message);
    }
  };

  return (
    <div>
      {isFormOpen && <BayFormModal bay={selectedBay} onSave={handleFormSave} onClose={() => setIsFormOpen(false)} />}
      {isConfirmOpen && bayToDelete && (
        <ConfirmationModal
          message={`Bạn có chắc muốn xóa khoang ${bayToDelete.name}?`}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span>🏢</span> Quản lý khoang sửa chữa
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {canManageOrder 
              ? 'Dùng nút ⬆️/⬇️ hoặc nhập số thứ tự để sắp xếp vị trí hiển thị trên Bảng tiến độ.' 
              : 'Danh sách các khoang sửa chữa trong xưởng.'}
          </p>
        </div>
        {canManageOrder && (
          <button onClick={handleAdd} className="bg-brand-blue hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl shadow-sm text-sm transition">
            + Thêm khoang
          </button>
        )}
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
              <th className="px-4 py-3 text-center w-28">Thứ tự</th>
              <th className="px-5 py-3 text-left">Tên khoang</th>
              <th className="px-5 py-3 text-left">Loại</th>
              <th className="px-5 py-3 text-left">KTV</th>
              <th className="px-5 py-3 text-center">Có cầu nâng</th>
              {canManageOrder && <th className="px-5 py-3 text-right">Hành động</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {state.bays.length === 0 ? (
              <tr>
                <td colSpan={canManageOrder ? 6 : 5} className="px-5 py-8 text-center text-gray-400 italic">
                  Chưa có khoang sửa chữa nào được thiết lập.
                </td>
              </tr>
            ) : (
              state.bays.map((bay, index) => (
                <tr key={bay.id} className="hover:bg-blue-50/20 transition-colors">
                  {/* Sắp xếp Thứ tự */}
                  <td className="px-3 py-3 text-center">
                    {canManageOrder ? (
                      <div className="flex items-center justify-center space-x-1.5">
                        <input
                          type="number"
                          defaultValue={bay.orderIndex !== undefined ? bay.orderIndex : index + 1}
                          key={`${bay.id}_${bay.orderIndex}`}
                          onBlur={(e) => handleOrderBlur(bay, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                          className="w-12 text-center text-xs font-extrabold border border-gray-300 rounded-lg py-1 px-1 focus:ring-2 focus:ring-brand-blue outline-none bg-gray-50"
                          title="Nhập số thứ tự và nhấn Enter"
                        />
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMove(index, 'up')}
                            className="p-1 text-[11px] rounded bg-gray-100 hover:bg-brand-blue hover:text-white disabled:opacity-30 disabled:hover:bg-gray-100 disabled:hover:text-inherit transition"
                            title="Di chuyển lên"
                          >
                            ⬆️
                          </button>
                          <button
                            type="button"
                            disabled={index === state.bays.length - 1}
                            onClick={() => handleMove(index, 'down')}
                            className="p-1 text-[11px] rounded bg-gray-100 hover:bg-brand-blue hover:text-white disabled:opacity-30 disabled:hover:bg-gray-100 disabled:hover:text-inherit transition"
                            title="Di chuyển xuống"
                          >
                            ⬇️
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-md text-xs">
                        #{bay.orderIndex !== undefined ? bay.orderIndex : index + 1}
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4 font-bold text-gray-900">{bay.name}</td>
                  <td className="px-5 py-4 text-gray-700">{bay.type}</td>
                  <td className="px-5 py-4 text-gray-700">{bay.technician || <span className="text-gray-400 italic">Chưa gán</span>}</td>
                  <td className="px-5 py-4 text-center">
                    {bay.supportsLift ? (
                      <span className="inline-block bg-green-100 text-green-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-green-200">
                        Có
                      </span>
                    ) : (
                      <span className="inline-block bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full">
                        Không
                      </span>
                    )}
                  </td>
                  {canManageOrder && (
                    <td className="px-5 py-4 text-right space-x-2">
                      <button onClick={() => handleEdit(bay)} className="text-brand-blue hover:text-blue-800 font-bold text-xs bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition">
                        Sửa
                      </button>
                      <button onClick={() => handleDeleteRequest(bay)} className="text-red-600 hover:text-red-800 font-bold text-xs bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition">
                        Xóa
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BayManagement;
