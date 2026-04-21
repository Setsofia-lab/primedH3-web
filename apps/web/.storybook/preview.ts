import type { Preview } from '@storybook/react';
import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: {
      default: 'surface-50',
      values: [
        { name: 'surface-0', value: '#FFFFFF' },
        { name: 'surface-50', value: '#F5F7FE' },
        { name: 'ink-900', value: '#0A1628' },
      ],
    },
  },
};
export default preview;
