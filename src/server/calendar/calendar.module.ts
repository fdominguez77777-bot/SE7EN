import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { CalendarAccount } from './calendar-account.entity';
import { CalendarConnectLink } from './calendar-connect-link.entity';
import { CalendarController } from './calendar.controller';
import { CalendarOauthController } from './calendar-oauth.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CalendarAccount, CalendarConnectLink]),
    AuthModule,
    UsersModule,
  ],
  controllers: [CalendarController, CalendarOauthController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
