import React, { useState, useEffect } from 'react';
import type { ProviderAccount, ProviderStatus } from '../../types/provider';

interface ProviderConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProviderConfigDialog: React.FC<ProviderConfigDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [account, setAccount] = useState<ProviderAccount | null>(null);
  const [status, setStatus] = useState<ProviderStatus | null>(null);

  useEffect(() => {
    if (isOpen) {
      checkProviderStatus();
    }
  }, [isOpen]);

  const checkProviderStatus = async () => {
    try {
      const providerStatus = await window.electron.invoke('debrid:status', {
        providerId: 'real-debrid',
      });
      setStatus(providerStatus);
    } catch {
      console.log('Provider not authenticated yet');
    }
  };

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await window.electron.invoke('debrid:authenticate', {
        providerId: 'real-debrid',
        apiKey: apiKey.trim(),
      });

      setAccount(result);
      setSuccess(true);
      setApiKey('');
      
      await checkProviderStatus();

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Real-Debrid Configuration</h2>
          <p style={{ color: 'var(--star-dim)', marginTop: '8px' }}>
            Configure your Real-Debrid account for premium streaming
          </p>
        </div>

        {status && status.online && (
          <div className="success-message">
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>✓ Connected</div>
            <div style={{ fontSize: '14px' }}>
              Premium Status: {status.premium ? 'Active' : 'Inactive'}
              {status.expiresAt && (
                <span> • Expires: {new Date(status.expiresAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="error-message">
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>⚠ Error</div>
            <div style={{ fontSize: '14px' }}>{error}</div>
          </div>
        )}

        {success && (
          <div className="success-message">
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>✓ Success</div>
            <div style={{ fontSize: '14px' }}>
              Successfully authenticated with Real-Debrid
              {account && ` as ${account.username}`}
            </div>
          </div>
        )}

        <form onSubmit={handleAuthenticate}>
          <div style={{ marginBottom: '24px' }}>
            <label
              htmlFor="apiKey"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              API Key
            </label>
            <input
              id="apiKey"
              type="password"
              className="input"
              placeholder="Enter your Real-Debrid API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={loading}
            />
            <div style={{ fontSize: '13px', color: 'var(--star-dim)', marginTop: '8px' }}>
              Get your API key from{' '}
              <a
                href="https://real-debrid.com/apitoken"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--nebula-purple)' }}
              >
                real-debrid.com/apitoken
              </a>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                  Authenticating...
                </>
              ) : (
                'Authenticate'
              )}
            </button>
          </div>
        </form>

        <div style={{
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid rgba(139, 92, 246, 0.2)',
        }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px', fontWeight: 600 }}>
            What is Real-Debrid?
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--star-dim)', lineHeight: '1.6' }}>
            Real-Debrid is a premium unrestricted downloader that allows you to instantly stream
            torrents without waiting. It provides high-speed, secure access to content with
            multi-hoster support and no upload requirements.
          </p>
        </div>
      </div>
    </div>
  );
};
