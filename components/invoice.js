const InvoiceModal = (props) => {
  const { invoiceOpen, setInvoiceOpen } = props;

    const [invoiceLines, setInvoiceLines] = React.useState([{ description: '', qty: 1, price: '' }]);
    const [invoiceName, setInvoiceName] = React.useState('');

    if (!invoiceOpen) return null;

    const addLine = () => setInvoiceLines(prev => [...prev, { description: '', qty: 1, price: '' }]);
    const removeLine = (i) => setInvoiceLines(prev => prev.filter((_, idx) => idx !== i));
    const updateLine = (i, field, value) => setInvoiceLines(prev => prev.map((line, idx) => idx === i ? { ...line, [field]: value } : line));

    const total = invoiceLines.reduce((sum, line) => sum + (parseFloat(line.price) || 0) * (parseInt(line.qty) || 0), 0);

    const getInvoiceText = () => {
      const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      let text = `INVOICE\n${'='.repeat(50)}\nDate: ${dateStr}\nClient: ${invoiceName || '—'}\n${'='.repeat(50)}\n\n`;
      text += 'Description'.padEnd(28) + 'Qty'.padEnd(10) + 'Price'.padEnd(10) + 'Total\n';
      text += '-'.repeat(58) + '\n';
      invoiceLines.forEach(line => {
        if (line.description) {
          const lineTotal = (parseFloat(line.price) || 0) * (parseInt(line.qty) || 0);
          text += (line.description).padEnd(28) + String(line.qty).padEnd(10) + `€${(parseFloat(line.price) || 0).toFixed(2)}`.padEnd(10) + `€${lineTotal.toFixed(2)}\n`;
        }
      });
      text += '-'.repeat(58) + '\n';
      text += `${''.padEnd(38)}TOTAL: €${total.toFixed(2)}\n`;
      return text;
    };

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 md:px-0"
        onClick={() => setInvoiceOpen(false)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-neutral-100">
            <h3 className="text-lg font-semibold text-neutral-900">Quick Invoice</h3>
            <button onClick={() => setInvoiceOpen(false)}
              className="w-8 h-8 rounded-lg hover:bg-neutral-100 flex items-center justify-center transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Form */}
          <div className="p-4 md:p-6 space-y-5 overflow-y-auto flex-1">
            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Name</label>
              <input type="text" placeholder="Invoice anything – no reservation needed"
                value={invoiceName} onChange={e => setInvoiceName(e.target.value)}
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Line items</label>
              <div className="space-y-2">
                {invoiceLines.map((line, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="text" placeholder="Description"
                      value={line.description} onChange={e => updateLine(i, 'description', e.target.value)}
                      className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                    <input type="number" min="1" placeholder="Qty"
                      value={line.qty} onChange={e => updateLine(i, 'qty', e.target.value)}
                      className="w-16 px-2 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-neutral-400">€</span>
                      <input type="number" min="0" step="0.01" placeholder="0.00"
                        value={line.price} onChange={e => updateLine(i, 'price', e.target.value)}
                        className="w-24 pl-7 pr-2 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all" />
                    </div>
                    {invoiceLines.length > 1 && (
                      <button onClick={() => removeLine(i)}
                        className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors flex-shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" className="w-3.5 h-3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addLine}
                className="mt-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 5v14M5 12h14"/></svg>
                Add line
              </button>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
              <span className="text-sm font-medium text-neutral-500">Total</span>
              <span className="text-xl font-bold text-neutral-900">€{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 md:px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex-shrink-0">
            <kbd className="hidden md:inline-flex px-2 py-0.5 bg-white rounded-md text-[11px] font-medium text-neutral-400 border border-neutral-200">ESC to close</kbd>
            <div className="flex gap-2 ml-auto">
              <button onClick={() => { const w = window.open('', '_blank'); w.document.write('<pre style="font-family:system-ui;font-size:14px;padding:40px">' + getInvoiceText() + '</pre>'); w.document.title = 'Invoice'; w.print(); }}
                className="px-3 md:px-4 py-2 flex items-center gap-2 bg-white border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                <span className="hidden md:inline">Print</span>
              </button>
              <a href={`mailto:?subject=Invoice - ${invoiceName || 'Walk-in'}&body=${encodeURIComponent(getInvoiceText())}`}
                className="px-3 md:px-4 py-2 flex items-center gap-2 bg-white border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <span className="hidden md:inline">Email</span>
              </a>
              <button onClick={() => setInvoiceOpen(false)}
                className="px-5 py-2 flex items-center gap-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors shadow-lg">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="20 6 9 17 4 12"/></svg>
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
};