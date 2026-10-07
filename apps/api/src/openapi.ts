import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/** The API's OpenAPI document. Served at /docs and exported to @heach/types. */
export function buildOpenApiDocument(app: INestApplication, version: string): OpenAPIObject {
  const config = new DocumentBuilder().setTitle('HEACH API').setVersion(version).build();
  return SwaggerModule.createDocument(app, config);
}
