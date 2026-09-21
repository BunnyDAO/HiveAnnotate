import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { About } from './About.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('renderer root element missing')

createRoot(root).render(
  <StrictMode>
    <About />
  </StrictMode>,
)
