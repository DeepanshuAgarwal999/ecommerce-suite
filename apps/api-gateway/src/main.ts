import { bootstrap } from '@ecommerce/common';
import { ServiceNames } from '@ecommerce/contracts';
import { AppModule } from './app/app.module';

void bootstrap(AppModule, {
  serviceName: ServiceNames.API_GATEWAY,
  http: true,
  microservice: false,
  swagger: {
    title: 'Ecommerce Platform API',
    description:
      'Mobile-first commerce backend. Authenticate with an OTP, then send the access token ' +
      'as `Authorization: Bearer <token>`. All money values are integer paise.',
    version: '1.0.0',
  },
  // Enables raw-body capture for HMAC verification of Razorpay webhooks.
  rawBodyRoutes: ['/api/v1/payments/webhooks/razorpay'],
});
