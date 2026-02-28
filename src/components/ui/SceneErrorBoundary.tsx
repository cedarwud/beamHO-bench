import { Component, type ErrorInfo, type ReactNode } from 'react';

interface SceneErrorBoundaryProps {
  children: ReactNode;
}

interface SceneErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): SceneErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Unknown scene error',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 留下錯誤紀錄方便上報或串接監控服務
    console.error('3D scene render error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="scene-error-overlay" role="alert">
          <h2 className="scene-error-overlay__title">3D Scene Failed to Load</h2>
          <p className="scene-error-overlay__message">{this.state.message}</p>
          <button
            type="button"
            className="scene-error-overlay__button"
            onClick={this.handleReload}
          >
            Reload Scene
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
