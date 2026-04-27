import { Module } from '@nestjs/common';
import { CalendarMcp } from './calendar.mcp';
import { EhrMcp } from './ehr.mcp';
import { MCPRegistry } from './mcp-registry.service';
import { TasksMcp } from './tasks.mcp';

@Module({
  providers: [CalendarMcp, TasksMcp, EhrMcp, MCPRegistry],
  exports: [MCPRegistry, CalendarMcp, TasksMcp, EhrMcp],
})
export class McpModule {}
