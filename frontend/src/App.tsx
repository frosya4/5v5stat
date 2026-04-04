import React, { useEffect } from 'react';
import axios from 'axios';
import './App.css';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc, query, orderBy } from 'firebase/firestore';
import { HashRouter, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';

// Utils & Types
import { themeColors, LOCAL_PARSER_URL } from './utils';
import type { DemoResponse } from "./types";
import { useAppStore } from './store';

// Components
import { SidebarBtn } from './components/SidebarBtn';
import { PoopOverlay } from './components/PoopOverlay';
import { LoadingScreen } from './components/LoadingScreen';
import { GlobalBanners } from './components/GlobalBanners';

// Views
import { MatchesView } from './views/MatchesView';
import { GlobalDashboard } from './views/GlobalDashboard';
import { GlobalPlayersView } from './views/GlobalPlayersView';
import { SettingsView } from './views/SettingsView';
import { PlayerProfileView } from './views/PlayerProfileView';
import { MatchAnalysisView } from './views/MatchAnalysisView';
import { TeamBuilderView } from './views/TeamBuilderView';
import { YearReviewView } from './views/YearReviewView';
import { AuthView } from './views/AuthView';


const Layout = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const view = location.pathname;

  const {
    isAdmin, appScale, isLoading, loadingMessage, setLoading,
    token, user, setUser, logout, addToast, setMatches
  } = useAppStore();

  const refreshData = async () => {
    setLoading(true, "Синхронизация данных...");
    try {
      const matchesCollection = collection(db, 'matches');
      const matchesSnapshot = await getDocs(query(matchesCollection, orderBy('upload_date', 'desc')));
      const matchesData = matchesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as DemoResponse[];
      setMatches(matchesData);
      addToast("Данные успешно синхронизированы", "success");
    } catch (error) {
      console.error("Error fetching data: ", error);
      addToast("Ошибка при синхронизации данных", "error");
    } finally {
      setTimeout(() => setLoading(false), 800);
    }
  };

  useEffect(() => {
    if (token && !user) {
      axios.get(`${LOCAL_PARSER_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(resp => {
        setUser(resp.data);
      }).catch(err => {
        console.error("Auth error", err);
        logout();
      });
    }
  }, [token, user, setUser, logout]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setLoading(true, "Подготовка файлов...");
    const files = Array.from(e.target.files);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setLoading(true, `Загрузка: ${file.name} (${i + 1}/${files.length})`);

      const formData = new FormData();
      formData.append('file', file);

      try {
        await axios.post(`${LOCAL_PARSER_URL}/api/upload-demo`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        successCount++;
      } catch (err) {
        console.error(`Error uploading ${file.name}`, err);
        failCount++;
      }
    }

    setLoading(false);
    if (successCount > 0) {
      addToast(`Успешно загружено: ${successCount} демо`, "success");
      refreshData();
    }
    if (failCount > 0) {
      addToast(`Ошибка при загрузке ${failCount} файлов`, "error");
    }
  };

  const toggleAdmin = () => {
    if (user) {
      logout();
    } else {
      navigate('/auth');
    }
  };

  const dashboardBg = user?.dashboard_background;
  const layoutStyle = dashboardBg ? {
    backgroundImage: `linear-gradient(rgba(5, 6, 10, 0.85), rgba(5, 6, 10, 0.85)), url(${dashboardBg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed'
  } : {};

  return (
    <div className="app-layout" style={layoutStyle}>
      {/* ПРЕМИАЛЬНЫЙ ЭКРАН ЗАГРУЗКИ */}
      {isLoading && <LoadingScreen message={loadingMessage} />}

      <div className="sidebar-container glass">
        <div className="sidebar-logo">
          <h1 style={{ fontSize: '28px', fontWeight: '900', margin: 0, color: '#fff', letterSpacing: '-1px' }}>
            573
          </h1>
          <div style={{ fontSize: '9px', color: themeColors.textMuted, marginTop: '2px', letterSpacing: '3px', fontWeight: 'bold', opacity: 0.8 }}>MATCH ANALYZER</div>
        </div>

        <div className="nav-buttons">
          <SidebarBtn icon="" label="Дашборд" active={view === '/'} onClick={() => navigate('/')} />
          {/* <SidebarBtn icon="" label="Rewind" active={view === '/year-review'} onClick={() => navigate('/year-review')} /> */}
          <SidebarBtn icon="" label="Матчи" active={view.startsWith('/matches')} onClick={() => navigate('/matches')} />
          <SidebarBtn icon="" label="Игроки" active={view.startsWith('/players') || view.startsWith('/player/')} onClick={() => navigate('/players')} />
          <SidebarBtn icon="" label="Миксер" active={view === '/teambuilder'} onClick={() => navigate('/teambuilder')} />
          <SidebarBtn icon="" label="Настройки" active={view === '/settings'} onClick={() => navigate('/settings')} />
        </div>

        <div className="sidebar-admin" onClick={toggleAdmin} style={{ cursor: 'pointer' }}>
          <div style={{ color: user ? themeColors.win : themeColors.textMuted, fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {user ? (user.display_name || user.email) : "Log In"}
          </div>
          {user ? (
            <div style={{ fontSize: '10px', color: themeColors.textMuted, marginTop: '4px', marginBottom: '12px' }}>
              {user.role === 'admin' ? 'ADMINISTRATOR' : 'USER'}
            </div>
          ) : null}
          {isAdmin && (
            <label className="btn-hover" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: themeColors.accent, color: 'white', padding: '12px',
              borderRadius: '12px', cursor: 'pointer', fontWeight: '800', fontSize: '12px',
              boxShadow: `0 8px 20px ${themeColors.accent}40`, width: '100%',
              marginTop: '12px'
            }} onClick={(e) => e.stopPropagation()}>
              UPLOAD DEMO
              <input type="file" multiple accept=".dem" onChange={handleUpload} style={{ display: 'none' }} />
            </label>
          )}
        </div>
      </div>

      <div className="main-content" style={{ zoom: appScale }}>
        {/* Мобильный хэдер (скрыт на десктопе) */}
        <div className="adaptive-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ fontWeight: '900', fontSize: '22px', letterSpacing: '-1px' }}>573</div>
            {isAdmin && (
              <label style={{ background: themeColors.accent, borderRadius: '10px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: '#000', cursor: 'pointer' }}>
                ADD <input type="file" multiple accept=".dem" onChange={handleUpload} style={{ display: 'none' }} />
              </label>
            )}
          </div>

          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            {user && (
              <div
                onClick={() => navigate(`/player/${user.steamid || user.display_name}`)}
                className="btn-hover"
                style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden'
                }}
              >
                {user.avatar ? (
                  <img src={user.avatar} alt="pfp" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: themeColors.accent }}>
                    {user.display_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase()}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div key={view} className="fade-in" style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </div>

      <GlobalBanners />
      <PoopOverlay />
    </div>
  );
}

function App() {
  const { setMatches, setAliases, setMerges, setLoading } = useAppStore();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true, "Синхронизация с Firestore...");
      try {
        const matchesCollection = collection(db, 'matches');
        const matchesSnapshot = await getDocs(query(matchesCollection, orderBy('upload_date', 'desc')));
        const matchesData = matchesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as DemoResponse[];
        setMatches(matchesData);

        const aliasesDoc = await getDoc(doc(db, 'settings', 'aliases'));
        if (aliasesDoc.exists()) { setAliases(aliasesDoc.data() as Record<string, string>); }

        const mergesDoc = await getDoc(doc(db, 'settings', 'merges'));
        if (mergesDoc.exists()) { setMerges(mergesDoc.data() as Record<string, string>); }
      } catch (error) {
        console.error("Error fetching data: ", error);
      } finally {
        setTimeout(() => setLoading(false), 800);
      }
    };
    fetchData();
  }, [setMatches, setAliases, setMerges, setLoading]);

  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<GlobalDashboard />} />
          <Route path="/matches" element={<MatchesView />} />
          <Route path="/matches/:id" element={<MatchAnalysisView />} />
          <Route path="/players" element={<GlobalPlayersView />} />
          <Route path="/player/:id" element={<PlayerProfileView />} />
          <Route path="/teambuilder" element={<TeamBuilderView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/year-review" element={<YearReviewView />} />
          <Route path="/auth" element={<AuthView />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default App;