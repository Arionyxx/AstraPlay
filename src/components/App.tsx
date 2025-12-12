import React, { useState } from 'react';
import { HomeScreen } from './home/HomeScreen';
import { ProviderConfigDialog } from './providers/ProviderConfigDialog';
import '../styles/galactic.css';

type Screen = 'home' | 'library' | 'search' | 'settings';

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [showProviderDialog, setShowProviderDialog] = useState(false);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen />;
      case 'library':
        return (
          <div>
            <h1 className="section-title">Library</h1>
            <p className="section-subtitle">Your personal media collection</p>
          </div>
        );
      case 'search':
        return (
          <div>
            <h1 className="section-title">Search</h1>
            <p className="section-subtitle">Find movies, series, and anime</p>
          </div>
        );
      case 'settings':
        return (
          <div>
            <h1 className="section-title">Settings</h1>
            <p className="section-subtitle">Configure AstraPlay</p>
            <div style={{ marginTop: '32px' }}>
              <button
                className="button button-primary"
                onClick={() => setShowProviderDialog(true)}
              >
                🔐 Configure Real-Debrid
              </button>
            </div>
          </div>
        );
      default:
        return <HomeScreen />;
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo">⭐ AstraPlay</div>
        
        <ul className="nav-menu">
          <li
            className={`nav-item ${currentScreen === 'home' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('home')}
          >
            <span>🏠</span>
            <span>Home</span>
          </li>
          <li
            className={`nav-item ${currentScreen === 'search' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('search')}
          >
            <span>🔍</span>
            <span>Search</span>
          </li>
          <li
            className={`nav-item ${currentScreen === 'library' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('library')}
          >
            <span>📚</span>
            <span>Library</span>
          </li>
          <li
            className={`nav-item ${currentScreen === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('settings')}
          >
            <span>⚙️</span>
            <span>Settings</span>
          </li>
        </ul>

        <div style={{
          padding: '16px',
          background: 'rgba(139, 92, 246, 0.1)',
          borderRadius: '12px',
          fontSize: '13px',
          color: 'var(--star-dim)',
          textAlign: 'center',
        }}>
          <div style={{ marginBottom: '4px', fontWeight: 600 }}>AstraPlay v1.0.0</div>
          <div>Electron Desktop Edition</div>
        </div>
      </aside>

      <main className="main-content">
        {renderScreen()}
      </main>

      <ProviderConfigDialog
        isOpen={showProviderDialog}
        onClose={() => setShowProviderDialog(false)}
      />
    </div>
  );
};
