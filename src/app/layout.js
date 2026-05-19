import './globals.css';

export const metadata = {
  title: 'Directory Hunter',
  description: 'Niche discovery and evaluation for directory sites.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-ink-900 text-ink-100">
        {children}
      </body>
    </html>
  );
}
