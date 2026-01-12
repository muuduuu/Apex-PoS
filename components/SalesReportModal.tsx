import React, { useState } from 'react';
import { X, Download, Calendar, FileSpreadsheet } from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface SalesReportModalProps {
  onClose: () => void;
}

export const SalesReportModal: React.FC<SalesReportModalProps> = ({ onClose }) => {
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  ); // Default: 7 days ago
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  ); // Default: today
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before end date');
      return;
    }

    try {
      setLoading(true);
      setError('');

      await apiClient.generateSalesReport(startDate, endDate);

      // Close modal after successful download
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate report';
      setError(message);
      console.error('Report generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Quick date range presets
  const setDateRange = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-7 h-7" />
            <div>
              <h2 className="text-2xl font-bold">Generate Sales Report</h2>
              <p className="text-blue-100 text-sm">Export sales data to Excel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Quick Presets */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Quick Date Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDateRange(7)}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors text-sm"
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setDateRange(30)}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors text-sm"
              >
                Last 30 Days
              </button>
              <button
                onClick={() => setDateRange(90)}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors text-sm"
              >
                Last 90 Days
              </button>
              <button
                onClick={() => {
                  const now = new Date();
                  const start = new Date(now.getFullYear(), now.getMonth(), 1);
                  setStartDate(start.toISOString().split('T')[0]);
                  setEndDate(now.toISOString().split('T')[0]);
                }}
                className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors text-sm"
              >
                This Month
              </button>
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Report Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Report Contents
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Sales Summary with totals and discounts</li>
              <li>• Detailed sale items breakdown</li>
              <li>• Payment method analysis</li>
              <li>• Cashier and contractor information</li>
            </ul>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-xl flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={loading || !startDate || !endDate}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
