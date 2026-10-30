import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export const CONTENT_LOCALES = ['or', 'en', 'hi'] as const;
export const PAGE_SLUGS = ['terms', 'privacy', 'faq', 'refunds'] as const;
export type PageSlug = (typeof PAGE_SLUGS)[number];

export class TemplateDto {
  @ApiProperty()
  template!: string;

  @ApiProperty({ enum: CONTENT_LOCALES })
  locale!: string;

  @ApiProperty({ description: 'The catalogue text shipped with the release' })
  defaultText!: string;

  @ApiProperty({ type: String, nullable: true, description: 'The edited text in use instead' })
  override!: string | null;

  @ApiProperty({ type: [String], description: 'Placeholders an edited text must keep' })
  placeholders!: string[];
}

export class TemplateInputDto {
  @ApiPropertyOptional({ type: String, nullable: true, description: 'null restores the default' })
  @IsOptional()
  @IsString()
  @Length(1, 480)
  text?: string | null;
}

export class PageDto {
  @ApiProperty({ enum: PAGE_SLUGS })
  slug!: string;

  @ApiProperty({ enum: CONTENT_LOCALES })
  locale!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ description: 'Plain text; blank lines separate paragraphs' })
  body!: string;

  @ApiProperty()
  updatedAt!: Date;
}

export class PageInputDto {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  title!: string;

  @ApiProperty({ minLength: 1, maxLength: 50000 })
  @IsString()
  @Length(1, 50000)
  body!: string;
}

export class PageQueryDto {
  @ApiPropertyOptional({ enum: CONTENT_LOCALES })
  @IsOptional()
  @IsIn(CONTENT_LOCALES)
  locale?: (typeof CONTENT_LOCALES)[number];
}
