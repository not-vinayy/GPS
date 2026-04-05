import React from 'react';

interface State { error: Error | null }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] bg-[#0a0a0a] px-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-5">
          <span className="text-rose-400 text-2xl">!</span>
        </div>
        <h2 className="text-white font-bold text-lg mb-2">Something went wrong</h2>
        <p className="text-[#555] text-sm mb-6 leading-relaxed">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-[#ff4500] text-white font-semibold rounded-2xl text-sm"
        >
          Reload App
        </button>
      </div>
    );
  }
}
