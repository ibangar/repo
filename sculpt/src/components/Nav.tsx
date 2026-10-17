import { NavLink, useLocation } from 'react-router-dom'
import { IconCamera, IconChart, IconDumbbell, IconHome, IconSettings } from './ui/Icons'
import { haptic } from '../lib/haptics'

const items = [
  { to: '/', label: 'Today', icon: IconHome, exact: true },
  { to: '/exercises', label: 'Moves', icon: IconDumbbell },
  { to: '/photos', label: 'Photos', icon: IconCamera },
  { to: '/progress', label: 'Progress', icon: IconChart },
  { to: '/settings', label: 'Settings', icon: IconSettings },
]

const HIDDEN_PREFIXES = ['/workout', '/onboarding', '/photos/capture', '/lock']

export function Nav() {
  const { pathname } = useLocation()
  if (HIDDEN_PREFIXES.some(p => pathname.startsWith(p))) return null
  return (
    <nav className="nav" aria-label="Main">
      {items.map(({ to, label, icon: Icon, exact }) => (
        <NavLink key={to} to={to} end={exact} className={({ isActive }) => `nav__item ${isActive ? 'nav__item--on' : ''}`} onClick={() => haptic.tap()}>
          {({ isActive }) => (<>{isActive && <span className="nav__dot" />}<Icon />{label}</>)}
        </NavLink>
      ))}
    </nav>
  )
}
