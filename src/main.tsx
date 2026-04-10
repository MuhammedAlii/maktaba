import { createRoot } from 'react-dom/client'
import 'sweetalert2/dist/sweetalert2.min.css'
import 'react-datepicker/dist/react-datepicker.css'
import 'leaflet/dist/leaflet.css'
import './leaflet-overrides.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(<App />)
