import { AppProviders } from './providers'
import { AppRouter } from './router'
import './styles/index.css'

/**
 * Корень SPA: store и два маршрута.
 * @returns Дерево приложения.
 */
export function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  )
}
