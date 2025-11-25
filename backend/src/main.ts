import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api')

  const swaggerConfig = new DocumentBuilder()
    .setTitle('codex-oauth')
    .setDescription('API for managing Codex-style auth.json tokens')
    .setVersion('1.0')
    .build()

  const apiDocument = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('api/docs', app, apiDocument)

  const port = process.env.PORT ?? 3000
  await app.listen(port)
   
  console.log(`codex-oauth server listening on http://localhost:${port}`)
}

bootstrap().catch((err) => {
   
  console.error('Failed to bootstrap NestJS application', err)
  process.exit(1)
})
