import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';
import GlobalStyle from './style/global';
import styled from 'styled-components';

const Wrapper = styled.div`
  width: 100%;
  height: 100%;
`;

// Register Service Worker to block external HTTP requests
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw-external-blocker.js')
      .then((registration) => {
        console.log('🔒 External Request Blocker SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('🔒 External Request Blocker SW registration failed: ', registrationError);
      });
  });
}

ReactDOM.render(
  <Wrapper>
    <GlobalStyle />
    <App />
  </Wrapper>,
  document.getElementById('root'),
);
