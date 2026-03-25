import React from 'react';
import { render } from 'ink';

import {
  EnvProviderAuditInkApp,
  createEnvProviderAuditInkSnapshot,
} from './ink-app';

const snapshot = createEnvProviderAuditInkSnapshot();

render(<EnvProviderAuditInkApp snapshot={snapshot} />);
