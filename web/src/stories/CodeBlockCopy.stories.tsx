/**
 * CodeBlockCopy component stories.
 *
 * Demonstrates the v0.dev-style copy button on code blocks.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeBlockCopyContainer } from "../workspace/CodeBlockCopy";

const meta: Meta<typeof CodeBlockCopyContainer> = {
  title: "Components/CodeBlockCopy",
  component: CodeBlockCopyContainer,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof CodeBlockCopyContainer>;

const sampleCode = `<pre><code class="hljs language-typescript">import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

const { data, error } = await supabase
  .from('designs')
  .select('*')
  .eq('user_id', userId)</code></pre>`;

const multiBlock = `<p>Here's the setup:</p>
<pre><code class="hljs language-bash">npm install @designready/cli
npx designready init</code></pre>
<p>Then generate your Design.md:</p>
<pre><code class="hljs language-typescript">import { generateDesignMd } from '@designready/core'

const result = await generateDesignMd({
  template: 'saas-dashboard',
  components: scanResult,
})</code></pre>`;

export const SingleBlock: Story = {
  args: {
    html: sampleCode,
    className: "message-markdown",
  },
};

export const MultipleBlocks: Story = {
  args: {
    html: multiBlock,
    className: "message-markdown",
  },
};
