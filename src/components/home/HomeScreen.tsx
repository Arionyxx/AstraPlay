import React, { useEffect, useState } from 'react';
import type { WatchProgress } from '../../types/media';
import type { Episode, MediaItem } from '../../types/media';

interface ContinueWatchingItem extends WatchProgress {
  media: MediaItem;
  episode?: Episode;
}

export const HomeScreen: React.FC = () => {
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContinueWatching();
  }, []);

  const loadContinueWatching = async () => {
    try {
      const items = await window.electron.invoke('progress:get-continue-watching', { limit: 10 });
      setContinueWatching(items);
    } catch (error) {
      console.error('Failed to load continue watching:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatProgress = (progress: number, duration: number): string => {
    const percentage = (progress / duration) * 100;
    return `${Math.round(percentage)}%`;
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <h1 className="section-title">Welcome to AstraPlay</h1>
        <p className="section-subtitle">Your premium media streaming hub</p>
      </div>

      {continueWatching.length > 0 && (
        <>
          <h2 style={{ fontSize: '24px', marginBottom: '16px', marginTop: '32px' }}>
            Continue Watching
          </h2>
          <div className="card-grid">
            {continueWatching.map((item) => (
              <div key={item.id} className="media-card">
                {item.media.posterUrl && (
                  <img
                    src={item.media.posterUrl}
                    alt={item.media.title}
                    className="media-card-image"
                  />
                )}
                {!item.media.posterUrl && (
                  <div className="media-card-image" style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '48px',
                    opacity: 0.3
                  }}>
                    🎬
                  </div>
                )}
                
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: 'rgba(139, 92, 246, 0.2)',
                }}>
                  <div style={{
                    height: '100%',
                    width: formatProgress(item.progress, item.duration),
                    background: 'linear-gradient(90deg, var(--nebula-purple), var(--nebula-blue))',
                  }}></div>
                </div>

                <div className="media-card-content">
                  <div className="media-card-title">{item.media.title}</div>
                  {item.episode && (
                    <div style={{ fontSize: '13px', color: 'var(--star-dim)', marginBottom: '4px' }}>
                      S{item.episode.seasonNumber}E{item.episode.episodeNumber} - {item.episode.name}
                    </div>
                  )}
                  <div className="media-card-meta">
                    <span>{formatTime(item.duration - item.progress)} left</span>
                    <span>{item.media.year}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {continueWatching.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '80px 20px',
          color: 'var(--star-dim)',
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.5 }}>🚀</div>
          <h3 style={{ fontSize: '24px', marginBottom: '8px' }}>Ready for Launch</h3>
          <p>Start exploring the galaxy of entertainment</p>
        </div>
      )}

      <div style={{ marginTop: '48px' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <button className="button button-primary">
            🔍 Search Media
          </button>
          <button className="button button-secondary">
            📚 Browse Library
          </button>
          <button className="button button-secondary">
            ⚙️ Settings
          </button>
        </div>
      </div>
    </div>
  );
};
