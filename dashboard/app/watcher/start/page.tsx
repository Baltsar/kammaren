import type { Metadata } from 'next';
import { OnboardingWizard } from '@/components/onboarding/wizard';

export const metadata: Metadata = {
  title: 'Onboarding — KAMMAREN Watcher',
  description:
    'Registrera ditt aktiebolag för regulatoriska Telegram-notiser. 30 sekunder.',
};

export default function StartPage(): JSX.Element {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-wizard">
        <OnboardingWizard />
      </div>
    </div>
  );
}
