<script lang="ts">
  import { setContext, type Component } from 'svelte';
  import type { PageContext } from 'vike-lite';
  import { pageContextKey, type InternalContextValue } from '../../shared/globalContext';

  interface Props {
    pageContext: PageContext;
    Content: Component;
    /** Omitted when rendering Head (which never has a Layout). */
    Layout?: Component;
  }

  let { pageContext, Content, Layout }: Props = $props();

  // Use a getter to ensure that the context always reads
  // the updated value of the pageContext prop!
  setContext(pageContextKey, {
    get pageContext() {
      return pageContext;
    },
  } satisfies InternalContextValue);
</script>

{#if Layout}
  <Layout>
    <Content />
  </Layout>
{:else}
  <Content />
{/if}
