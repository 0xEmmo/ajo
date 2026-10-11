import { Link } from 'react-router'
import { Icon } from '../ui/Icon'
import { photoCredits } from './credits'
import './pages.css'

export function Credits() {
  return (
    <main id="main" className="page-narrow credits">
      <Link to="/" className="back">
        <Icon name="back" size={18} /> Your circles
      </Link>
      <h1 className="display">Photo credits</h1>
      <p className="muted">
        The people in the demo circle are made up. Their photos are real, freely licensed images from Wikimedia Commons, resized and cropped, and used under{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.
      </p>
      <ul className="credit-list">
        {photoCredits.map((c) => (
          <li key={c.file}>
            <img src={`/photos/${c.file}`} alt="" width="56" height="56" loading="lazy" />
            <div>
              <b>{c.as}</b>
              <span>
                Photo by {c.author} · <a href={c.source}>Wikimedia Commons</a> · {c.licence}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
