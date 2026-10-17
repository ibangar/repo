import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'

const Router = import.meta.env.VITE_TARGET === 'artifact' ? HashRouter : BrowserRouter
import { Nav } from './components/Nav'
import { useSettings } from './hooks/useSettings'
import { setHaptics } from './lib/haptics'
import { setSound } from './lib/sound'
import { LockGate } from './screens/Lock'

const Today = lazy(() => import('./screens/Today'))
const Workout = lazy(() => import('./screens/workout/Workout'))
const WorkoutSummary = lazy(() => import('./screens/workout/WorkoutSummary'))
const Exercises = lazy(() => import('./screens/Exercises'))
const ExerciseDetail = lazy(() => import('./screens/ExerciseDetail'))
const Photos = lazy(() => import('./screens/photos/Photos'))
const Capture = lazy(() => import('./screens/photos/Capture'))
const Compare = lazy(() => import('./screens/photos/Compare'))
const Timelapse = lazy(() => import('./screens/photos/Timelapse'))
const Progress = lazy(() => import('./screens/progress/Progress'))
const Body = lazy(() => import('./screens/progress/Body'))
const Nutrition = lazy(() => import('./screens/progress/Nutrition'))
const CheckIn = lazy(() => import('./screens/progress/CheckIn'))
const Settings = lazy(() => import('./screens/settings/Settings'))
const ProgramEditor = lazy(() => import('./screens/settings/ProgramEditor'))
const DataScreen = lazy(() => import('./screens/settings/Data'))
const Onboarding = lazy(() => import('./screens/Onboarding'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0 }) }, [pathname])
  return null
}

function Shell() {
  const settings = useSettings()
  const { pathname } = useLocation()
  useEffect(() => { if (settings) { setHaptics(settings.vibrateOn); setSound(settings.soundOn) } }, [settings?.vibrateOn, settings?.soundOn, settings])
  if (!settings) return <div className="app" />
  if (!settings.onboarded && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  return (
    <LockGate settings={settings}>
      <div className="app">
        <ScrollToTop />
        <Suspense fallback={<div className="page" />}>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/workout" element={<Workout />} />
            <Route path="/workout/summary/:id" element={<WorkoutSummary />} />
            <Route path="/exercises" element={<Exercises />} />
            <Route path="/exercises/:id" element={<ExerciseDetail />} />
            <Route path="/photos" element={<Photos />} />
            <Route path="/photos/capture" element={<Capture />} />
            <Route path="/photos/compare" element={<Compare />} />
            <Route path="/photos/timelapse" element={<Timelapse />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/progress/body" element={<Body />} />
            <Route path="/progress/nutrition" element={<Nutrition />} />
            <Route path="/progress/checkin" element={<CheckIn />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/program" element={<ProgramEditor />} />
            <Route path="/settings/data" element={<DataScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Nav />
      </div>
    </LockGate>
  )
}

export default function App() {
  return (
    <Router>
      <Shell />
    </Router>
  )
}
