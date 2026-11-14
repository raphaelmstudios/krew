import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { startMotion } from './motion.js'

// Scroll reveals, parallax, magnetic buttons and click ripples (see motion.js). Started
// before the first render so revealed content never flashes in and then hides again.
startMotion()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)