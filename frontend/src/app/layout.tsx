import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Agent Security Gateway | Okta Demo',
  description: 'Demonstrating secure AI agent authentication with Okta Cross-App Access, Fine-Grained Authorization, and CIBA approval flows.',
  keywords: ['AI Agent', 'Okta', 'Security', 'Authentication', 'Authorization', 'MCP'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="noise-overlay" />
        {children}
      </body>
    </html>
  )
}
