import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Los campos de fecha abren el calendario al pulsar en cualquier parte del
// campo, no solo en el icono.
document.addEventListener('click', (e) => {
  const input = e.target;
  if (input instanceof HTMLInputElement && (input.type === 'date' || input.type === 'month')) {
    try {
      input.showPicker();
    } catch {
      // Navegadores sin showPicker: queda el comportamiento nativo.
    }
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
