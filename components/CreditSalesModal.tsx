import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { Contractor, SaleItem } from '../types';
import { X, Plus, Search } from 'lucide-react';

interface CreditSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: SaleItem[];
  onSaleComplete: (sale: any) => void;
}

export const CreditSalesModal: React.FC<CreditSalesModalProps> = ({
  isOpen,
  onClose,
  items,
  onSaleComplete,
}) => {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);
  const [showNewContractorForm, setShowNewContractorForm] = useState(false);
  const [newContractorName, setNewContractorName] = useState('');
  const [newContractorPhone, setNewContractorPhone] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [discountValue, setDiscountValue] = useState('0');
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');

  useEffect(() => {
    if (isOpen) {
      fetchContractors();
    }
  }, [isOpen]);

  const fetchContractors = async () => {
    try {
      const data = await apiClient.getContractors();
      setContractors(data);
    } catch (err) {
      console.error('Error fetching contractors:', err);
    }
  };

  const handleAddContractor = async () => {
    if (!newContractorName.trim()) {
      setError('Contractor name required');
      return;
    }

    try {
      setLoading(true);
      const newContractor = await apiClient.createContractor({
        name: newContractorName,
        phone: newContractorPhone,
      });
      setContractors([...contractors, newContractor]);
      setSelectedContractor(newContractor);
      setNewContractorName('');
      setNewContractorPhone('');
      setShowNewContractorForm(false);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create contractor');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSale = async () => {
    if (!selectedContractor || items.length === 0) {
      setError('Select contractor and items');
      return;
    }

    try {
      setLoading(true);
      const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
      const discount = discountType === 'amount' ? parseFloat(discountValue) : (subtotal * parseFloat(discountValue)) / 100;
      const totalAmount = Math.max(0, subtotal - discount);

      const sale = await apiClient.createCreditSale({
        contractor_id: selectedContractor.id,
        items,
        subtotal,
        discount_amount: discount,
        discount_percentage: discountType === 'percent' ? parseFloat(discountValue) : 0,
        total_amount: totalAmount,
        notes: `Credit sale for ${selectedContractor.name}`,
      });

      onSaleComplete(sale);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create credit sale');
    } finally {
      setLoading(false);
    }
  };

  const filteredContractors = contractors.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
  const discount = discountType === 'amount' ? parseFloat(discountValue) : (subtotal * parseFloat(discountValue)) / 100;
  const total = Math.max(0, subtotal - discount);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl transform transition-all">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-slate-800">Credit Sale</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
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
          {!showNewContractorForm ? (
            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700">Select Contractor</label>
              
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search contractor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                {filteredContractors.map((contractor) => (
                  <button
                    key={contractor.id}
                    onClick={() => setSelectedContractor(contractor)}
                    className={`p-3 text-left rounded-lg border-2 transition-all ${
                      selectedContractor?.id === contractor.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="font-bold text-slate-800">{contractor.name}</div>
                    <div className="text-xs text-slate-500">
                      Balance: <span className="font-mono">{contractor.(Number(total_credits) || 0).toFixed(3)} KWD</span>
                      {' / Limit: '}
                      <span className="font-mono">{contractor.credit_limit.toFixed(3)} KWD</span>
                    </div>
                    {contractor.phone && <div className="text-xs text-slate-400">{contractor.phone}</div>}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowNewContractorForm(true)}
                className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add New Contractor
              </button>
            </div>
          ) : (
            <div className="space-y-3 bg-slate-50 p-4 rounded-lg">
              <label className="text-sm font-bold text-slate-700">New Contractor</label>
              <input
                type="text"
                placeholder="Full name"
                value={newContractorName}
                onChange={(e) => setNewContractorName(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="Phone number"
                value={newContractorPhone}
                onChange={(e) => setNewContractorPhone(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddContractor}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => setShowNewContractorForm(false)}
                  className="flex-1 bg-slate-300 text-slate-800 py-2 rounded-lg hover:bg-slate-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Discount */}
          {selectedContractor && (
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Discount</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="flex-1 p-2 border border-slate-300 rounded-lg"
                />
                <button
                  onClick={() => setDiscountType('amount')}
                  className={`px-3 py-2 rounded-lg text-sm font-bold ${
                    discountType === 'amount'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  KWD
                </button>
                <button
                  onClick={() => setDiscountType('percent')}
                  className={`px-3 py-2 rounded-lg text-sm font-bold ${
                    discountType === 'percent'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  %
                </button>
              </div>
            </div>
          )}

          {/* Summary */}
          {selectedContractor && (
            <div className="bg-slate-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-bold">{subtotal.toFixed(3)} KWD</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Discount:</span>
                <span>-{discount.toFixed(3)} KWD</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-bold">Total:</span>
                <span className="font-bold text-lg text-blue-600">{total.toFixed(3)} KWD</span>
              </div>
              <div className="border-t pt-2 text-xs text-slate-600">
                <div>Current Balance: <span className="font-mono">{selectedContractor.(Number(total_credits) || 0).toFixed(3)} KWD</span></div>
                <div>After Sale: <span className="font-mono font-bold">{(selectedContractor.total_credits + total).toFixed(3)} KWD</span></div>
              </div>
            </div>
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
            onClick={handleConfirmSale}
            disabled={!selectedContractor || loading}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-bold"
          >
            {loading ? 'Processing...' : 'Confirm Credit Sale'}
          </button>
        </div>
      </div>
    </div>
  );
};
