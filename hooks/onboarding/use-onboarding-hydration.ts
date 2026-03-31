'use client';

import { useEffect, useState } from 'react';
import { useOnboardingStore } from '@/lib/stores/onboarding';

type OnboardingPersistApi = {
  hasHydrated: () => boolean;
  onHydrate: (callback: (state: unknown) => void) => () => void;
  onFinishHydration: (callback: (state: unknown) => void) => () => void;
};

function getPersistApi(): OnboardingPersistApi | undefined {
  const store = useOnboardingStore as typeof useOnboardingStore & {
    persist?: OnboardingPersistApi;
  };
  return store.persist;
}

export function useOnboardingHydration(): boolean {
  const [isHydrated, setIsHydrated] = useState(() => {
    const persistApi = getPersistApi();
    return persistApi ? persistApi.hasHydrated() : true;
  });

  useEffect(() => {
    const persistApi = getPersistApi();
    if (!persistApi) {
      return;
    }

    const unsubHydrate = persistApi.onHydrate(() => setIsHydrated(false));
    const unsubFinishHydration = persistApi.onFinishHydration(() => setIsHydrated(true));

    return () => {
      unsubHydrate();
      unsubFinishHydration();
    };
  }, []);

  return isHydrated;
}
