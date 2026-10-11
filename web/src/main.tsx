import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';

import { MantineProvider, createTheme } from '@mantine/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './ui/App';

const theme = createTheme({
  primaryColor: 'grape',
  defaultRadius: 'md',
});

const root = document.getElementById('root');
if (root === null) {
  throw new Error('missing #root element');
}

createRoot(root).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <App />
    </MantineProvider>
  </StrictMode>,
);
