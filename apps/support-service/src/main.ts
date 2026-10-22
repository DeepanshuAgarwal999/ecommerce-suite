import { bootstrap } from '@ecommerce/common';
import { ServiceNames } from '@ecommerce/contracts';
import { AppModule } from './app/app.module';

void bootstrap(AppModule, {
  serviceName: ServiceNames.SUPPORT,
  // HTTP only for liveness/readiness; the gateway talks to it over TCP.
  http: true,
  microservice: true,
});
