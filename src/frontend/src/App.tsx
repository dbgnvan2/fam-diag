import './App.css';
import DiagramEditor from './components/DiagramEditor';
import EventCreator from './components/EventCreator';

function App() {
  const mode =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('mode')
      : null;

  if (mode === 'event-creator') {
    return <EventCreator />;
  }

  return (
    <div className="App">
      <h1>Family Diagram</h1>
      <DiagramEditor />
    </div>
  );
}

export default App;
