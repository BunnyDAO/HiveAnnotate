import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { BundleTools } from './tools.ts'

function asText(value: unknown): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

export function createServer(root: string): McpServer {
  const tools = new BundleTools(root)
  const server = new McpServer({ name: 'hiveannotate', version: '0.1.0' })

  server.registerTool(
    'list_bundles',
    {
      title: 'List bundles',
      description:
        'Open HiveAnnotate bundles, newest first. A bundle is one problem: an intent plus the screenshots that evidence it.',
      inputSchema: {},
    },
    async () => asText(await tools.listBundles()),
  )

  server.registerTool(
    'get_bundle',
    {
      title: 'Get a bundle',
      description:
        "A bundle's intent, its captures and their notes, with absolute paths to the image files. Read the images from those paths.",
      inputSchema: { id: z.string().describe('The bundle id, as returned by list_bundles.') },
    },
    async ({ id }) => asText(await tools.getBundle(id)),
  )

  server.registerTool(
    'close_bundle',
    {
      title: 'Close a bundle',
      description:
        'Mark a bundle handled once the work has landed, so it stops appearing in the catalogue.',
      inputSchema: { id: z.string().describe('The bundle id to close.') },
    },
    async ({ id }) => asText(await tools.closeBundle(id)),
  )

  return server
}
