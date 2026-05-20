import type { Preview } from '@storybook/react-vite';
import '../ui/styles/global.scss';
import '../packages/ui/src/tokens/tokens.css';
import '../packages/ui/src/primitives/primitives.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'figma-dark',
      values: [
        { name: 'figma-dark', value: '#2c2c2c' },
        { name: 'app-dark', value: '#0f1115' },
        { name: 'light', value: '#ffffff' },
      ],
    },
    layout: 'padded',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'aria-allowed-attr', enabled: true },
        ],
      },
    },
    options: {
      storySort: {
        order: ['Introduction', 'Components', 'Web', '*'],
      },
    },
  },
};

export default preview;
