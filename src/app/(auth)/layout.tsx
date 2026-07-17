import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary-50 to-background p-4 dark:from-primary-900/20">
      <Link
        href="/"
        className="mb-8 text-xl font-semibold tracking-tight"
      >
        <span className="text-primary-500">●</span> Tontine Platform
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}
