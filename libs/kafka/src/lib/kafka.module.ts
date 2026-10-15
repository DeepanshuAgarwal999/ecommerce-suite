import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, logLevel } from 'kafkajs';
import { KafkaConsumerService } from './kafka-consumer.service';
import { KafkaProducerService } from './kafka-producer.service';
import { KAFKA_CLIENT, KAFKA_OPTIONS, KafkaModuleOptions } from './kafka.constants';
import { KafkaAdminService } from './kafka-admin.service';
import { KafkaTopicInitializer } from './kafka-topic.initializer';

function buildKafka(options: KafkaModuleOptions): Kafka {
  return new Kafka({
    clientId: options.clientId,
    brokers: options.brokers,
    ssl: options.ssl,
    sasl: options.sasl,
    logLevel: options.logLevel ?? logLevel.WARN,
    connectionTimeout: options.connectionTimeout ?? 10_000,
    requestTimeout: options.requestTimeout ?? 30_000,
    retry: { initialRetryTime: 300, retries: 10, maxRetryTime: 30_000 },
  });
}

@Global()
@Module({})
export class KafkaModule {
  static forRoot(options: KafkaModuleOptions): DynamicModule {
    const providers: Provider[] = [
      { provide: KAFKA_OPTIONS, useValue: options },
      { provide: KAFKA_CLIENT, useFactory: () => buildKafka(options) },
      KafkaProducerService,
      KafkaConsumerService,
      KafkaAdminService,
      KafkaTopicInitializer,
    ];

    return {
      module: KafkaModule,
      providers,
      exports: [KAFKA_CLIENT, KAFKA_OPTIONS, KafkaProducerService, KafkaConsumerService, KafkaAdminService],
    };
  }

  static forRootAsync(clientId: string): DynamicModule {
    const providers: Provider[] = [
      {
        provide: KAFKA_OPTIONS,
        inject: [ConfigService],
        useFactory: (config: ConfigService): KafkaModuleOptions => ({
          clientId,
          brokers: config.get<string>('kafka.brokers', 'localhost:9092').split(','),
          ssl: config.get<boolean>('kafka.ssl', false),
          producer: {
            idempotent: config.get<boolean>('kafka.idempotentProducer', true),
            acks: -1,
          },
          consumer: {
            sessionTimeout: config.get<number>('kafka.sessionTimeout', 30_000),
            retries: config.get<number>('kafka.consumerRetries', 3),
          },
        }),
      },
      {
        provide: KAFKA_CLIENT,
        inject: [KAFKA_OPTIONS],
        useFactory: (options: KafkaModuleOptions) => buildKafka(options),
      },
      KafkaProducerService,
      KafkaConsumerService,
      KafkaAdminService,
      KafkaTopicInitializer,
    ];

    return {
      module: KafkaModule,
      providers,
      exports: [KAFKA_CLIENT, KAFKA_OPTIONS, KafkaProducerService, KafkaConsumerService, KafkaAdminService],
    };
  }
}
