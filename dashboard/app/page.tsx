import { redirect } from 'next/navigation';

// Dashboard-builden är monterad bakom /watcher/* via Vercel rewrites.
// Den här root-sidan nås bara i lokal dev (npm run dev) — då skickar
// vi vidare till onboardingen. På kammaren.nu serveras / fortfarande
// av public/index.html.
export default function DashboardRoot(): never {
  redirect('/watcher/start');
}
