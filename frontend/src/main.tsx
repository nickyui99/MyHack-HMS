import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ActiveCaseProvider } from '@/lib/activeCase';
import { ChatProvider } from '@/lib/chat/ChatContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ActiveCaseProvider>
        <ChatProvider>
          <App />
        </ChatProvider>
      </ActiveCaseProvider>
    </BrowserRouter>
  </React.StrictMode>
);
