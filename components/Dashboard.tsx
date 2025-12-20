import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { DailyReport, User, Item, AuditLog } from '../types';
import {
  BarChart,
  CreditCard,
  ShoppingBag,
  TrendingUp,
  Calendar,
  Download,
  Package,
  Activity,
  Plus,
  Trash2,
  X,
  Users as UsersIcon,
} from 'lucide-react';
import LogoImage from '../src/images/Apex Logo.png';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'audit' | 'users'>('overview');
  const [report, setReport] = useState<DailyReport | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inventory State
  const [items, setItems] = useState<Item[]>([]);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [newPrice, setNewPrice] = useState<string>('');
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    name_en: '',
    name_ar: '',
    price_per_unit: '',
  });
  const [itemLoading, setItemLoading] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);

  // Audit State
  const [logs, setLogs] = useState<AuditLog[]>([]);

  // Users State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'cashier' | 'admin'>('cashier');
  const [userLoading, setUserLoading] = useState(false);
  const [userSuccess, setUserSuccess] = useState('');

  const format3 = (v: any) => Number(v || 0).toFixed(3);
  const format2 = (v: any) => Number(v || 0).toFixed(2);

  // Fetch data based on active tab
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (activeTab === 'overview') {
          const data = await apiClient.getDailyReport(date);
          setReport(data);
        } else if (activeTab === 'inventory') {
          const itemsData = await apiClient.getItems();
          setItems(itemsData);
        } else if (activeTab === 'audit') {
          const logsData = await apiClient.getAuditLogs();
          setLogs(logsData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        console.error('Dashboard fetch error:', err);
      }
      setLoading(false);
    };
    fetchData();
  }, [date, activeTab]);

  const handleExport = async () => {
    try {
      setLoading(true);
      const sales = await apiClient.getDailySales(date);

      const headers = [
        'Sale No',
        'Date',
        'Time',
        'Cashier',
        'Status',
        'Total (KWD)',
        'Payment Method',
        'Reference',
        'Items',
      ];
      const rows = sales.map(s => [
        s.sale_number,
        new Date(s.sale_date).toLocaleDateString(),
        new Date(s.sale_date).toLocaleTimeString(),
        s.cashier_name,
        s.status,
        format3(s.total_amount),
        s.payment_method,
        s.knet_reference || s.cheque_number || '',
        s.items.map(i => `${i.item_name_en} (${i.quantity})`).join('; '),
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        headers.join(',') +
        '\n' +
        rows
          .map(e => e.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
          .join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `sales_report_${date}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export');
      console.error('Export error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePrice = async () => {
    if (!editingItem || !newPrice) return;

    try {
      setItemLoading(true);
      const result = await apiClient.updateItemPrice(editingItem.id, parseFloat(newPrice));

      setItems(items.map(item => (item.id === editingItem.id ? { ...item, price_per_unit: result.price_per_unit } : item)));

      setEditingItem(null);
      setNewPrice('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update price');
      console.error('Update price error:', err);
    } finally {
      setItemLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItemForm.name_en || !newItemForm.name_ar || !newItemForm.price_per_unit) {
      setError('All fields are required');
      return;
    }

    try {
      setItemLoading(true);
      const newItem = await apiClient.createItem({
        name_en: newItemForm.name_en,
        name_ar: newItemForm.name_ar,
        price_per_unit: parseFloat(newItemForm.price_per_unit),
      });

      setItems([...items, newItem]);
      setNewItemForm({ name_en: '', name_ar: '', price_per_unit: '' });
      setShowAddItemModal(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
      console.error('Add item error:', err);
    } finally {
      setItemLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    try {
      setItemLoading(true);
      setDeletingItemId(itemId);

      await apiClient.deleteItem(itemId);

      setItems(items.filter(item => item.id !== itemId));
      setDeletingItemId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
      console.error('Delete item error:', err);
      setDeletingItemId(null);
    } finally {
      setItemLoading(false);
    }
  };

  // Handle Create New User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUserSuccess('');

    if (!newUsername || !newPassword) {
      setError('Username and password are required');
      return;
    }

    try {
      setUserLoading(true);
      const createdUser = await apiClient.createUser(newUsername, newPassword, newRole);

      setUserSuccess(`✓ User "${createdUser.username}" created as ${createdUser.role}!`);
      setNewUsername('');
      setNewPassword('');
      setNewRole('cashier');

      // Clear success after 4 seconds
      setTimeout(() => setUserSuccess(''), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create user';
      setError(msg);
      console.error('Create user error:', err);
    } finally {
      setUserLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <img src={LogoImage} alt="Sabic Logo" className="h-14" />
          <div className="border-l border-slate-300 pl-4">
            <h1 className="text-xl font-bold text-slate-800 leading-none">Admin Dashboard</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-slate-500 font-medium">
                Apex Group International
              </span>
              <span className="text-xs text-slate-400">|</span>
              <span className="text-xs text-slate-500 font-medium">
                PH: +965 25456301
              </span>
              <span className="text-xs text-slate-400">|</span>
              <span className="text-xs text-slate-500 font-medium">
                info@apexgroup-intl.com
              </span>
            </div>
          </div>
        </div>

        {/* Nav Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'overview'
                ? 'bg-white shadow text-[#3c589e]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'inventory'
                ? 'bg-white shadow text-[#3c589e]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Inventory
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'users'
                ? 'bg-white shadow text-[#3c589e]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'audit'
                ? 'bg-white shadow text-[#3c589e]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Audit Logs
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onLogout}
            className="text-sm text-slate-500 hover:text-[#ff4033] font-medium px-4 py-2 hover:bg-red-50 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-8 py-3 flex justify-between items-center">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success Banner */}
      {userSuccess && (
        <div className="bg-green-50 border-b border-green-200 px-8 py-3 flex justify-between items-center">
          <p className="text-sm text-green-700 font-medium">{userSuccess}</p>
          <button onClick={() => setUserSuccess('')} className="text-green-600 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {activeTab === 'overview' ? (
          <>
            {/* Controls */}
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
                <Calendar className="w-4 h-4 text-slate-500 ml-2" />
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="outline-none text-sm text-slate-700 bg-transparent"
                />
              </div>
              <button
                onClick={handleExport}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-[#3c589e] text-white rounded-lg hover:bg-[#2f4377] shadow-sm transition-colors text-sm font-medium disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Export Report (CSV)
              </button>
            </div>

            {loading && !report ? (
              <div className="text-center py-12 text-slate-500">Loading dashboard...</div>
            ) : report ? (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-[#3c589e]/10 rounded-lg text-[#3c589e]">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                    </div>
                    <h3 className="text-slate-500 text-sm font-medium">Daily Revenue</h3>
                    <p className="text-3xl font-bold text-slate-800 mt-1">
                      {format3(report.total_revenue)}{' '}
                      <span className="text-sm font-normal text-slate-400">KWD</span>
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-[#3c589e]/10 rounded-lg text-[#3c589e]">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                    </div>
                    <h3 className="text-slate-500 text-sm font-medium">Sales Count</h3>
                    <p className="text-3xl font-bold text-slate-800 mt-1">
                      {report.total_sales_count}
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-[#3c589e]/10 rounded-lg text-[#3c589e]">
                        <CreditCard className="w-6 h-6" />
                      </div>
                    </div>
                    <h3 className="text-slate-500 text-sm font-medium">Average Ticket</h3>
                    <p className="text-3xl font-bold text-slate-800 mt-1">
                      {report.total_sales_count
                        ? format3(Number(report.total_revenue || 0) / report.total_sales_count)
                        : '0.000'}{' '}
                      <span className="text-sm font-normal text-slate-400">KWD</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Payment Methods */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">
                      Revenue by Payment Method
                    </h3>
                    <div className="space-y-4">
                      {report.sales_by_payment.map((item, idx) => {
                        const value = Number(item.value || 0);
                        const total = Number(report.total_revenue || 0);
                        const percentage = total > 0 ? (value / total) * 100 : 0;
                        return (
                          <div key={idx}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium text-slate-700">{item.name}</span>
                              <span className="text-slate-500">
                                {format3(value)} KWD ({percentage.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5">
                              <div
                                className="bg-[#3c589e] h-2.5 rounded-full"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top Items List */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Top Selling Items</h3>
                    <div className="overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="p-3 text-xs font-bold text-slate-500 uppercase rounded-l-lg">
                              Item
                            </th>
                            <th className="p-3 text-xs font-bold text-slate-500 uppercase text-right rounded-r-lg">
                              Qty Sold
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {report.top_items.map((item, idx) => (
                            <tr key={idx}>
                              <td className="p-3 text-sm font-medium text-slate-700">
                                {item.name}
                              </td>
                              <td className="p-3 text-sm text-right text-slate-600">
                                {format2(item.value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </>
        ) : activeTab === 'inventory' ? (
          /* INVENTORY TAB */
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-[#3c589e]" /> Item Management
              </h2>
              <button
                onClick={() => setShowAddItemModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#3c589e] text-white rounded-lg hover:bg-[#2f4377] shadow-sm transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-4 bg-yellow-50 p-3 rounded border border-yellow-200">
              You can add new items, update prices, or remove items. All changes are logged.
            </p>

            {loading && items.length === 0 ? (
              <div className="text-center py-8 text-slate-500">Loading inventory...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">ID</th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">
                        Name (EN)
                      </th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">
                        Name (AR)
                      </th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase text-right">
                        Price (KWD)
                      </th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase text-center">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-sm text-slate-400">#{item.id}</td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-800">
                          {item.name_en}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600 font-arabic">
                          {item.name_ar}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-800 text-right font-mono">
                          {format3(item.price_per_unit)}
                        </td>
                        <td className="py-3 px-4 text-center flex gap-2 justify-center">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setNewPrice(String(item.price_per_unit ?? ''));
                            }}
                            disabled={itemLoading}
                            className="text-[#3c589e] hover:text-[#2f4377] text-sm font-medium underline disabled:opacity-50"
                          >
                            Edit Price
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={itemLoading || deletingItemId === item.id}
                            className="text-[#ff4033] hover:text-[#e6362b] text-sm font-medium disabled:opacity-50"
                          >
                            {deletingItemId === item.id ? (
                              'Deleting...'
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'users' ? (
          /* USERS TAB */
          <div className="grid grid-cols-1 max-w-md mx-auto">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                <UsersIcon className="w-5 h-5 text-[#3c589e]" /> Create New User
              </h2>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#3c589e] focus:border-[#3c589e] outline-none"
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    placeholder="e.g., cashier1"
                    required
                    disabled={userLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#3c589e] focus:border-[#3c589e] outline-none"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter secure password"
                    required
                    disabled={userLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Role
                  </label>
                  <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#3c589e] focus:border-[#3c589e] outline-none"
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as 'cashier' | 'admin')}
                    disabled={userLoading}
                  >
                    <option value="cashier">Cashier</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={userLoading}
                  className="w-full bg-[#3c589e] hover:bg-[#2f4377] text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-60 transition-colors"
                >
                  {userLoading ? 'Creating User...' : 'Create User'}
                </button>
              </form>

              <div className="mt-6 p-4 bg-[#3c589e]/10 rounded-lg border border-[#3c589e]/20">
                <p className="text-xs text-[#3c589e]">
                  <strong>ℹ️ Tip:</strong> Create cashier accounts for POS operators. Each user gets
                  their own login credentials.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* AUDIT LOG TAB */
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-[#3c589e]" /> System Audit Logs
            </h2>
            {loading && logs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">Loading audit logs...</div>
            ) : (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200">
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">
                        Time
                      </th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">
                        User
                      </th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">
                        Action
                      </th>
                      <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-800">
                          {log.user_name}
                        </td>
                        <td className="py-3 px-4 text-xs font-bold text-slate-600 bg-slate-100 rounded inline-block my-2 mx-4">
                          {log.action}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Price Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm p-6 rounded-lg shadow-xl">
            <h3 className="text-lg font-bold mb-4">Edit Price: {editingItem.name_en}</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                New Price (KWD)
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                className="w-full p-2 border rounded-lg"
                value={newPrice}
                onChange={e => setNewPrice(e.target.value)}
                disabled={itemLoading}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditingItem(null);
                  setNewPrice('');
                }}
                disabled={itemLoading}
                className="flex-1 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePrice}
                disabled={itemLoading}
                className="flex-1 py-2 bg-[#3c589e] text-white rounded hover:bg-[#2f4377] disabled:opacity-50"
              >
                {itemLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm p-6 rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Add New Item</h3>
              <button
                onClick={() => setShowAddItemModal(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Item Name (English)
                </label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-lg"
                  value={newItemForm.name_en}
                  onChange={e =>
                    setNewItemForm({ ...newItemForm, name_en: e.target.value })
                  }
                  placeholder="e.g., Washed Sand"
                  disabled={itemLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Item Name (Arabic)
                </label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-lg text-right"
                  value={newItemForm.name_ar}
                  onChange={e =>
                    setNewItemForm({ ...newItemForm, name_ar: e.target.value })
                  }
                  placeholder="مثال: الرمل المغسول"
                  disabled={itemLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Price (KWD)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  className="w-full p-2 border rounded-lg"
                  value={newItemForm.price_per_unit}
                  onChange={e =>
                    setNewItemForm({
                      ...newItemForm,
                      price_per_unit: e.target.value,
                    })
                  }
                  placeholder="e.g., 15.500"
                  disabled={itemLoading}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddItemModal(false)}
                disabled={itemLoading}
                className="flex-1 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={itemLoading}
                className="flex-1 py-2 bg-[#3c589e] text-white rounded hover:bg-[#2f4377] disabled:opacity-50"
              >
                {itemLoading ? 'Creating...' : 'Create Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
