import { lazy, Suspense } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { configured, problem } from './lib/supabase.js';
import { SiteProvider } from './lib/site.jsx';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Services from './pages/Services.jsx';
import Queue from './pages/Queue.jsx';
import Gallery from './pages/Gallery.jsx';
import Reviews from './pages/Reviews.jsx';
import Contact from './pages/Contact.jsx';
import { Loading } from './components/ui.jsx';
import { EnvSetup } from './pages/Setup.jsx';

// Admin code is only downloaded when the owner opens /admin.
const AdminApp = lazy(() => import('./pages/admin/AdminApp.jsx'));

export default function App() {
  if (!configured) return <EnvSetup problem={problem} />;
  return (
    <SiteProvider>
      <Routes>
        <Route path="/admin/*" element={<Suspense fallback={<div className="shop-wrap"><div className="shop"><Loading /></div></div>}><AdminApp /></Suspense>} />
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="services" element={<Services />} />
          <Route path="queue" element={<Queue />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="contact" element={<Contact />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </SiteProvider>
  );
}
