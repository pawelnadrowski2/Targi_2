import React, { useState } from 'react';
import { TradeOrder } from '../types';
import { Sparkles, CheckCircle, Plus, Store, History, Calendar, Trash2 } from 'lucide-react';

interface ExhibitorFormProps {
  onAddOrder: (clientName: string, orderValue: number) => TradeOrder;
  onDeleteOrder: (id: string) => void;
  exhibitorName: string;
  orders: TradeOrder[];
}

export const ExhibitorForm: React.FC<ExhibitorFormProps> = ({ onAddOrder, onDeleteOrder, exhibitorName, orders }) => {
  const [clientName, setClientName] = useState('');
  const [orderValue, setOrderValue] = useState('');
  const [lastOrder, setLastOrder] = useState<TradeOrder | null>(null);
  
  // Custom Modal State for Deletion
  const [orderToDelete, setOrderToDelete] = useState<TradeOrder | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !orderValue) return;

    const numericValue = parseFloat(orderValue);
    if (isNaN(numericValue)) return;

    const newOrder = onAddOrder(clientName, numericValue);
    setLastOrder(newOrder);
    
    // Reset form
    setClientName('');
    setOrderValue('');
  };

  const confirmDelete = () => {
    if (orderToDelete) {
      onDeleteOrder(orderToDelete.id);
      if (lastOrder?.id === orderToDelete.id) {
        setLastOrder(null);
      }
      setOrderToDelete(null);
    }
  };

  // Sort orders by date desc
  const sortedOrders = [...orders].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-start relative">
      
      {/* Custom Delete Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
             <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4 mx-auto">
               <Trash2 size={24} />
             </div>
             <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Usunąć wpis?</h3>
             <p className="text-center text-slate-600 mb-6 text-sm">
               Czy na pewno chcesz usunąć zamówienie <strong>{orderToDelete.ticketNumber}</strong>?
             </p>
             <div className="flex gap-3">
               <button 
                 onClick={() => setOrderToDelete(null)}
                 className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
               >
                 Anuluj
               </button>
               <button 
                 onClick={confirmDelete}
                 className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors"
               >
                 Usuń
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Form Section */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white">
          <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-2">
            <Store size={14} />
            {exhibitorName}
          </div>
          <h2 className="text-2xl font-bold mb-2">Rejestracja Zamówienia</h2>
          <p className="opacity-90 text-sm">Wprowadź dane, aby wygenerować los.</p>
        </div>

        <div className="p-8">
          {lastOrder ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-600 rounded-full mb-4">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Zarejestrowano pomyślnie!</h3>
              <p className="text-slate-500 mb-4">Dla klienta: {lastOrder.clientName}</p>
              
              <div className="bg-amber-50 border-2 border-amber-200 border-dashed rounded-xl p-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-1 -mr-1 w-4 h-4 bg-white rounded-bl-full z-10"></div>
                <div className="absolute bottom-0 left-0 -mb-1 -ml-1 w-4 h-4 bg-white rounded-tr-full z-10"></div>
                <p className="text-xs uppercase tracking-wider text-amber-800 font-semibold mb-1">Twój Numer Losu</p>
                <p className="text-4xl font-black text-amber-600 font-mono tracking-widest">{lastOrder.ticketNumber}</p>
              </div>

              <button 
                onClick={() => setLastOrder(null)}
                className="mt-6 w-full py-3 px-4 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Dodaj kolejne zamówienie
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="clientName" className="block text-sm font-medium text-slate-700 mb-1">Nazwa Klienta / Firmy</label>
                <input
                  id="clientName"
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="np. Firma Budowlana XYZ"
                  required
                />
              </div>

              <div>
                <label htmlFor="orderValue" className="block text-sm font-medium text-slate-700 mb-1">Wartość Zamówienia (PLN)</label>
                <div className="relative">
                  <input
                    id="orderValue"
                    type="number"
                    min="0"
                    step="0.01"
                    value={orderValue}
                    onChange={(e) => setOrderValue(e.target.value)}
                    className="w-full px-4 py-3 pl-8 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    placeholder="0.00"
                    required
                  />
                  <span className="absolute left-3 top-3.5 text-slate-400 text-sm font-bold">zł</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
              >
                <Sparkles size={20} />
                Generuj Bilet
              </button>
            </form>
          )}
        </div>
      </div>

      {/* History Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full max-h-[600px]">
        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <History size={20} className="text-slate-400" />
              <h3 className="font-bold text-slate-800">Twoja Historia Zgłoszeń</h3>
           </div>
           <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{orders.length}</span>
        </div>
        
        <div className="overflow-y-auto flex-grow p-0">
          {sortedOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
               <p>Brak zarejestrowanych zamówień.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
               {sortedOrders.map(order => (
                 <div key={order.id} className="p-4 hover:bg-slate-50 transition-colors group relative">
                    <div className="flex justify-between items-start mb-1">
                       <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-sm">{order.ticketNumber}</span>
                       <div className="flex items-center gap-2">
                           <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Calendar size={12} />
                              {new Date(order.createdAt).toLocaleDateString('pl-PL')}
                           </span>
                           {!order.isWinner && (
                             <button
                               onClick={() => setOrderToDelete(order)}
                               className="text-slate-300 hover:text-red-500 transition-colors p-1"
                               title="Usuń to zamówienie"
                             >
                               <Trash2 size={14} />
                             </button>
                           )}
                       </div>
                    </div>
                    <div className="flex justify-between items-center">
                       <div className="font-medium text-slate-800 text-sm">{order.clientName}</div>
                       #<div className="font-semibold text-slate-600 text-sm">{order.orderValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</div>
                    </div>
                    {order.isWinner && (
                       <div className="mt-2 text-center">
                          <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded-full w-full block">
                             🎉 Wylosowany!
                          </span>
                       </div>
                    )}
                 </div>
               ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};