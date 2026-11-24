import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { StorageProvider } from './persistence/StorageProvider.tsx'
import { Root } from './Root.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StorageProvider>
      <Root />
    </StorageProvider>
  </StrictMode>,
)
