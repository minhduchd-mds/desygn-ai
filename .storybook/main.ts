import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    '../ui/docs/**/*.mdx',
    '../ui/components/**/*.stories.@(ts|tsx)',
    '../web/src/stories/**/*.stories.@(ts|tsx)',
    '../packages/ui/stories/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
  ],
  framework: '@storybook/react-vite',
  docs: {
    defaultName: 'Documentation',
  },
  staticDirs: ['../public'],
};

export default config;
