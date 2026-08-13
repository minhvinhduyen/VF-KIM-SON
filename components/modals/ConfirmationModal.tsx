import React from 'react';

interface ConfirmationModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ message, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-sm text-center">
        <h3 className="text-lg font-medium mb-4">Xác nhận</h3>
        <p className="mb-6">{message}</p>
        <div className="flex justify-center space-x-4">
          <button onClick={onCancel} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded">
            Hủy
          </button>
          <button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded">
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
