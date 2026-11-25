import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { VerificationModule } from './modules/verification/verification.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { RidesModule } from './modules/rides/rides.module';
import { MatchingModule } from './modules/matching/matching.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { SupportModule } from './modules/support/support.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [AuthModule, UsersModule, CustomersModule, DriversModule, VehiclesModule, VerificationModule, SubscriptionsModule, PricingModule, RidesModule, MatchingModule, PaymentsModule, WalletModule, NotificationsModule, RatingsModule, SupportModule, AdminModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
