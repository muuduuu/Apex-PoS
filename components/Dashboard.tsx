import React, { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';
import { DailyReport, User, Item, AuditLog, Contractor } from '../types';
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
const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'contractors' | 'audit' | 'users'>('overview');
  const [report, setReport] = useState<DailyReport | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [contractors, setContractors] = useState<Contractor[]>([]);
const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);

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
  const [users, setUsers] = useState<User[]>([]);


  const format3 = (v: any) => Number(v || 0).toFixed(3);
  const format2 = (v: any) => Number(v || 0).toFixed(2);

  // Fetch data based on active tab
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
      } else if (activeTab === 'users') {
        // SKIP USERS FETCH - endpoint not ready
        setUsers([]);
        setLoading(false);
        return;
      }
      else if (activeTab === 'contractors') {
  const contractorsData = await apiClient.getContractors();
  setContractors(contractorsData);
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

    const handleCreateContractor = async (e: React.FormEvent) => {
      e.preventDefault();
    
      const formData = new FormData(e.target as HTMLFormElement);
      const name = formData.get('contractor_name') as string;
      const company = formData.get('company') as string;
      const phone = formData.get('phone') as string;
      const creditLimit = parseFloat(formData.get('credit_limit') as string);

      if (!name) {
        alert('Contractor name is required');
        return;
      }

      try {
        const newContractor = await apiClient.createContractor({
          name,
          company_name: company || '',
          phone: phone || '',
          credit_limit: creditLimit || 0,
          status: 'active',
        });
      
        setContractors([...contractors, newContractor]);
        setSelectedContractor(newContractor);
        alert('Contractor created successfully');
      
        // Reset form
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        alert('Failed to create contractor: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e8f4f8] via-slate-100 to-[#d4e9f7] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shadow-md sticky top-0 z-20 backdrop-blur-sm bg-white/95">
        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left duration-500">
          <img src={LogoImage} alt="Apex Logo" className="h-14 transition-transform hover:scale-105 duration-300" />
          <div className="border-l border-slate-300 pl-4">
            <h1 className="text-xl font-bold text-[#0b51a1] leading-none">Admin Dashboard</h1>
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
        <div className="flex bg-slate-100 p-1 rounded-lg shadow-inner">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-300 ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-[#0b51a1] to-[#26aae1] shadow-lg text-white transform scale-105'
                : 'text-slate-500 hover:text-[#0b51a1] hover:bg-white/50'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-300 ${
              activeTab === 'inventory'
                ? 'bg-gradient-to-r from-[#0b51a1] to-[#26aae1] shadow-lg text-white transform scale-105'
                : 'text-slate-500 hover:text-[#0b51a1] hover:bg-white/50'
            }`}
          >
            Inventory
          </button>
          <button
  onClick={() => setActiveTab('contractors')}
  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-300 ${
    activeTab === 'contractors'
      ? 'bg-gradient-to-r from-[#0b51a1] to-[#26aae1] shadow-lg text-white transform scale-105'
      : 'text-slate-500 hover:text-[#0b51a1] hover:bg-white/50'
  }`}
>
  Contractors
</button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-300 ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-[#0b51a1] to-[#26aae1] shadow-lg text-white transform scale-105'
                : 'text-slate-500 hover:text-[#0b51a1] hover:bg-white/50'
            }`}
          >
            Users
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-300 ${
              activeTab === 'audit'
                ? 'bg-gradient-to-r from-[#0b51a1] to-[#26aae1] shadow-lg text-white transform scale-105'
                : 'text-slate-500 hover:text-[#0b51a1] hover:bg-white/50'
            }`}
          >
            Audit Logs
          </button>

        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onLogout}
            className="text-sm text-slate-500 hover:text-[#ff6b35] font-medium px-4 py-2 hover:bg-red-50 rounded-lg transition-all duration-300 hover:shadow-md transform hover:scale-105"
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
              <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm p-2 rounded-lg border shadow-sm">
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
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#0b51a1] to-[#26aae1] text-white rounded-lg hover:shadow-lg transition-all duration-300 text-sm font-medium disabled:opacity-50 transform hover:scale-105 hover:-translate-y-0.5"
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
                  <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-105 animate-in fade-in slide-in-from-bottom duration-500">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-gradient-to-br from-[#0b51a1] to-[#26aae1] rounded-xl text-white shadow-md">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                    </div>
                    <h3 className="text-slate-500 text-sm font-medium">Daily Revenue</h3>
                    <p className="text-3xl font-bold bg-gradient-to-r from-[#0b51a1] to-[#26aae1] bg-clip-text text-transparent mt-1">
                      {format3(report.total_revenue)}{' '}
                      <span className="text-sm font-normal text-slate-400">KWD</span>
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-105 animate-in fade-in slide-in-from-bottom duration-700">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-gradient-to-br from-[#26aae1] to-[#0b51a1] rounded-xl text-white shadow-md">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                    </div>
                    <h3 className="text-slate-500 text-sm font-medium">Sales Count</h3>
                    <p className="text-3xl font-bold text-[#0b51a1] mt-1">
                      {report.total_sales_count}
                    </p>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-105 animate-in fade-in slide-in-from-bottom duration-1000">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-gradient-to-br from-[#ff6b35] to-[#ff8c61] rounded-xl text-white shadow-md">
                        <CreditCard className="w-6 h-6" />
                      </div>
                    </div>
                    <h3 className="text-slate-500 text-sm font-medium">Average Ticket</h3>
                    <p className="text-3xl font-bold text-[#ff6b35] mt-1">
                      {report.total_sales_count
                        ? format3(Number(report.total_revenue || 0) / report.total_sales_count)
                        : '0.000'}{' '}
                      <span className="text-sm font-normal text-slate-400">KWD</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Payment Methods */}
                  <div className="bg-gradient-to-br from-white to-[#e8f4f8] p-6 rounded-xl shadow-lg border border-[#26aae1]/20">
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
                            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-[#0b51a1] to-[#26aae1] h-2.5 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top Items List */}
                  <div className="bg-gradient-to-br from-white to-[#e8f4f8] p-6 rounded-xl shadow-lg border border-[#26aae1]/20">
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
          <div className="bg-gradient-to-br from-white to-[#e8f4f8] p-6 rounded-xl shadow-lg border border-[#26aae1]/20 animate-in fade-in slide-in-from-right duration-500">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-[#0b51a1] flex items-center gap-2">
                <Package className="w-5 h-5 text-[#26aae1]" /> Item Management
              </h2>
              <button
                onClick={() => setShowAddItemModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] text-white rounded-lg hover:shadow-lg transition-all duration-300 text-sm font-medium transform hover:scale-105 hover:-translate-y-0.5"
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
                            className="text-[#0b51a1] hover:text-[#26aae1] text-sm font-medium underline disabled:opacity-50 transition-all duration-200 hover:scale-110"
                          >
                            Edit Price
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={itemLoading || deletingItemId === item.id}
                            className="text-[#ff6b35] hover:text-[#ff4033] text-sm font-medium disabled:opacity-50 transition-all duration-200 hover:scale-110"
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
  <div className="animate-in fade-in slide-in-from-bottom duration-500">
    {/* Create User Form */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="lg:max-w-md">
        <div className="bg-gradient-to-br from-white to-[#e8f4f8] p-6 rounded-xl shadow-lg border border-[#26aae1]/20">
          <h2 className="text-lg font-bold text-[#0b51a1] flex items-center gap-2 mb-6">
            <UsersIcon className="w-5 h-5 text-[#26aae1]" /> Create New User
          </h2>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Username
              </label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#26aae1] focus:border-[#0b51a1] outline-none transition-all duration-200"
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
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#26aae1] focus:border-[#0b51a1] outline-none transition-all duration-200"
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
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#26aae1] focus:border-[#0b51a1] outline-none transition-all duration-200"
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
              className="w-full bg-gradient-to-r from-[#0b51a1] to-[#26aae1] hover:shadow-lg text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-60 transition-all duration-300 transform hover:scale-105"
            >
              {userLoading ? 'Creating User...' : 'Create User'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-gradient-to-r from-[#0b51a1]/10 to-[#26aae1]/10 rounded-lg border border-[#26aae1]/20">
            <p className="text-xs text-[#0b51a1]">
              <strong>ℹ️ Tip:</strong> Create cashier accounts for POS operators.
            </p>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-gradient-to-br from-white to-[#e8f4f8] p-6 rounded-xl shadow-lg border border-[#26aae1]/20">
        <h2 className="text-lg font-bold text-[#0b51a1] flex items-center gap-2 mb-6">
          <UsersIcon className="w-5 h-5 text-[#26aae1]" /> All Users ({users.length})
        </h2>
        
        {userLoading && users.length === 0 ? (
          <div className="text-center py-8 text-slate-500">Loading users...</div>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Username</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Role</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Created</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 text-sm font-medium text-slate-800">
                      {user.username}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.role === 'admin' 
                          ? 'bg-[#0b51a1]/10 text-[#0b51a1] border border-[#0b51a1]/30' 
                          : 'bg-green-100 text-green-800 border border-green-200'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 font-mono">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  </div>
        ) : activeTab === 'contractors' ? (
  /* CONTRACTORS TAB */
  <div className="animate-in fade-in slide-in-from-right duration-500">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      {/* CREATE CONTRACTOR FORM */}
      <div className="lg:max-w-md">
        <div className="bg-gradient-to-br from-white to-[#e8f4f8] p-6 rounded-xl shadow-lg border border-[#26aae1]/20">
          <h2 className="text-lg font-bold text-[#0b51a1] flex items-center gap-2 mb-6">
            <UsersIcon className="w-5 h-5 text-[#26aae1]" /> Add Contractor
          </h2>
          
          
      <form onSubmit={handleCreateContractor} className="space-y-4">
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Contractor Name *</label>
    <input
      type="text"
      name="contractor_name"
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#26aae1]"
      placeholder="e.g., Ahmed Al-Mansoori"
      required
    />
  </div>
  
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
    <input 
      type="text" 
      name="company"
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#26aae1]" 
    />
  </div>
  
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
    <input 
      type="tel" 
      name="phone"
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#26aae1]" 
    />
  </div>
  
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Credit Limit (KWD)</label>
    <input
      type="number"
      name="credit_limit"
      step="0.01"
      min="0"
      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#26aae1]"
      placeholder="10000"
    />
  </div>
  
  <button
    type="submit"
    className="w-full bg-gradient-to-r from-[#0b51a1] to-[#26aae1] text-white py-2.5 rounded-lg hover:shadow-lg"
  >
    Create Contractor
  </button>
</form>

        </div>
      </div>
        
      {/* CONTRACTORS LIST + DETAILS */}
      <div>
        <div className="bg-gradient-to-br from-white to-[#e8f4f8] p-6 rounded-xl shadow-lg border border-[#26aae1]/20 mb-6">
          <h2 className="text-lg font-bold text-[#0b51a1] mb-6">
            Contractors ({contractors.length})
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-3 px-4 text-xs font-bold text-slate-500">Name</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500">Phone</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 text-right">Credit Limit</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contractors.map(contractor => (
                  <tr 
                    key={contractor.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => setSelectedContractor(contractor)}
                  >
                    <td className="py-3 px-4 font-medium">{contractor.name}</td>
                    <td className="py-3 px-4">{contractor.phone}</td>
                    <td className="py-3 px-4 text-right font-mono text-green-600 font-bold">
                      {format2(contractor.credit_limit)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-red-600 font-bold">
                      {format2(contractor.total_credits)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        contractor.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {contractor.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SELECTED CONTRACTOR DETAILS */}
        {selectedContractor && (
          <div className="bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-xl shadow-lg border border-red-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{selectedContractor.name}</h3>
                <p className="text-sm text-slate-500">{selectedContractor.company_name}</p>
              </div>
              <button 
                onClick={() => setSelectedContractor(null)}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600">Phone:</span>
                  <span className="font-medium">{selectedContractor.phone}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600">Email:</span>
                  <span>{selectedContractor.email}</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600">Credit Limit:</span>
                  <span className="font-bold text-green-600">{format2(selectedContractor.credit_limit)} KWD</span>
                </div>
                <div className="flex justify-between mb-4">
                  <span className="text-slate-600">Outstanding:</span>
                  <span className="font-bold text-red-600">{format2(selectedContractor.total_credits)} KWD</span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-200">
              <h4 className="font-bold text-slate-800 mb-2">Credit History (Last 10)</h4>
              {/* Add credit history table here */}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
        
      </div>
    </div>
  </div> ) : (
          /* AUDIT LOG TAB */
          <div className="bg-gradient-to-br from-white to-[#e8f4f8] p-6 rounded-xl shadow-lg border border-[#26aae1]/20 animate-in fade-in slide-in-from-left duration-500">
            <h2 className="text-lg font-bold text-[#0b51a1] flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-[#26aae1]" /> System Audit Logs
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
                className="flex-1 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 transition-all duration-200 hover:shadow-md"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePrice}
                disabled={itemLoading}
                className="flex-1 py-2 bg-gradient-to-r from-[#0b51a1] to-[#26aae1] text-white rounded hover:shadow-lg disabled:opacity-50 transition-all duration-300 transform hover:scale-105"
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
                className="flex-1 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 transition-all duration-200 hover:shadow-md"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={itemLoading}
                className="flex-1 py-2 bg-gradient-to-r from-[#ff6b35] to-[#ff8c61] text-white rounded hover:shadow-lg disabled:opacity-50 transition-all duration-300 transform hover:scale-105"
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
