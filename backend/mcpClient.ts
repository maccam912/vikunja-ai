import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import process from "node:process";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export class VikunjaMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private tools: MCPTool[] = [];
  private connected: boolean = false;

  constructor(
    private vikunjaUrl: string,
    private vikunjaToken: string,
  ) {}

  /**
   * Normalize Vikunja URL to ensure it includes /api/v1
   */
  private normalizeUrl(url: string): string {
    let cleaned = url.trim().replace(/\/+$/, "");
    // Remove /api/v1 if it exists
    if (cleaned.endsWith("/api/v1")) {
      cleaned = cleaned.substring(0, cleaned.length - 7);
    }
    // Add /api/v1 back
    return `${cleaned}/api/v1`;
  }

  /**
   * Initialize connection to the Vikunja MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // Normalize URL to include /api/v1
      const normalizedUrl = this.normalizeUrl(this.vikunjaUrl);
      console.log(`[MCP] Connecting to Vikunja: ${normalizedUrl}`);

      // Create stdio transport for MCP server
      this.transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@democratize-technology/vikunja-mcp"],
        env: {
          ...process.env,
          VIKUNJA_URL: normalizedUrl,
          VIKUNJA_API_TOKEN: this.vikunjaToken,
        },
      });

      this.client = new Client(
        {
          name: "vikunja-ai-backend",
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );

      await this.client.connect(this.transport);

      // Discover available tools
      const toolsResponse = await this.client.listTools();
      this.tools = toolsResponse.tools.map((tool: {
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
      }) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      this.connected = true;
      console.log(
        `[MCP] Connected to Vikunja MCP server. Available tools: ${this.tools.length}`,
      );
    } catch (error) {
      console.error("[MCP] Failed to connect:", error);
      throw new Error(`MCP connection failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get list of available tools from MCP server
   */
  getTools(): MCPTool[] {
    return this.tools;
  }

  /**
   * Execute a tool call via MCP server
   */
  async executeTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.connected || !this.client) {
      throw new Error("MCP client not connected");
    }

    try {
      console.log(`[MCP] Executing tool: ${name}`, args);
      const result = await this.client.callTool({
        name,
        arguments: args,
      });

      console.log(`[MCP] Tool result:`, result);
      return result;
    } catch (error) {
      console.error(`[MCP] Tool execution failed:`, error);
      throw new Error(`Tool ${name} failed: ${(error as Error).message}`);
    }
  }

  /**
   * Convert MCP tools to OpenAI function calling format
   */
  getOpenAIFunctions(): Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    return this.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  /**
   * Close the MCP connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.transport = null;
      this.connected = false;
      console.log("[MCP] Disconnected from Vikunja MCP server");
    }
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}
