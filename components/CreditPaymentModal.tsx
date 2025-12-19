import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { Contractor } from '../types';
import { X, Search } from 'lucide-react';

interface CreditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentComplete: () => void;
}

export const CreditPaymentModal: React.FC<CreditPaymentModalProps> = ({
  isOpen,
  onClose,
  onPaymentComplete,
}) => {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'knet' | 'cheque'>('cash');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchContractors();
    }
  }, [isOpen]);

  const fetchContractors = async () => {
    try {
      const data = await apiClient.getContractors();
      // Filter contractors with outstanding credits
      setContractors(data.filter(c => c.total_credits > 0));
    } catch (err) {
      console.error('Error fetching contractors:', err);
    }
  };

  const handleProcessPayment = async () => {
    if (!selectedContractor || !amount) {
      setError('Select contractor and enter amount');
      return;
    }

    try {
      setLoading(true);
      await apiClient.processPayment(
        selectedContractor.id,
        parseFloat(amount),
        paymentMethod,
        description || `${paymentMethod} payment`
      );
      onPaymentComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const filteredContractors = contractors.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-slate-800">Receive Credit Payment</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-96 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Contractor Selection */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-700">Select Contractor</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search contractor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
              {filteredContractors.map((contractor) => (
                <button
                  key={contractor.id}
                  onClick={() => setSelectedContractor(contractor)}
                  className={`p-3 text-left rounded-lg border-2 transition-all ${
                    selectedContractor?.id === contractor.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-200 hover:border-green-300'
                  }`}
                >
                  <div className="font-bold text-slate-800">{contractor.name}</div>
                  <div className="text-xs text-slate-600">Outstanding: <span className="font-mono font-bold text-red-600">{(Number(contractor.total_credits) || 0).toFixed(3)} KWD</span></div>
                </button>
              ))}
            </div>
          </div>

          {selectedContractor && (
            <>
              {/* Payment Amount */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Payment Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.000"
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
                <div className="text-xs text-slate-500">
                  Outstanding: {(Number(selectedContractor.total_credits) || 0).toFixed(3)} KWD
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'knet', 'cheque'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                        paymentMethod === method
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-slate-200 text-slate-700 hover:border-green-300'
                      }`}
                    >
                      {method.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Payment notes..."
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  rows={2}
                />
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="border-t p-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border-2 border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-bold"
          >
            Cancel
          </button>
          <button
            onClick={handleProcessPayment}
            disabled={!selectedContractor || !amount || loading}
            className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-bold"
          >
            {loading ? 'Processing...' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};
