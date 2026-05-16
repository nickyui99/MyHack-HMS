import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ActiveCaseProvider } from '@/lib/activeCase';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ActiveCaseProvider>
        <App />
      </ActiveCaseProvider>
    </BrowserRouter>
  </React.StrictMode>
);
