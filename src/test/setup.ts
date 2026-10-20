import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// findBy*/waitFor wait up to 5 s (default 1 s). On a loaded machine jsdom renders slowly, and the
// 1 s default made unrelated tests fail at random. This only changes how long they wait.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => cleanup());
