import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      success: true,
      message: 'Survivor server is running',
      timestamp: Date.now(),
    };
  }
}
