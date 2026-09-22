import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { LoginHistoryController } from './login-history.controller';
import { LoginHistory } from './login-history.entity';
import { LoginHistoryService } from './login-history.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoginHistory]),
    forwardRef(() => AuthModule),
  ],
  controllers: [LoginHistoryController],
  providers: [LoginHistoryService],
  exports: [LoginHistoryService],
})
export class LoginHistoryModule {}
