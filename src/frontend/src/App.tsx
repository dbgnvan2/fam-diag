import './App.css';
import DiagramEditor from './components/DiagramEditor';
import EventCreator from './components/EventCreator';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const mode =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('mode')
      : null;

  if (mode === 'event-creator') {
    return (
      <ErrorBoundary>
        <EventCreator />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="App">
        <DiagramEditor />
      </div>
    </ErrorBoundary>
  );
}

export default App;
