import { redirect } from 'next/navigation'

export default function Home() {
  // Le proxy renvoie déjà les visiteurs non authentifiés vers /login.
  redirect('/dashboard')
}
