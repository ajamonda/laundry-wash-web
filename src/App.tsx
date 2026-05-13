import { useState } from 'react';
import type { AppStep, StaffSession } from './types';
import { useAppStore } from './store';
import { AppChrome } from './components/AppChrome';
import { LoginScreen } from './components/LoginScreen';
import { BagScanScreen } from './components/BagScanScreen';
import { BagItemsScreen } from './components/BagItemsScreen';
import { OrderSearchScreen } from './components/OrderSearchScreen';
import { ProcessingQueueScreen } from './components/ProcessingQueueScreen';
import { StepScanScreen } from './components/StepScanScreen';
import { PackagingScreen } from './components/PackagingScreen';

export function App() {
  const { session, setSession } = useAppStore();
  const [step, setStep] = useState<AppStep>(() => (session ? 'bag-scan' : 'login'));
  const [bagBarcode, setBagBarcode] = useState<string | null>(null);

  function handleLoggedIn(nextSession: StaffSession) {
    setSession(nextSession);
    setStep('bag-scan');
  }

  function handleLogout() {
    setSession(null);
    setStep('login');
  }

  function handleScanBag(barcode: string) {
    setBagBarcode(barcode);
    setStep('bag-items');
  }

  return (
    <AppChrome onLogout={handleLogout} onNavigate={setStep} session={session} step={step}>
      {step === 'login' ? (
        <LoginScreen onLoggedIn={handleLoggedIn} />
      ) : null}

      {step === 'bag-scan' && session ? (
        <BagScanScreen
          session={session}
          onScanBag={handleScanBag}
          onGoToOrderSearch={() => setStep('order-search')}
          onGoToQueue={() => setStep('queue')}
          onGoToStepScan={() => setStep('step-scan')}
          onGoToPackaging={() => setStep('packaging')}
        />
      ) : null}

      {step === 'bag-items' && session && bagBarcode ? (
        <BagItemsScreen
          bagBarcode={bagBarcode}
          session={session}
          onBack={() => setStep('bag-scan')}
        />
      ) : null}

      {step === 'order-search' && session ? (
        <OrderSearchScreen
          session={session}
          onBack={() => setStep('bag-scan')}
        />
      ) : null}

      {step === 'queue' && session ? (
        <ProcessingQueueScreen
          session={session}
          onBack={() => setStep('bag-scan')}
          onGoToStepScan={() => setStep('step-scan')}
        />
      ) : null}

      {step === 'step-scan' && session ? (
        <StepScanScreen
          session={session}
          onBack={() => setStep('bag-scan')}
        />
      ) : null}

      {step === 'packaging' && session ? (
        <PackagingScreen
          session={session}
          onBack={() => setStep('bag-scan')}
        />
      ) : null}
    </AppChrome>
  );
}
