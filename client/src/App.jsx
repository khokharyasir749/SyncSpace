import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Root Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-mono overflow-auto select-text z-50">
          <div className="max-w-2xl w-full bg-slate-900 border border-rose-500/40 p-6 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
              <h2 className="text-base font-bold uppercase tracking-wider">SyncSpace Application Error</h2>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl text-xs text-rose-300 font-mono overflow-x-auto whitespace-pre-wrap border border-slate-800">
              {this.state.error && this.state.error.toString()}
            </div>
            {this.state.errorInfo && (
              <details className="text-xs text-slate-400 cursor-pointer" open>
                <summary className="font-semibold text-slate-300 mb-2">Component Stack Trace</summary>
                <div className="bg-slate-950 p-3 rounded-xl text-[11px] font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap border border-slate-800 max-h-60">
                  {this.state.errorInfo.componentStack}
                </div>
              </details>
            )}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem('syncspace_active_view');
                  } catch (e) {}
                  window.location.href = '/';
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-md"
              >
                Reset View & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <RootErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <SocketProvider>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected Routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback wildcard redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </SocketProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </RootErrorBoundary>
  );
}

export default App;
