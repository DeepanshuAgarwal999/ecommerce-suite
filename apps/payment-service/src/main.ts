import { bootstrap } from '@ecommerce/common';
import { ServiceNames } from '@ecommerce/contracts';
import { AppModule } from './app/app.module';

void bootstrap(AppModule, {
  serviceName: ServiceNames.PAYMENT,
  // HTTP is enabled only so the container has liveness/readiness endpoints; the
  // service's real surface is the TCP transport the gateway talks to.
  http: true,
  microservice: true,
});
