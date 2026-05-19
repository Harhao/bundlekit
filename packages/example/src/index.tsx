import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

const App: React.FC = () => {

    const [count, setCount] = useState(0);

    const handleClick = () => {
        setCount((prev) => {
            return prev + 1;
        });
    }

  return (
    <div>
      <h1>
        <span>Hello, React1 {count}!</span>
        <button onClick={handleClick}>Click me</button>
      </h1>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
