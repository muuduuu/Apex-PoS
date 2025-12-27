import React from 'react';
import { Sale, Refund } from '../types';

interface ReceiptModalProps {
  sale?: Sale;
  refund?: Refund;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, refund, onClose }) => {
  if (!sale && !refund) return null;

  // Debug logging
  console.log('ReceiptModal - sale:', sale);
  console.log('ReceiptModal - sale_number:', sale?.sale_number);
  console.log('ReceiptModal - total_amount:', sale?.total_amount);

  const isRefund = !!refund;

  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const generateReceiptHTML = () => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body {
      width:76mm;
      margin:0;
      padding:0;
      background:#fff;
      font-family:'Courier New',monospace;
      font-size:9pt;
      line-height:1.3;
      color:#000;
      font-weight: 900; /* GLOBAL BOLD */
    }
    .receipt { 
      width:76mm; 
      padding:2mm 3mm 2mm 4mm;
      min-height:100vh;
      font-weight: 900; /* EXTRA BOLD */
    }
    .header {
      text-align:center;
      margin-bottom:2mm;
      padding-bottom:1mm;
      border-bottom:1px dashed #000;
    }
    .header h1 { 
      font-size:11pt; 
      font-weight: 900; /* EXTRA BOLD */
      margin-bottom:0.5mm; 
    }
    .header .sub-en { 
      font-size:8pt; 
      font-weight: 900;
      margin-bottom:0.5mm; 
    }
    .header .sub-ar { 
      font-size:10pt; 
      font-weight: 900;
      margin-bottom:1mm; 
    }
    .header .contact { 
      font-size:7pt; 
      font-weight: 900;
      margin-top:1mm; 
      line-height:1.4; 
    }
    .receipt-type {
      text-align:center;
      margin:2mm 0;
      padding:1mm 0;
      border-top:1px dashed #000;
      border-bottom:1px dashed #000;
      font-weight: 900;
      font-size:9pt;
    }
    .info-section { 
      margin-bottom:3mm; 
      font-size:8pt;
      font-weight: 900;
    }
    .info-row, .info-row-ar {
      display:flex;
      justify-content:space-between;
      margin-bottom:1mm;
      font-weight: 900; /* INFO LABELS + VALUES BOLD */
    }
    .info-row-ar { 
      direction:rtl; 
      text-align:right; 
      font-size:9pt; 
      font-weight: 900;
    }
    .items-section { 
      margin-bottom:3mm; 
      font-weight: 900;
    }
    .section-title {
      text-align:center;
      font-weight: 900;
      font-size:8pt;
      padding:1mm 0;
      border-top:1px dashed #000;
      border-bottom:1px dashed #000;
      margin-bottom:2mm;
    }
    table { 
      width:100%; 
      border-collapse:collapse; 
      font-size:8pt; 
      table-layout:fixed;
      font-weight: 900; /* TABLE CONTENTS BOLD */
    }
    th { 
      text-align:left; 
      border-bottom:1px solid #000; 
      padding:0.8mm 0; 
      font-weight: 900;
      font-size:9pt;
    }
    th.qty { text-align:center; }
    th.price { text-align:right; }
    td { 
      padding:0.6mm 0;
      border-bottom:1px dashed #ccc; 
      font-weight: 900;
    }
    td.item-name-en, td.item-name-ar, td.qty, td.price { 
      font-weight: 900 !important;
    }
    .totals-section { 
      margin-bottom:3mm; 
      font-weight: 900;
    }
    .total-row {
      display:flex;
      justify-content:space-between;
      font-size:8pt;
      margin-bottom:1mm;
      font-weight: 900; /* TOTALS BOLD */
    }
    .total-row.final {
      font-weight: 900;
      font-size:10pt;
      border-top:1px solid #000;
      border-bottom:1px solid #000;
      padding:1mm 0;
      margin:2mm 0;
    }
    .payment-section { 
      margin-bottom:3mm; 
      font-size:8pt;
      font-weight: 900;
    }
    .footer {
      text-align:center;
      margin-top:4mm;
      padding-top:2mm;
      border-top:1px solid #000;
      font-size:8pt;
      line-height:1.6;
      font-weight: 900; /* FOOTER BOLD */
    }
    .footer p { 
      margin:0 0 1mm 0; 
      font-weight: 900;
    }
    @page { size:76mm auto; margin:0; }
    @media print {
      body { margin: 0 !important; }
      .receipt { padding: 2mm 3mm 2mm 4mm !important; }
      * { font-weight: 900 !important; } /* PRINT EXTRA BOLD */
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>Apex POS System</h1>
      <div class="sub-en">
        Apex Group International
      </div>
      <div class="sub-ar">شركة مجموعة ابكس انترناشيونال للتجارة العامة و المقاولات</div>
      <div class="contact">
        PH: +965 25456301<br/>
        Email: info@apexgroup-intl.com<br/>
        www.apexgroup-intl.com
      </div>
      <div class="receipt-type">
        ${
          isRefund
            ? '<div>REFUND RECEIPT</div><div>فاتورة استرجاع</div>'
            : '<div>SALES RECEIPT</div><div>فاتورة بيع</div>'
        }
      </div>
    </div>

    <div class="info-section">
      <div class="info-row">
        <span>${isRefund ? refund!.refund_number : sale!.sale_number}</span>
        <span>Sale No:</span>
      </div>
      <div class="info-row-ar">
        <span>:رقم الفاتورة</span>
        <span>${isRefund ? refund!.refund_number : sale!.sale_number}</span>
      </div>

      ${
        isRefund && refund && 'sale_id' in refund
          ? `<div class="info-row" style="font-size:7pt;">Original Sale: ${refund.sale_id}</div>`
          : ''
      }

      <div class="info-row" style="margin-top:1mm;">
        <span>${sale?.cashier_name || 'Admin'}</span>
        <span>Cashier:</span>
      </div>
      <div class="info-row-ar">
        <span>:أمين الصندوق</span>
        <span>${sale?.cashier_name || 'Admin'}</span>
      </div>

      <div class="info-row" style="margin-top:1mm;">
        <span>${formatDateTime(isRefund ? refund!.created_at : sale!.sale_date)}</span>
        <span>Date/Time:</span>
      </div>
      <div class="info-row-ar">
        <span>:التاريخ/الوقت</span>
        <span>${formatDateTime(isRefund ? refund!.created_at : sale!.sale_date)}</span>
      </div>
    </div>

    ${
      !isRefund && sale
        ? `
    <div class="items-section">
      <div class="section-title">ITEMS / البنود</div>
      <table>
        <thead>
          <tr>
            <th style="width:65%;">Item/البند</th>
            <th class="qty">Qty</th>
            <th class="price">Price</th>
          </tr>
        </thead>
        <tbody>
          ${(sale.items || [])
            .map(
              i => `
          <tr>
            <td>
              <div class="item-name-en">${i.item_name_en}</div>
              <div class="item-name-ar">${i.item_name_ar}</div>
            </td>
            <td class="qty">${Number(i.quantity).toFixed(2)}</td>
            <td class="price">${Number(i.line_total).toFixed(3)}</td>
          </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </div>`
        : ''
    }

    <div class="totals-section">
      <div class="section-title">${
        isRefund ? 'REFUND DETAILS / تفاصيل الاسترجاع' : 'TOTALS / الإجماليات'
      }</div>

      ${
        !isRefund && sale
          ? `
      <div class="total-row">
        <span>${Number(sale.subtotal).toFixed(3)} KWD</span>
        <span>Subtotal / الإجمالي</span>
      </div>

      ${
        Number(sale.discount_amount) > 0
          ? `
      <div class="total-row">
        <span>-${Number(sale.discount_amount).toFixed(3)} KWD</span>
        <span>Discount / الخصم ${
          Number(sale.discount_percentage) > 0 ? `(${sale.discount_percentage}%)` : ''
        }</span>
      </div>`
          : ''
      }

      <div class="total-row final">
        <span>${Number(sale.total_amount).toFixed(3)} KWD</span>
        <span>TOTAL / الصافي</span>
      </div>
      <div style="text-align:right;font-weight:900;font-size:10pt;">
        ${Number(sale.total_amount).toFixed(3)} د.ك
      </div>`
          : ''
      }

      ${
        isRefund
          ? `
      <div class="total-row final">
        <span>${Number(refund!.amount).toFixed(3)} KWD</span>
        <span>Refund Amount</span>
      </div>
      <div style="text-align:right;font-weight:900;font-size:10pt;">
        ${Number(refund!.amount).toFixed(3)} د.ك
      </div>
      <div style="margin-top:1mm;font-size:8pt;">
        <strong>Reason:</strong> ${refund!.reason}
      </div>`
          : ''
      }
    </div>

    ${
      !isRefund && sale
        ? `
    <div class="payment-section">
      <div class="section-title">PAYMENT / الدفع</div>
      <div class="total-row">
        <span style="font-weight:900;text-transform:uppercase;">${sale.payment_method}</span>
        <span>Method:</span>
      </div>
      ${
        sale.payment_method === 'knet' && sale.knet_reference
          ? `<div class="total-row"><span>${sale.knet_reference}</span><span>Ref No:</span></div>`
          : ''
      }
      ${
        sale.payment_method === 'cheque' && sale.cheque_number
          ? `<div class="total-row"><span>${sale.cheque_number}</span><span>Cheque No:</span></div>`
          : ''
      }
    </div>`
        : ''
    }

    <div class="footer">
      <p style="font-weight:900;">THANK YOU / شكرا لك</p>
      <p>WELCOME BACK / أهلا بك مجددا</p>
      <p style="margin-top:1mm;font-size:7pt;">${formatDateTime(
        new Date().toISOString(),
      )}</p>
      <p style="font-size:7pt;">Powered by Apex POS v1.0</p>
    </div>
  </div>
</body>
</html>`;
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(generateReceiptHTML());
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 300);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white w-96 shadow-xl">
        {/* On‑screen preview (short) */}
        <div className="p-4 font-mono text-sm leading-tight text-black">
          <div className="text-center mb-2 border-b border-dashed border-black pb-2">
            <h1 className="text-base font-bold">Apex POS System</h1>
            <p className="text-[11px]">
              Apex Group International
            </p>
            <p className="text-[12px] font-bold font-arabic">
              شركة مجموعة ابكس انترناشيونال للتجارة العامة و المقاولات
            </p>
          </div>
          <p className="text-xs mb-1">
            {isRefund 
              ? 'Refund No: ' + (refund!.refund_number || 'N/A')
              : 'Sale No: ' + (sale!.sale_number || 'Processing...')}
          </p>
          <p className="text-xs">
            Amount:{' '}
            {isRefund
              ? (Number(refund!.amount) || 0).toFixed(3)
              : (Number(sale!.total_amount) || 0).toFixed(3)}{' '}
            KWD
          </p>
        </div>

        <div className="flex gap-2 p-4 bg-gray-100 border-t">
          <button
            onClick={handlePrint}
            className="flex-1 bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700"
          >
            Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-black py-2 rounded font-bold hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
