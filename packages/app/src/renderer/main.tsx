import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { About } from './About.tsx'
import { CaptureBar } from './CaptureBar.tsx'
import { RegionPicker } from './RegionPicker.tsx'
import { Catalogue } from './Catalogue.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('renderer root element missing')

// One renderer bundle, two surfaces: the always-present capture bar and the
// About window. The hash decides which, so there is one build and one preload.
const surface = window.location.hash.replace('#', '')

const view =
  surface === 'capture' ? (
    <CaptureBar />
  ) : surface === 'region' ? (
    <RegionPicker />
  ) : surface === 'catalogue' ? (
    <Catalogue />
  ) : (
    <About />
  )

createRoot(root).render(<StrictMode>{view}</StrictMode>)
