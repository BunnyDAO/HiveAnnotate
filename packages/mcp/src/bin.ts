#!/usr/bin/env node
/**
 * The stdio entry point. Claude Code (or any MCP client) spawns this itself;
 * nothing listens, nothing polls, and HiveAnnotate does not need to be running.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { defaultBundleRoot } from '@hiveannotate/core'
import { createServer } from './server.ts'

const server = createServer(defaultBundleRoot())
await server.connect(new StdioServerTransport())
