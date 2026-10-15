import { INestApplication, Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiVersion, Headers } from '@ecommerce/contracts';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { LoggingInterceptor } from '../interceptors/logging.interceptor';
import { TimeoutInterceptor } from '../interceptors/timeout.interceptor';
import { TransformInterceptor } from '../interceptors/transform.interceptor';

export interface BootstrapOptions {
  serviceName: string;
  /** Set for the gateway, which is the only service exposed over HTTP in production. */
  http?: boolean;
  /** Set for the eight domain services, which additionally listen for TCP RPC. */
  microservice?: boolean;
  swagger?: {
    title: string;
    description: string;
    version: string;
  };
  /** Handlers that need the unparsed body - Razorpay signature verification does. */
  rawBodyRoutes?: string[];
}

/** Validation settings shared by HTTP and RPC entry points. */
export const validationPipe = () =>
  new ValidationPipe({
    // Strip properties with no matching DTO field. Without this, a client can smuggle
    // `{ role: "ADMIN" }` into a profile update and Prisma will happily persist it.
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    validateCustomDecorators: true,
  });

/**
 * Boots a service.
 *
 * Every service shares the same edge behaviour - validation, error shape, logging,
 * graceful shutdown - so it lives here rather than being copy-pasted into nine
 * `main.ts` files that then drift apart.
 */
export async function bootstrap(
  module: unknown,
  options: BootstrapOptions,
): Promise<INestApplication> {
  const logger = new Logger(options.serviceName);

  const app = await NestFactory.create(module as never, {
    bufferLogs: true,
    // Razorpay signs the exact bytes it sent; re-serialising the parsed JSON would
    // change whitespace and key order and break every signature check.
    rawBody: Boolean(options.rawBodyRoutes?.length),
  });

  const config = app.get(ConfigService);
  const isProduction = config.get<boolean>('isProduction', false);

  app.useGlobalPipes(validationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TimeoutInterceptor(config),
    new TransformInterceptor(app.get(Reflector)),
  );

  // Runs shutdown hooks so Kafka consumers leave their group and Prisma closes its pool
  // before the process exits. Without it a rolling deploy drops in-flight work.
  app.enableShutdownHooks();

  if (options.http) {
    app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));
    app.use(compression());
    app.setGlobalPrefix(config.get<string>('http.globalPrefix', 'api'));
    // URI versioning: /api/v1/... . A breaking change ships as a controller decorated
    // @Version('2') alongside the v1 one; ApiVersion.SUPPORTED controls what still answers.
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: ApiVersion.DEFAULT });
    // Web clients carry the refresh token in an httpOnly cookie; mobile clients in the body.
    app.use(cookieParser());

    const corsOrigins = config.get<string[]>('http.corsOrigins', []);
    const allowAnyOrigin = corsOrigins.includes('*');
    app.enableCors({
      // Browsers reject credentials with a wildcard origin, so '*' means "no cookies":
      // fine for a public read-only deployment, wrong for the storefront. Production
      // lists the web hosts explicitly and gets credentials.
      origin: allowAnyOrigin ? true : corsOrigins,
      credentials: !allowAnyOrigin,
      exposedHeaders: [
        Headers.CORRELATION_ID,
        Headers.API_VERSION,
        Headers.DEPRECATION,
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'Retry-After',
      ],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        Headers.CORRELATION_ID,
        Headers.IDEMPOTENCY_KEY,
        Headers.DEVICE_ID,
        Headers.APP_VERSION,
        Headers.PLATFORM,
        Headers.CLIENT,
      ],
      maxAge: 86_400,
    });

    if (options.swagger && !isProduction) {
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder()
          .setTitle(options.swagger.title)
          .setDescription(options.swagger.description)
          .setVersion(options.swagger.version)
          .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
          .addGlobalParameters(
            {
              name: Headers.CLIENT,
              in: 'header',
              required: false,
              description: 'ANDROID | IOS | WEB | ADMIN_WEB | VENDOR_WEB - identifies the calling client',
              schema: { type: 'string', enum: ['ANDROID', 'IOS', 'WEB', 'ADMIN_WEB', 'VENDOR_WEB'] },
            },
            {
              name: Headers.APP_VERSION,
              in: 'header',
              required: false,
              description: 'Semantic version of the app or web build, e.g. 2.4.1',
              schema: { type: 'string' },
            },
            {
              name: Headers.DEVICE_ID,
              in: 'header',
              required: false,
              description: 'Stable per-install identifier',
              schema: { type: 'string' },
            },
          )
          .build(),
      );
      SwaggerModule.setup('docs', app, document, {
        swaggerOptions: { persistAuthorization: true },
      });
    }
  }

  if (options.microservice) {
    const tcpPort = config.get<number>('tcpPort', 0);
    if (tcpPort > 0) {
      app.connectMicroservice<MicroserviceOptions>(
        {
          transport: Transport.TCP,
          options: {
            // 0.0.0.0 so the container is reachable from the gateway; these ports are
            // never published outside the compose/cluster network.
            host: '0.0.0.0',
            port: tcpPort,
          },
        },
        { inheritAppConfig: true },
      );
      await app.startAllMicroservices();
      logger.log(`TCP transport listening on :${tcpPort}`);
    }
  }

  const httpPort = config.get<number>('http.port', 3000);
  await app.listen(httpPort);

  logger.log(`${options.serviceName} ready on http://localhost:${httpPort}`);
  if (options.swagger && !isProduction) {
    logger.log(`API docs at http://localhost:${httpPort}/docs`);
  }

  return app;
}
