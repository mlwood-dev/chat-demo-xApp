import React, { useState } from 'react';
import type { XamanUserInfo } from '../types';
import { getHomeserverUrl } from '../services/matrixClient';

interface LoginProps {
  onLogin: (jwt: string, homeserverUrl: string) => void;
  loading: boolean;
  error: string | null;
  xamanInfo: XamanUserInfo;
}

export function Login({ onLogin, loading, error, xamanInfo }: LoginProps) {
  const [jwt, setJwt] = useState('');
  const [homeserver, setHomeserver] = useState(getHomeserverUrl());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jwt.trim() || !homeserver.trim()) return;
    onLogin(jwt.trim(), homeserver.trim());
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Matrix xApp</h1>
          <p className="login-subtitle">
            Connect to your Matrix homeserver via JWT
          </p>
        </div>

        {xamanInfo.isXaman && xamanInfo.address && (
          <div className="xaman-info">
            <span className="xaman-label">XRPL Account</span>
            <span className="xaman-address">{xamanInfo.address}</span>
            {xamanInfo.networkType && (
              <span className="xaman-network">{xamanInfo.networkType}</span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="homeserver">Homeserver URL</label>
            <input
              id="homeserver"
              type="url"
              value={homeserver}
              onChange={(e) => setHomeserver(e.target.value)}
              placeholder="https://your-synapse-server.com"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="jwt">JWT Token</label>
            <textarea
              id="jwt"
              value={jwt}
              onChange={(e) => setJwt(e.target.value)}
              placeholder="Paste your JWT token here..."
              rows={4}
              disabled={loading}
              required
            />
            <span className="form-hint">
              JWT must contain a &quot;sub&quot; claim matching a Matrix user localpart
            </span>
          </div>

          {error && (
            <div className="error-banner">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !jwt.trim()}
          >
            {loading ? 'Connecting...' : 'Login with JWT'}
          </button>
        </form>
      </div>
    </div>
  );
}
