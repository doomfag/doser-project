import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>Doser</h1>
        <p>
          Não foi possível abrir esta tela. Seus dados locais foram preservados.
        </p>
        <button onClick={() => location.reload()}>Recarregar</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
document.getElementById("doser-platform-notice")?.remove();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
