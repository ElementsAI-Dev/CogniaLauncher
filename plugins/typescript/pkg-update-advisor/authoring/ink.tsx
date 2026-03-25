import React from 'react';
import { render } from 'ink';

import {
  PkgUpdateAdvisorInkApp,
  createPkgUpdateAdvisorInkSnapshot,
} from './ink-app';

const snapshot = createPkgUpdateAdvisorInkSnapshot();

render(<PkgUpdateAdvisorInkApp snapshot={snapshot} />);
