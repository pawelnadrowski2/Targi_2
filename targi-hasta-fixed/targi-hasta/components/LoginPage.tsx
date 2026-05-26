import React, { useState, useRef } from 'react';
import { AppView, ExhibitorAccount, UserSession, CloudConfig } from '../types';
import { ArrowLeft, Lock, KeyRound, AlertCircle, Cloud, Upload } from 'lucide-react';

interface LoginPageProps {
  view: AppView.LOGIN_ADMIN | AppView.LOGIN_EXHIBITOR;
  exhibitors: ExhibitorAccount[];
  onLogin: (session: UserSession) => void;
  onBack: () => void;
  // FIX #1: Przyjmujemy funkcję walidacji zamiast surowego hasła.
  // Dzięki temu LoginPage nigdy nie widzi hasła ani tokenu superusera.
  validateAdminLogin: (input: string) => UserSession | null;
  logoUrl?: string;
  onSetCloudConfig: (config: CloudConfig) => void;
  isCloudConnected: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  view,
  exhibitors,
  onLogin,
  onBack,
  validateAdminLogin,
  logoUrl,
  onSetCloudConfig,
  isCloudConnected,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = view === AppView.LOGIN_ADMIN;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isAdmin) {
      // FIX #1: hasła nie są sprawdzane inline – delegujemy do App.tsx
      const session = validateAdminLogin(inputVal);
      if (session) {
        onLogin(session);
      } else {
        setError('Nieprawidłowe hasło administratora.');
      }
    } else {
      const exhibitor = exhibitors.find(ex => ex.accessCode === inputVal.trim());
      if (exhibitor) {
        onLogin({ role: 'EXHIBITOR', name: exhibitor.name, id: exhibitor.id });
      } else {
        setError('Nieprawidłowy kod dostępu. Sprawdź dane otrzymane od administratora.');
      }
    }
  };

  const handleConfigUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const config = JSON.parse(ev.target?.result as string);
        if (config.apiKey && config.databaseURL) {
          onSetCloudConfig(config);
          alert('Konfiguracja chmury wczytana pomyślnie! Jesteś teraz Online.');
        } else {
          alert('Nieprawidłowy plik konfiguracyjny.');
        }
      } catch {
        alert('Błąd odczytu pliku.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full relative">
      <button onClick={onBack} className="absolute top-24 left-4 md:left-8 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
        <ArrowLeft size={20} className="mr-2" /> Wróć
      </button>

      {logoUrl && <img src={logoUrl} alt="Logo" className="h-16 object-contain mb-8" />}

      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 border border-slate-100 animate-in zoom-in-95 duration-300 relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-full h-1 ${isCloudConnected ? 'bg-green-500' : 'bg-slate-200'}`} />

        <div className="text-center mb-8">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isAdmin ? 'bg-slate-100 text-slate-700' : 'bg-indigo-100 text-indigo-600'}`}>
            {isAdmin ? <Lock size={32} /> : <KeyRound size={32} />}
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {isAdmin ? 'Logowanie Administratora' : 'Logowanie Wystawcy'}
          </h2>
          <p className="text-slate-500 text-sm mt-2 flex items-center justify-center gap-2">
            Status: {isCloudConnected
              ? <span className="text-green-600 font-bold flex items-center gap-1"><Cloud size={14} /> ONLINE</span>
              : <span className="text-slate-400">OFFLINE (Lokalnie)</span>}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {isAdmin ? 'Hasło' : 'Kod Dostępu'}
            </label>
            <input
              type={isAdmin ? 'password' : 'text'}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder={isAdmin ? '••••••••' : 'np. AB-123'}
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button
            type="submit"
            className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 ${isAdmin ? 'bg-slate-800 hover:bg-slate-900' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            Zaloguj się
          </button>

          <div className="pt-6 border-t border-slate-100">
            <input type="file" ref={fileRef} className="hidden" accept=".json" onChange={handleConfigUpload} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 text-xs font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Upload size={14} />
              {isCloudConnected ? 'Zaktualizuj Konfigurację Chmury' : 'Wczytaj Konfigurację Chmury (Plik)'}
            </button>
            <p className="text-center text-[10px] text-slate-300 mt-2">
              Wgraj plik konfiguracyjny otrzymany od Administratora, aby połączyć się z siecią.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
