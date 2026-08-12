import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      // Elimina del payload las propiedades sin decorador del DTO
      whitelist: true,
      // Rechaza (400) las peticiones con propiedades desconocidas
      forbidNonWhitelisted: true,
      // Convierte el payload en instancias de las clases DTO
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
