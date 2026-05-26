import React, { useState, useEffect, useRef } from 'react';
import { AppView, TradeOrder, WinnerContext, UserSession, ExhibitorAccount, CloudConfig } from './types';
import { ExhibitorForm } from './components/ExhibitorForm';
import { AdminDashboard } from './components/AdminDashboard';
import { LotteryWheel } from './components/LotteryWheel';
import { LandingPage } from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { generateCongratulationMessage } from './services/geminiService';
import { Gift, ArrowLeft, PartyPopper, X, LogOut, Cloud, CloudOff, Printer } from 'lucide-react';
import confetti from 'canvas-confetti';

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, remove, Database } from 'firebase/database';

// FIX #1: Hasło admina NIE jest zakodowane na stałe. Domyślna wartość pochodzi z
// .env.local (VITE_DEFAULT_ADMIN_PASS). Hasło superusera usunięte z kodu —
// rola SUPERUSER dostępna wyłącznie przez specjalny token środowiskowy.
const DEFAULT_ADMIN_PASS = (import.meta.env.VITE_DEFAULT_ADMIN_PASS as string) || 'zmien-to-haslo';
const SUPERUSER_TOKEN   = (import.meta.env.VITE_SUPERUSER_TOKEN   as string) || '';

// FIX #5: Unikalny numer biletu oparty na crypto.randomUUID (pierwsze 6 znaków).
// Nie używamy orders.length+1, który duplikuje się przy synchronizacji chmury.
const generateTicketNumber = (): string => {
  const uid = crypto.randomUUID().replace(/-/g, '').toUpperCase().slice(0, 6);
  return `#${uid}`;
};

const generateId = (): string => {
  try { return crypto.randomUUID(); } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
};

// FIX #4: Schemat walidacji importowanego backupu.
const isValidBackup = (parsed: unknown): parsed is { data: { orders: TradeOrder[]; exhibitors: ExhibitorAccount[] } } => {
  if (typeof parsed !== 'object' || parsed === null) return false;
  const p = parsed as Record<string, unknown>;
  if (typeof p.data !== 'object' || p.data === null) return false;
  const d = p.data as Record<string, unknown>;
  return Array.isArray(d.orders) && Array.isArray(d.exhibitors);
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LANDING);
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [exhibitors, setExhibitors] = useState<ExhibitorAccount[]>([]);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [lastWinnerContext, setLastWinnerContext] = useState<WinnerContext | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);

  const [adminPassword, setAdminPassword] = useState<string>(DEFAULT_ADMIN_PASS);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  // FIX #2: Auto-backup domyślnie wyłączony (nie otwiera okien pobierania co 5 min).
  const [autoBackupEnabled, setAutoBackupEnabled] = useState<boolean>(false);

  const [cloudConfig, setCloudConfig] = useState<CloudConfig | null>(null);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);
  const firebaseAppRef = useRef<FirebaseApp | null>(null);
  const dbRef = useRef<Database | null>(null);

  const ordersRef     = useRef(orders);
  const exhibitorsRef = useRef(exhibitors);
  const passwordRef   = useRef(adminPassword);

  const LOGO_URL = 'https://hurt.hasta.pl/themes/appwise-nowy-20190822135112/assets/img/logo.png';

  // ─── Online status ────────────────────────────────────────────────────────
  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ─── Init z localStorage ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('fairLotteryData');
      if (raw) setOrders(JSON.parse(raw));
      const rawEx = localStorage.getItem('fairLotteryExhibitors');
      if (rawEx) setExhibitors(JSON.parse(rawEx));
      const rawPass = localStorage.getItem('fairLotteryAdminPass');
      if (rawPass) setAdminPassword(rawPass);
      const rawAB = localStorage.getItem('fairLotteryAutoBackup');
      if (rawAB) setAutoBackupEnabled(JSON.parse(rawAB));
      const rawCloud = localStorage.getItem('fairLotteryCloudConfig');
      if (rawCloud) setCloudConfig(JSON.parse(rawCloud));
    } catch { /* uszkodzony localStorage – ignorujemy */ }
  }, []);

  // ─── Firebase sync ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cloudConfig || firebaseAppRef.current) return;
    try {
      const app = initializeApp(cloudConfig);
      const db  = getDatabase(app);
      firebaseAppRef.current = app;
      dbRef.current = db;
      setIsCloudConnected(true);

      onValue(ref(db, 'orders'), snap => {
        const val = snap.val();
        setOrders(val ? (Object.values(val) as TradeOrder[]) : []);
      });
      onValue(ref(db, 'exhibitors'), snap => {
        const val = snap.val();
        if (val) setExhibitors(Object.values(val) as ExhibitorAccount[]);
      });
      onValue(ref(db, 'settings'), snap => {
        const val = snap.val();
        if (val?.adminPassword) setAdminPassword(val.adminPassword);
      });
    } catch (err) {
      console.error('Firebase init error:', err);
      setIsCloudConnected(false);
      alert('Błąd połączenia z chmurą. Sprawdź konfigurację.');
    }
  }, [cloudConfig]);

  // ─── Persistencja lokalna ─────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('fairLotteryData',      JSON.stringify(orders));       ordersRef.current     = orders;       }, [orders]);
  useEffect(() => { localStorage.setItem('fairLotteryExhibitors',JSON.stringify(exhibitors));   exhibitorsRef.current = exhibitors;   }, [exhibitors]);
  useEffect(() => { localStorage.setItem('fairLotteryAdminPass', adminPassword);                passwordRef.current   = adminPassword; }, [adminPassword]);
  useEffect(() => { localStorage.setItem('fairLotteryAutoBackup',JSON.stringify(autoBackupEnabled)); }, [autoBackupEnabled]);

  // ─── Akcje ────────────────────────────────────────────────────────────────
  const handleAddOrder = (clientName: string, orderValue: number): TradeOrder => {
    const newOrder: TradeOrder = {
      id: generateId(),
      clientName,
      orderValue,
      // FIX #5: unikalny numer biletu
      ticketNumber: generateTicketNumber(),
      createdAt: Date.now(),
      isWinner: false,
      createdBy: currentUser?.name,
      exhibitorId: currentUser?.id,
    };

    if (isCloudConnected && dbRef.current) {
      set(ref(dbRef.current, 'orders/' + newOrder.id), newOrder);
    } else {
      setOrders(prev => [...prev, newOrder]);
    }
    return newOrder;
  };

  const handleDeleteOrder = (orderId: string) => {
    if (isCloudConnected && dbRef.current) remove(ref(dbRef.current, 'orders/' + orderId));
    else setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const handleAddExhibitor = (name: string) => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const rand = (n: number) => letters.charAt(Math.floor(Math.random() * n));
    const code = `${rand(letters.length)}${rand(letters.length)}-${Math.floor(100 + Math.random() * 900)}`;
    const ex: ExhibitorAccount = { id: generateId(), name, accessCode: code };
    if (isCloudConnected && dbRef.current) set(ref(dbRef.current, 'exhibitors/' + ex.id), ex);
    else setExhibitors(prev => [...prev, ex]);
  };

  const handleRemoveExhibitor = (id: string) => {
    if (isCloudConnected && dbRef.current) remove(ref(dbRef.current, 'exhibitors/' + id));
    else setExhibitors(prev => prev.filter(e => e.id !== id));
  };

  const handleWinnerSelected = async (winner: TradeOrder) => {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#FFD700', '#FF0000', '#FFFFFF'] });
    setLoadingMessage(true);

    if (isCloudConnected && dbRef.current) set(ref(dbRef.current, `orders/${winner.id}/isWinner`), true);
    else setOrders(prev => prev.map(o => o.id === winner.id ? { ...o, isWinner: true } : o));

    const message = await generateCongratulationMessage(winner);
    setLastWinnerContext({ winner, congratulationMessage: message });
    setLoadingMessage(false);
  };

  const handleClearData = () => {
    if (!window.confirm('CZY NA PEWNO? To usunie wszystkie zamówienia z całego systemu!')) return;
    handleExportBackup(true);
    if (isCloudConnected && dbRef.current) set(ref(dbRef.current, 'orders'), null);
    else setOrders([]);
    alert('Baza wyczyszczona.');
  };

  const handleChangeAdminPassword = (newPass: string) => {
    setAdminPassword(newPass);
    if (isCloudConnected && dbRef.current) set(ref(dbRef.current, 'settings/adminPassword'), newPass);
  };

  const handleSetCloudConfig = (config: CloudConfig) => {
    localStorage.setItem('fairLotteryCloudConfig', JSON.stringify(config));
    setCloudConfig(config);
    window.location.reload();
  };

  const handleDisconnectCloud = () => {
    if (!window.confirm('Rozłączyć chmurę? Aplikacja przejdzie w tryb Offline.')) return;
    localStorage.removeItem('fairLotteryCloudConfig');
    setCloudConfig(null);
    setIsCloudConnected(false);
    window.location.reload();
  };

  // ─── Eksport / Import ─────────────────────────────────────────────────────
  const handleDownloadCSV = () => {
    const cur = ordersRef.current;
    if (!cur.length) return;
    const BOM = '\uFEFF';
    const headers = ['ID', 'Nr Biletu', 'Klient', 'Wartosc', 'Wystawca', 'Data', 'Wygrana'];
    const rows = cur.map(o => [
      o.id, o.ticketNumber, `"${o.clientName}"`,
      o.orderValue.toString().replace('.', ','),
      `"${o.createdBy}"`,
      new Date(o.createdAt).toLocaleString('pl-PL'),
      o.isWinner ? 'TAK' : 'NIE',
    ]);
    const csv = BOM + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const link = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
      download: `raport_${Date.now()}.csv`,
    });
    link.click();
  };

  // FIX #2: handleExportBackup powoduje pobieranie TYLKO na żądanie (isAuto=true
  // używane wyłącznie przy ręcznym wyczyszczeniu bazy jako safety-net, nie w timerze).
  const handleExportBackup = (isAuto = false) => {
    const payload = {
      timestamp: Date.now(), system: 'HASta',
      data: { orders: ordersRef.current, exhibitors: exhibitorsRef.current, adminPass: passwordRef.current },
    };
    const link = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })),
      download: `${isAuto ? 'AUTO' : 'BACKUP'}_${Date.now()}.json`,
    });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // FIX #4: Import z walidacją schematu przed nadpisaniem danych.
  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);

        if (!isValidBackup(parsed)) {
          alert('Nieprawidłowy plik backupu.\nOczekiwana struktura: { data: { orders: [], exhibitors: [] } }');
          return;
        }

        const { orders: importedOrders, exhibitors: importedExhibitors } = parsed.data;

        if (isCloudConnected && dbRef.current) {
          if (!window.confirm('Jesteś Online. Dane z kopii nadpiszą chmurę. Kontynuować?')) return;
          // Konwertujemy tablice na obiekty kluczowane po id (wymagane przez Firebase RTDB)
          const toMap = <T extends { id: string }>(arr: T[]) =>
            arr.reduce<Record<string, T>>((acc, item) => { acc[item.id] = item; return acc; }, {});
          set(ref(dbRef.current, 'orders'),     toMap(importedOrders));
          set(ref(dbRef.current, 'exhibitors'), toMap(importedExhibitors));
        } else {
          setOrders(importedOrders);
          setExhibitors(importedExhibitors);
        }
        alert(`Zaimportowano ${importedOrders.length} zamówień i ${importedExhibitors.length} wystawców.`);
      } catch {
        alert('Błąd odczytu pliku. Upewnij się, że to prawidłowy plik JSON.');
      }
    };
    reader.readAsText(file);
  };

  // FIX #2: Timer auto-backup zapisuje dane do localStorage (IndexedDB-style snapshot)
  // zamiast otwierać dialog pobierania. Możliwość ręcznego pobrania pozostaje.
  useEffect(() => {
    if (!autoBackupEnabled) return;
    const id = setInterval(() => {
      const payload = {
        timestamp: Date.now(), system: 'HASta',
        data: { orders: ordersRef.current, exhibitors: exhibitorsRef.current },
      };
      try {
        localStorage.setItem('fairLotteryAutoBackupSnapshot', JSON.stringify(payload));
        console.log('[AutoBackup] Snapshot zapisany do localStorage o', new Date().toLocaleTimeString('pl-PL'));
      } catch {
        console.warn('[AutoBackup] Nie można zapisać snapshotu – brak miejsca w localStorage.');
      }
    }, 300_000);
    return () => clearInterval(id);
  }, [autoBackupEnabled]);

  // ─── Auth ─────────────────────────────────────────────────────────────────
  // FIX #1: Obsługa superusera przez niejawny token środowiskowy,
  // hasło 'root.hasta' usunięte z kodu źródłowego.
  const validateAdminLogin = (input: string): UserSession | null => {
    if (SUPERUSER_TOKEN && input === SUPERUSER_TOKEN)
      return { role: 'SUPERUSER', name: 'SuperUser' };
    if (input === adminPassword)
      return { role: 'ADMIN', name: 'Administrator' };
    return null;
  };

  const handleLogin = (session: UserSession) => {
    setCurrentUser(session);
    setCurrentView(session.role === 'EXHIBITOR' ? AppView.EXHIBITOR : AppView.ADMIN);
  };

  const handleLogout = () => { setCurrentUser(null); setCurrentView(AppView.LANDING); };

  // FIX #6: Drukowanie biletu
  const handlePrintTicket = (winner: WinnerContext) => {
    const w = window.open('', '_blank', 'width=400,height=300');
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8">
      <title>Bilet — ${winner.winner.ticketNumber}</title>
      <style>
        body{font-family:sans-serif;margin:0;padding:24px;text-align:center}
        .ticket{border:3px solid #4f46e5;border-radius:16px;padding:24px;max-width:340px;margin:auto}
        h1{font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px}
        .num{font-size:36px;font-weight:900;color:#4f46e5;font-family:monospace;margin:8px 0}
        .name{font-size:20px;font-weight:700;margin:8px 0}
        .sub{font-size:12px;color:#94a3b8;margin:4px 0}
        @media print{body{padding:0}}
      </style></head><body>
      <div class="ticket">
        <h1>Targi HASta — Los Loterii</h1>
        <div class="num">${winner.winner.ticketNumber}</div>
        <div class="name">${winner.winner.clientName}</div>
        <div class="sub">Wystawca: ${winner.winner.createdBy || '—'}</div>
        <div class="sub">${new Date(winner.winner.createdAt).toLocaleString('pl-PL')}</div>
        ${winner.winner.isWinner ? '<div style="margin-top:12px;padding:8px;background:#fef9c3;border-radius:8px;font-weight:700;color:#92400e">🏆 ZWYCIĘZCA</div>' : ''}
      </div>
      <script>window.onload=()=>{window.print();window.close()}<\/script>
      </body></html>
    `);
    w.document.close();
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4 cursor-pointer" onClick={() => !currentUser && setCurrentView(AppView.LANDING)}>
              <img src={LOGO_URL} alt="Logo" className="h-10 object-contain" />
              {isCloudConnected
                ? <span className="flex items-center gap-1 text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full border border-green-200"><Cloud size={12} /> ONLINE</span>
                : <span className="flex items-center gap-1 text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full border border-slate-200"><CloudOff size={12} /> OFFLINE</span>
              }
            </div>
            {currentUser && (
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-500 uppercase">Zalogowano</p>
                  <p className="font-bold text-sm">{currentUser.name}</p>
                </div>
                <button onClick={handleLogout} className="p-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors">
                  <LogOut size={18} />
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-grow flex flex-col">
        <div className="w-full max-w-7xl mx-auto px-4 py-8 flex-grow flex flex-col">

          {currentView === AppView.LANDING && <LandingPage onNavigate={setCurrentView} logoUrl={LOGO_URL} />}

          {(currentView === AppView.LOGIN_ADMIN || currentView === AppView.LOGIN_EXHIBITOR) && (
            <LoginPage
              view={currentView}
              exhibitors={exhibitors}
              onLogin={handleLogin}
              onBack={() => setCurrentView(AppView.LANDING)}
              // FIX #1: LoginPage dostaje funkcję walidacji (nie surowe hasło)
              validateAdminLogin={validateAdminLogin}
              logoUrl={LOGO_URL}
              onSetCloudConfig={handleSetCloudConfig}
              isCloudConnected={isCloudConnected}
            />
          )}

          {currentView === AppView.EXHIBITOR && currentUser && (
            <ExhibitorForm
              onAddOrder={handleAddOrder}
              onDeleteOrder={handleDeleteOrder}
              exhibitorName={currentUser.name}
              orders={orders.filter(o => o.exhibitorId === currentUser.id)}
            />
          )}

          {currentView === AppView.ADMIN && currentUser && (
            <AdminDashboard
              orders={orders}
              exhibitors={exhibitors}
              onClearData={handleClearData}
              onChangeView={setCurrentView}
              onAddExhibitor={handleAddExhibitor}
              onRemoveExhibitor={handleRemoveExhibitor}
              onDeleteOrder={handleDeleteOrder}
              onChangePassword={handleChangeAdminPassword}
              isSuperuser={currentUser.role === 'SUPERUSER'}
              onExportBackup={() => handleExportBackup(false)}
              onImportBackup={handleImportBackup}
              onDownloadCSV={handleDownloadCSV}
              isOnline={isOnline}
              autoBackupEnabled={autoBackupEnabled}
              onToggleAutoBackup={() => setAutoBackupEnabled(p => !p)}
              cloudConfig={cloudConfig}
              onSetCloudConfig={handleSetCloudConfig}
              onDisconnectCloud={handleDisconnectCloud}
              isCloudConnected={isCloudConnected}
            />
          )}

          {currentView === AppView.LOTTERY && (
            <div className="relative">
              <button onClick={() => setCurrentView(AppView.ADMIN)} className="absolute top-0 left-0 bg-white px-4 py-2 rounded-lg shadow flex gap-2 items-center text-sm font-bold z-10">
                <ArrowLeft size={16} /> Powrót
              </button>
              <div className="py-12 flex justify-center">
                <div className="bg-white/10 backdrop-blur-md rounded-[3rem] p-12 shadow-2xl border border-white/20">
                  <LotteryWheel
                    candidates={orders.filter(o => !o.isWinner)}
                    onWinnerSelected={handleWinnerSelected}
                    logoUrl={LOGO_URL}
                  />
                </div>
              </div>

              {lastWinnerContext && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                  <div className="bg-white rounded-3xl p-8 max-w-lg w-full text-center relative overflow-hidden shadow-2xl">
                    <button onClick={() => setLastWinnerContext(null)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full"><X /></button>
                    <PartyPopper className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-4xl font-black text-slate-900 mb-2">ZWYCIĘZCA!</h2>
                    <div className="bg-slate-100 p-4 rounded-xl mb-6">
                      <p className="text-sm font-bold text-slate-500 uppercase">Nr Losu</p>
                      <p className="text-3xl font-mono font-black text-indigo-600">{lastWinnerContext.winner.ticketNumber}</p>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">{lastWinnerContext.winner.clientName}</h3>
                    <p className="text-slate-500 mb-6">Dostawca: <strong>{lastWinnerContext.winner.createdBy}</strong></p>
                    <div className="bg-indigo-50 p-6 rounded-xl text-indigo-800 italic mb-6">
                      {loadingMessage ? 'Generowanie gratulacji…' : `"${lastWinnerContext.congratulationMessage}"`}
                    </div>
                    {/* FIX #6: Przycisk drukowania biletu */}
                    <button
                      onClick={() => handlePrintTicket(lastWinnerContext)}
                      className="flex items-center gap-2 mx-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors text-sm"
                    >
                      <Printer size={16} /> Drukuj / Udostępnij bilet
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
