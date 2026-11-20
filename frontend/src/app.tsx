import { effect } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { Route, LocationProvider, Router, lazy, useLocation } from 'preact-iso';
import { ConnectScreen } from './components/ConnectScreen';
import { Dock, TopTabs } from './components/Nav';
import { UpdateToast } from './components/UpdateToast';
import { Page } from './components/Page';
import { init } from './data/store';
import { meta, ready } from './data/state';
import { lang } from './i18n';
import { t } from './i18n';
import { watchTheme } from './theme';

const Today = lazy(() => import('./views/Today'));
const Entry = lazy(() => import('./views/Entry'));
const Chart = lazy(() => import('./views/Chart'));
const Calendar = lazy(() => import('./views/Calendar'));
const Stats = lazy(() => import('./views/Stats'));
const Settings = lazy(() => import('./views/Settings'));

effect(() => {
  document.documentElement.lang = lang.value;
});
watchTheme();

export function App() {
  useEffect(() => {
    void init();
  }, []);
  return (
    <LocationProvider>
      <Shell />
    </LocationProvider>
  );
}

function Shell() {
  const { path } = useLocation();
  if (!ready.value) return <div class="min-h-dvh bg-base-200" />;
  if (!meta.value.token) {
    return (
      <div class="min-h-dvh bg-base-200 text-base-content">
        <ConnectScreen />
        <UpdateToast />
      </div>
    );
  }
  return (
    <div class="min-h-dvh bg-base-200 text-base-content">
      <TopTabs path={path} />
      <main class="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 lg:pt-20 print:p-0">
        <Router>
          <Route path="/" component={Today} />
          <Route path="/entry/:date" component={Entry} />
          <Route path="/chart" component={Chart} />
          <Route path="/chart/:date" component={Chart} />
          <Route path="/calendar" component={Calendar} />
          <Route path="/stats" component={Stats} />
          <Route path="/settings" component={Settings} />
          <Route default component={NotFound} />
        </Router>
      </main>
      <Dock path={path} />
      <UpdateToast />
    </div>
  );
}

function NotFound() {
  return <Page title={t('app.notFound')} />;
}
