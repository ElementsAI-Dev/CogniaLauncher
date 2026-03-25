import React from 'react';
import { render } from 'ink';

import {
  HelloWorldInkApp,
  createHelloWorldInkSnapshot,
} from './ink-app';

const input = process.argv.slice(2).join(' ');
const snapshot = createHelloWorldInkSnapshot({ input });

render(<HelloWorldInkApp snapshot={snapshot} />);
