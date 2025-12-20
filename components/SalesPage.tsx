import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/apiClient';
import { Item, SaleItem, PaymentMethod, User, Sale, Refund } from '../types';
import { ReceiptModal } from './ReceiptModal';
import {
  ShoppingCart,
  Trash2,
  Plus,
  CreditCard,
  Banknote,
  FileText,
  Eraser,
  RotateCcw,
  XCircle,
  Search,
  AlertCircle,
  History,
  Wallet,
  Calendar,
} from 'lucide-react';
import ChequeIcon from '../src/images/iconamoon--cheque.svg';
import CashIcon from '../src/images/tabler--cash-banknote.svg';
import CreditCardIcon from '../src/images/material-symbols-light--credit-card-outline.svg';
import LogoImage from '../src/images/apex logo.png';

interface SalesPageProps {
  user: User;
  onLogout: () => void;
}

export const SalesPage: React.FC<SalesPageProps> = ({ user, onLogout }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [recentSales, setRecentSales] = useState<Sale[]>([]);

  // Cart State
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [qtyInput, setQtyInput] = useState<string>('1');

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [knetRef, setKnetRef] = useState('');
  const [chequeNum, setChequeNum] = useState('');
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('percent'); // default %
  const [discountValue, setDiscountValue] = useState<string>('0');

  // Sale Completion State
  const [processing, setProcessing] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [completedRefund, setCompletedRefund] = useState<Refund | null>(null);
  const [selectedHistorySale, setSelectedHistorySale] = useState<Sale | null>(null);


  // Refund State
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundSaleIdInput, setRefundSaleIdInput] = useState('');
  const [refundSaleData, setRefundSaleData] = useState<Sale | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundSearching, setRefundSearching] = useState(false);
  const [refundError, setRefundError] = useState<string>('');

  // Sales History State
  const [showSalesHistory, setShowSalesHistory] = useState(false);

  // Fetch items on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const itemsData = await db.getItems();
        setItems(itemsData.filter(i => i.active !== false));

        const salesData = await db.getSales();
        setRecentSales(salesData.slice(-10).reverse());
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load data';
        setError(message);
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAddItem = () => {
    if (!selectedItemId) return;

    const item = items.find(i => i.id === parseInt(selectedItemId));
    const qty = parseFloat(qtyInput);

    if (item && qty > 0) {
      const existingItemIndex = cart.findIndex(i => i.item_id === item.id);

      if (existingItemIndex >= 0) {
        const newCart = [...cart];
        newCart[existingItemIndex].quantity += qty;
        newCart[existingItemIndex].line_total =
          newCart[existingItemIndex].quantity * newCart[existingItemIndex].unit_price;
        setCart(newCart);
      } else {
        setCart([
          ...cart,
          {
            item_id: item.id,
            item_name_en: item.name_en,
            item_name_ar: item.name_ar,
            quantity: qty,
            unit_price: Number(item.price_per_unit),
            line_total: qty * Number(item.price_per_unit),
          },
        ]);
      }
      setSelectedItemId('');
      setQtyInput('1');
    }
  };

  const handleQuickSelect = (item: Item) => {
    setSelectedItemId(item.id.toString());
    const qtyInputEl = document.getElementById('qtyInput');
    if (qtyInputEl) qtyInputEl.focus();
  };

  const updateCartItemQty = (index: number, newQty: number) => {
    if (newQty < 0) return;
    const newCart = [...cart];
    newCart[index].quantity = newQty;
    newCart[index].line_total = newQty * newCart[index].unit_price;
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const clearCart = () => {
    if (window.confirm('Are you sure you want to clear the cart? / هل أنت متأكد من مسح السلة؟')) {
      setCart([]);
      setDiscountValue('0');
      setKnetRef('');
      setChequeNum('');
      setPaymentMethod(null);
      setError('');
    }
  };

  // Calculations
  const subtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.line_total, 0),
    [cart],
  );

  const discountCalc = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    if (discountType === 'amount') {
      return { amount: Math.min(Math.max(val, 0), subtotal), percent: 0 };
    } else {
      const amount = (subtotal * Math.min(Math.max(val, 0), 100)) / 100;
      return { amount, percent: val };
    }
  }, [subtotal, discountValue, discountType]);

  const totalAmount = Math.max(0, subtotal - discountCalc.amount);

  // Validation
  const isKnetInvalid = paymentMethod === 'knet' && !knetRef.trim();
  const isChequeInvalid = paymentMethod === 'cheque' && !chequeNum.trim();
  const isPaymentSelected = paymentMethod !== null;
  const isCartEmpty = cart.length === 0;
  const canSubmit =
    !isCartEmpty && !isKnetInvalid && !isChequeInvalid && isPaymentSelected && !processing;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setProcessing(true);
    setError('');

    try {
      const sale = await db.createSale({
        items: cart,
        subtotal,
        discount_amount: discountCalc.amount,
        discount_percentage: discountCalc.percent,
        total_amount: totalAmount,
        payment_method: paymentMethod!,
        knet_reference: paymentMethod === 'knet' ? knetRef : undefined,
        cheque_number: paymentMethod === 'cheque' ? chequeNum : undefined,
        notes: '',
      });

      setCompletedSale(sale);
      setRecentSales([sale, ...recentSales].slice(0, 10));

      setCart([]);
      setKnetRef('');
      setChequeNum('');
      setDiscountValue('0');
      setPaymentMethod(null);
      setSelectedItemId('');
      setQtyInput('1');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process sale';
      setError(message);
      console.error('Sale creation error:', err);
      alert('Error: ' + message);
    } finally {
      setProcessing(false);
    }
  };

  // Refund Handlers
  const handleSearchSaleForRefund = async () => {
    if (!refundSaleIdInput.trim()) return;

    setRefundSearching(true);
    setRefundError('');

    try {
      const sale = await db.getSaleByNumber(refundSaleIdInput.trim());
      if (sale) {
        setRefundSaleData(sale);
      } else {
        setRefundError('Sale not found / لم يتم العثور على الفاتورة');
        setRefundSaleData(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error searching for sale';
      setRefundError(message);
      setRefundSaleData(null);
    } finally {
      setRefundSearching(false);
    }
  };

  const handleProcessRefund = async () => {
    if (!refundSaleData || !refundReason.trim()) return;

    const confirmMsg = `Process full refund of ${Number(
      refundSaleData.total_amount,
    ).toFixed(3)} KWD for Sale ${refundSaleData.sale_number}? / هل تريد تنفيذ استرجاع كامل بمبلغ ${
      refundSaleData.total_amount
    } دينار لفاتورة ${refundSaleData.sale_number}؟`;
    if (!confirm(confirmMsg)) return;

    setProcessing(true);
    setRefundError('');

    try {
      const refund = await db.createRefund(
        refundSaleData.id,
        Number(refundSaleData.total_amount),
        refundReason.trim(),
      );

      setCompletedRefund(refund);
      setShowRefundModal(false);
      setRefundSaleData(null);
      setRefundSaleIdInput('');
      setRefundReason('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process refund';
      setRefundError(message);
      console.error('Refund error:', err);
      alert('Error: ' + message);
    } finally {
      setProcessing(false);
    }
  };

  const closeRefundModal = () => {
    setShowRefundModal(false);
    setRefundSaleData(null);
    setRefundSaleIdInput('');
    setRefundReason('');
    setRefundError('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3d579f]"></div>
          <p className="text-slate-600 font-medium">
            Loading items... / جارٍ تحميل المنتجات...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:h-screen bg-slate-100 min-h-screen">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm z-10 shrink-0 sticky top-0">
        <div className="flex items-center gap-4">
          <img src={LogoImage} alt="Logo" className="h-12" />
          <div className="border-l border-slate-300 pl-4">
            <h1 className="text-xl font-bold text-slate-800 leading-none">
              POS Terminal / نقطة بيع
            </h1>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-xs text-slate-500 font-medium">
                Cashier: {user.name} / الكاشير: {user.name}
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSalesHistory(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#3d579f] text-white rounded-lg hover:bg-[#2f4377] text-sm font-medium transition-colors shadow-sm"
          >
            <History className="w-4 h-4" />
            <span className="hidden md:inline">Sales History / سجل المبيعات</span>
          </button>
          <button
            onClick={() => setShowRefundModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#ff4033] text-white rounded-lg hover:bg-[#e6362b] text-sm font-medium transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden md:inline">Refund / استرجاع</span>
          </button>
          <button
            onClick={onLogout}
            className="text-sm text-slate-500 hover:text-[#ff4033] font-medium ml-4 transition-colors"
          >
            Logout / تسجيل الخروج
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-700">
            {error} / حدث خطأ: {error}
          </span>
          <button onClick={() => setError('')} className="ml-auto text-red-600 hover:text-red-800">
            ×
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left Column */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 lg:p-6 gap-6">
          {/* Quick Select Grid */}
          <div className="shrink-0">
            <h2 className="text-sm font-bold text-slate-600 mb-3 uppercase tracking-wide">
              Quick Select Product / اختيار سريع للمنتج
            </h2>
            {items.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                No active items available. Please contact administrator. / لا توجد منتجات
                مفعّلة، يرجى التواصل مع المسؤول.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleQuickSelect(item)}
                    className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group ${
                      selectedItemId === item.id.toString()
                        ? 'bg-[#3d579f] border-[#3d579f] text-white shadow-md ring-2 ring-[#5a70b5]'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-[#3d579f] hover:shadow-sm'
                    }`}
                  >
                    <div className="font-bold text-lg mb-1">{item.name_en}</div>
                    <div
                      className={`text-sm mb-2 font-arabic ${
                        selectedItemId === item.id.toString()
                          ? 'text-white/90'
                          : 'text-slate-500'
                      }`}
                    >
                      {item.name_ar}
                    </div>
                    <div
                      className={`font-mono font-medium ${
                        selectedItemId === item.id.toString()
                          ? 'text-white'
                          : 'text-[#3d579f]'
                      }`}
                    >
                      {Number(item.price_per_unit).toFixed(3)} KWD / د.ك
                    </div>
                    {selectedItemId === item.id.toString() && (
                      <div className="absolute top-2 right-2 w-3 h-3 bg-white rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add Item Controls */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 shrink-0">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                  Selected Item / المنتج المختار
                </label>
                <select
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#3d579f] outline-none bg-slate-50"
                  value={selectedItemId}
                  onChange={e => setSelectedItemId(e.target.value)}
                >
                  <option value="">-- Select Product / اختر منتج --</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name_en} - {Number(item.price_per_unit).toFixed(3)} KWD / د.ك
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full md:w-40">
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
                  Quantity (CBM) / الكمية (م³)
                </label>
                <input
                  id="qtyInput"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#3d579f] outline-none text-center font-bold text-lg"
                  value={qtyInput}
                  onChange={e => setQtyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                />
              </div>
              <button
                onClick={handleAddItem}
                disabled={!selectedItemId}
                className="w-full md:w-auto bg-[#3d579f] text-white px-8 py-3 rounded-lg hover:bg-[#2f4377] disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Plus className="w-5 h-5" />
                Add to Cart / أضف إلى السلة
              </button>
            </div>
          </div>

          {/* Shopping Cart Table */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[300px]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-slate-600" />
                Current Order / الطلب الحالي
              </h2>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-600 bg-white px-3 py-1 rounded border">
                  {cart.length} items / عنصر
                </span>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-xs text-[#ff4033] hover:text-[#e6362b] flex items-center gap-1 font-medium px-2 py-1 rounded hover:bg-red-50"
                  >
                    <Eraser className="w-3 h-3" />
                    Clear Cart / مسح السلة
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-white">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                  <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
                  <p className="italic">
                    Cart is empty. Select items to begin. / السلة فارغة، اختر المنتجات للبدء.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">
                        Product / المنتج
                      </th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase text-center w-32">
                        Qty (CBM) / الكمية (م³)
                      </th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">
                        Unit Price / سعر الوحدة
                      </th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">
                        Line Total / الإجمالي
                      </th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-800">{item.item_name_en}</div>
                          <div className="text-xs text-slate-500 font-arabic">
                            {item.item_name_ar}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="w-24 p-2 border border-slate-300 rounded text-center focus:ring-2 focus:ring-[#3d579f] outline-none font-medium bg-white"
                            value={item.quantity}
                            onChange={e =>
                              updateCartItemQty(idx, parseFloat(e.target.value) || 0)
                            }
                          />
                        </td>
                        <td className="p-4 text-right text-slate-600 font-mono">
                          {Number(item.unit_price).toFixed(3)} KWD / د.ك
                        </td>
                        <td className="p-4 text-right font-bold text-slate-800 font-mono">
                          {Number(item.line_total).toFixed(3)} KWD / د.ك
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => removeFromCart(idx)}
                            className="text-slate-400 hover:text-[#ff4033] transition-colors p-2 rounded-full hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
                <span className="text-sm text-slate-500 mr-2">
                  Subtotal / المجموع الفرعي:
                </span>
                <span className="text-lg font-bold text-slate-800">
                  {subtotal.toFixed(3)} KWD / د.ك
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Payment & Totals */}
        <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col h-auto lg:h-full overflow-y-auto shrink-0 shadow-xl lg:shadow-none z-20">
          <div className="p-6 flex flex-col h-full">
            <h2 className="text-lg font-bold text-slate-800 mb-6 pb-4 border-b flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-slate-600" />
              Payment Details / تفاصيل الدفع
            </h2>

            {/* Calculations */}
            <div className="space-y-4 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex justify-between text-slate-600 text-sm">
                <span>Subtotal / المجموع الفرعي</span>
                <span className="font-mono font-medium">
                  {subtotal.toFixed(3)} KWD / د.ك
                </span>
              </div>

              {/* Discount */}
              <div>
                <label className="text-xs text-slate-500 block mb-1 font-bold">
                  DISCOUNT / الخصم
                </label>
                <div className="flex gap-2 items-center">
                  <div className="flex border border-slate-300 rounded-lg overflow-hidden bg-white flex-1">
                    <input
                      type="number"
                      min="0"
                      className="w-full p-2 outline-none text-sm text-center"
                      value={discountValue}
                      onChange={e => setDiscountValue(e.target.value)}
                    />
                    <div className="flex border-l">
                      <button
                        onClick={() => setDiscountType('amount')}
                        className={`px-3 text-xs font-bold transition-colors ${
                          discountType === 'amount'
                            ? 'bg-[#3d579f] text-white'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        KWD / د.ك
                      </button>
                      <button
                        onClick={() => setDiscountType('percent')}
                        className={`px-3 text-xs font-bold transition-colors ${
                          discountType === 'percent'
                            ? 'bg-[#3d579f] text-white'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        %
                      </button>
                    </div>
                  </div>
                  <div className="text-right w-24">
                    <span className="text-[#ff4033] font-mono font-medium text-sm">
                      - {discountCalc.amount.toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-between items-end">
                <span className="text-lg font-bold text-slate-800">
                  TOTAL DUE / المبلغ المستحق
                </span>
                <span className="text-3xl font-extrabold text-[#3d579f] leading-none">
                  {totalAmount.toFixed(3)}{' '}
                  <span className="text-sm text-slate-500 font-normal">
                    KWD / د.ك
                  </span>
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-4 mb-8 flex-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Select Payment Method / اختر طريقة الدفع{' '}
                <span className="text-[#ff4033]">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'cash', label: 'Cash / نقداً', icon: 'custom-cash' },
                  { id: 'knet', label: 'KNET / كي نت', icon: 'custom-card' },
                  { id: 'cheque', label: 'Cheque / شيك', icon: 'custom-cheque' },
                  { id: 'credit', label: 'Credit / أجل', icon: 'custom-card' },
                ].map(method => {
                  const isSelected = paymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all relative ${
                        isSelected
                          ? 'border-[#3d579f] bg-[#3d579f]/10 text-[#3d579f] shadow-sm'
                          : 'border-slate-100 bg-white hover:border-[#3d579f]/30 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {method.icon === 'custom-cash' ? (
                        <img 
                          src={CashIcon} 
                          alt="Cash" 
                          className={`w-6 h-6 mb-2 ${
                            isSelected ? 'brightness-0 saturate-100' : 'opacity-60'
                          }`}
                          style={isSelected ? { filter: 'invert(32%) sepia(34%) saturate(1294%) hue-rotate(197deg) brightness(91%) contrast(91%)' } : {}}
                        />
                      ) : method.icon === 'custom-card' ? (
                        <img 
                          src={CreditCardIcon} 
                          alt="Card" 
                          className={`w-6 h-6 mb-2 ${
                            isSelected ? 'brightness-0 saturate-100' : 'opacity-60'
                          }`}
                          style={isSelected ? { filter: 'invert(32%) sepia(34%) saturate(1294%) hue-rotate(197deg) brightness(91%) contrast(91%)' } : {}}
                        />
                      ) : method.icon === 'custom-cheque' ? (
                        <img 
                          src={ChequeIcon} 
                          alt="Cheque" 
                          className={`w-6 h-6 mb-2 ${
                            isSelected ? 'brightness-0 saturate-100' : 'opacity-60'
                          }`}
                          style={isSelected ? { filter: 'invert(32%) sepia(34%) saturate(1294%) hue-rotate(197deg) brightness(91%) contrast(91%)' } : {}}
                        />
                      ) : (
                        React.createElement(method.icon as any, {
                          className: `w-6 h-6 mb-2 ${
                            isSelected ? 'text-[#3d579f]' : 'text-slate-400'
                          }`
                        })
                      )}
                      <span className="text-sm font-bold">{method.label}</span>
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-2 h-2 bg-[#3d579f] rounded-full"></div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Inputs based on Method */}
              {paymentMethod === 'knet' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200 bg-[#3d579f]/10 p-4 rounded-xl border border-[#3d579f]/20 shadow-sm">
                  <label className="block text-xs font-bold text-[#3d579f] mb-1 uppercase">
                    KNET Reference Number / رقم مرجع كي نت{' '}
                    <span className="text-[#ff4033]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter reference number / أدخل رقم المرجع"
                    className={`w-full p-3 border rounded-lg outline-none focus:ring-2 font-mono ${
                      !knetRef
                        ? 'border-[#ff4033]/30 focus:ring-[#ff4033]/20 bg-white'
                        : 'border-[#3d579f]/30 focus:ring-[#3d579f]/20 bg-white'
                    }`}
                    value={knetRef}
                    onChange={e => setKnetRef(e.target.value)}
                    autoFocus
                  />
                  {!knetRef && (
                    <p className="text-xs text-[#ff4033] mt-1 font-medium">
                      Reference is mandatory. / رقم المرجع إجباري.
                    </p>
                  )}
                </div>
              )}

              {paymentMethod === 'cheque' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                    Cheque Number / رقم الشيك <span className="text-[#ff4033]">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter cheque number / أدخل رقم الشيك"
                    className={`w-full p-3 border rounded-lg outline-none focus:ring-2 font-mono ${
                      !chequeNum
                        ? 'border-[#ff4033]/30 focus:ring-[#ff4033]/20 bg-white'
                        : 'border-slate-300 focus:ring-[#3d579f]/20 bg-white'
                    }`}
                    value={chequeNum}
                    onChange={e => setChequeNum(e.target.value)}
                  />
                  {!chequeNum && (
                    <p className="text-xs text-[#ff4033] mt-1 font-medium">
                      Cheque number is mandatory. / رقم الشيك إجباري.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Complete Sale Button */}
            <div className="mt-auto pt-4 border-t border-slate-100">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 ${
                  !canSubmit
                    ? 'bg-slate-300 cursor-not-allowed shadow-none'
                    : 'bg-[#3d579f] hover:bg-[#2f4377] hover:shadow-[#3d579f]/20 shadow-[#3d579f]/10'
                }`}
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing... / جارٍ المعالجة...
                  </>
                ) : (
                  <>
                    Complete Sale / إنهاء البيع{' '}
                    <span className="bg-[#2f4377] px-2 py-0.5 rounded text-sm">
                      {totalAmount.toFixed(3)} KWD / د.ك
                    </span>
                  </>
                )}
              </button>

              <div className="mt-3 text-center min-h-[1.5rem]">
                {isCartEmpty && (
                  <p className="text-xs text-slate-400">
                    Cart is empty. / السلة فارغة.
                  </p>
                )}
                {!isCartEmpty && !isPaymentSelected && (
                  <p className="text-xs text-[#ff4033] font-medium animate-pulse">
                    Select a payment method. / اختر طريقة الدفع.
                  </p>
                )}
                {!isCartEmpty && isKnetInvalid && (
                  <p className="text-xs text-[#ff4033] font-medium">
                    KNET reference required. / رقم مرجع كي نت مطلوب.
                  </p>
                )}
                {!isCartEmpty && isChequeInvalid && (
                  <p className="text-xs text-[#ff4033] font-medium">
                    Cheque number required. / رقم الشيك مطلوب.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receipts */}
      {completedSale && (
        <ReceiptModal sale={completedSale} onClose={() => setCompletedSale(null)} />
      )}

      {completedRefund && (
        <ReceiptModal refund={completedRefund} onClose={() => setCompletedRefund(null)} />
      )}
    {selectedHistorySale && (
        <ReceiptModal
          sale={selectedHistorySale}
          onClose={() => setSelectedHistorySale(null)}
        />
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg p-6 rounded-2xl shadow-2xl transform transition-all scale-100">
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
              <div className="flex items-center gap-2">
                <div className="bg-[#ff4033]/10 p-2 rounded-full">
                  <RotateCcw className="w-5 h-5 text-[#ff4033]" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">
                  Process Refund / تنفيذ استرجاع
                </h2>
              </div>
              <button
                onClick={closeRefundModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {refundError && (
              <div className="bg-[#ff4033]/10 border border-[#ff4033]/30 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-[#ff4033]">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {refundError}
              </div>
            )}

            {!refundSaleData ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Original Sale Number / رقم الفاتورة الأصلية
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="SALE-2025-XXXXXX"
                        className="w-full pl-10 p-3 border border-slate-300 rounded-xl uppercase font-mono focus:ring-2 focus:ring-[#3d579f] outline-none"
                        value={refundSaleIdInput}
                        onChange={e => setRefundSaleIdInput(e.target.value)}
                        onKeyDown={e =>
                          e.key === 'Enter' && handleSearchSaleForRefund()
                        }
                      />
                    </div>
                    <button
                      onClick={handleSearchSaleForRefund}
                      disabled={refundSearching}
                      className="bg-[#3d579f] text-white px-6 py-2 rounded-xl font-bold hover:bg-[#2f4377] disabled:opacity-50 transition-colors"
                    >
                      {refundSearching ? 'Searching... / جارٍ البحث...' : 'Find / بحث'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Enter the full sale number found on the receipt. / أدخل رقم الفاتورة
                    الموجود على الإيصال.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm space-y-2">
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500">Sale Number / رقم الفاتورة</span>
                    <span className="font-bold font-mono text-slate-800">
                      {refundSaleData.sale_number}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-500">Total Amount / المبلغ الإجمالي</span>
                    <span className="font-bold text-slate-800">
                      {Number(refundSaleData.total_amount).toFixed(3)} KWD / د.ك
                    </span>
                  </div>
<div>
  <span className="block text-slate-500 mb-1">Items / العناصر</span>
  <div className="font-medium text-slate-800 bg-white p-2 rounded border border-slate-100">
    {(refundSaleData.items ?? [])
      .map(i => i.item_name_en)
      .join(', ') || '—'}
  </div>
</div>                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Select Refund Reason / اختر سبب الاسترجاع{' '}
                    <span className="text-[#ff4033]">*</span>
                  </label>
                  <select
                    className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#3d579f] bg-white"
                    value={refundReason}
                    onChange={e => setRefundReason(e.target.value)}
                  >
                    <option value="">-- Choose Reason / اختر السبب --</option>
                    <option value="Customer returned items">
                      Customer returned items / قام العميل بإرجاع البضاعة
                    </option>
                    <option value="Damaged goods">
                      Damaged goods / بضاعة تالفة
                    </option>
                    <option value="Incorrect order">
                      Incorrect order / طلب غير صحيح
                    </option>
                    <option value="Customer request">
                      Customer request / طلب العميل
                    </option>
                    <option value="Other">Other / أخرى</option>
                  </select>
                </div>

                <button
                  onClick={handleProcessRefund}
                  disabled={!refundReason || processing}
                  className="w-full bg-[#ff4033] text-white py-4 rounded-xl font-bold hover:bg-[#e6362b] disabled:opacity-50 shadow-lg shadow-[#ff4033]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing Refund... / جارٍ تنفيذ الاسترجاع...
                    </>
                  ) : (
                    'Confirm Refund / تأكيد الاسترجاع'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sales History Modal */}
      {showSalesHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl max-h-96 rounded-2xl shadow-2xl transform transition-all flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <History className="w-5 h-5" />
                Recent Sales / آخر المبيعات
              </h2>
              <button
                onClick={() => setShowSalesHistory(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {recentSales.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>No sales yet. / لا توجد مبيعات بعد.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="p-3 text-left font-bold text-slate-700">
                        Sale # / رقم الفاتورة
                      </th>
                      <th className="p-3 text-left font-bold text-slate-700">
                        Date/Time / التاريخ والوقت
                      </th>
                      <th className="p-3 text-right font-bold text-slate-700">
                        Amount / المبلغ
                      </th>
                      <th className="p-3 text-left font-bold text-slate-700">
                        Payment / الدفع
                      </th>
                      <th className="p-3 text-left font-bold text-slate-700">
                        Status / الحالة
                      </th>
                      <th className="p-3 text-left font-bold text-slate-700">
                               Actions / إجراء
                             </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentSales.map(sale => (
                      <tr key={sale.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-[#3d579f] font-bold">
                          {sale.sale_number}
                        </td>
                        <td className="p-3 text-slate-600">
                          {new Date(sale.sale_date).toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-800">
                          {Number(sale.total_amount).toFixed(3)} KWD / د.ك
                        </td>
                        <td className="p-3 capitalize text-slate-600">
                          {sale.payment_method}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              sale.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {sale.status === 'completed'
                              ? 'completed / مكتملة'
                              : 'refunded / مسترجعة'}
                          </span>
                        </td>
                          <td className="p-3">
        <button
          onClick={() => setSelectedHistorySale(sale)}
          className="text-xs px-3 py-1 rounded bg-[#3d579f] text-white hover:bg-[#2f4377]"
        >
          View / Print
        </button>
      </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};