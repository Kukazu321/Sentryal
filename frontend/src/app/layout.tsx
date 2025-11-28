import './globals.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '../../context/AuthProvider';
import AppShell from '@/components/Shell/AppShell';

export const metadata = {
  title: 'Sentryal - InSAR Monitoring',
  description: 'Ultra-high performance InSAR deformation monitoring platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="bg-background text-foreground">
      <body className="antialiased">
        <AuthProvider>
          <QueryProvider>
            <AppShell>
              {children}
            </AppShell>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
