import { Link } from 'react-router'
import './pages.css'

export function NotFound() {
  return (
    <main id="main" className="page-narrow">
      <h1 className="display">Nothing here</h1>
      <p className="muted">That page doesn't exist. Your circles are all still saved on this phone.</p>
      <p>
        <Link className="btn btn-primary" to="/">
          Back to your circles
        </Link>
      </p>
    </main>
  )
}
