import type { Preview } from '@storybook/react-vite';
import '../ui.css';
import '../../../apps/web/src/app/globals.css';

const preview: Preview = {
  parameters: { layout: 'padded' },
};

export default preview;
