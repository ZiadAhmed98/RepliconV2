import { useNavigate } from 'react-router-dom';

export default function SettingsLayout({ title, subtitle, accent = '#818cf8', children }) {
  const navigate = useNavigate();
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button
        onClick={() => navigate('/administration')}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <i className="bx bx-arrow-back" />
        Back to Administration
      </button>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-8 rounded-full" style={{ background: accent }} />
          <h1 className="text-2xl font-bold text-white">{title}</h1>
        </div>
        {subtitle && <p className="text-slate-400 ml-4 text-sm">{subtitle}</p>}
      </div>

      {children}
    </div>
  );
}
