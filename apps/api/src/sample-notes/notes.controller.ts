import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { principalOf } from '../auth/auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { requireFlag } from '../flags/flags.module.js';
import { AuthzFailureMonitor } from '../security/authz-failure.monitor.js';
import { CreatedNoteDto, CreateNoteDto, NoteDto } from './notes.dto.js';
import { type Note, NotesRepository } from './notes.repository.js';

/** Sample entity proving the Step 2 exit criteria; behind `sample-patient-note`, removed in Step 3. */
@ApiTags('sample')
@ApiBearerAuth()
@Controller('v1/sample/notes')
@UseGuards(requireFlag('sample-patient-note'))
@Roles('patient')
export class NotesController {
  constructor(
    private readonly notes: NotesRepository,
    private readonly failures: AuthzFailureMonitor,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({ type: CreatedNoteDto })
  async create(@Body() body: CreateNoteDto, @Req() request: Request): Promise<CreatedNoteDto> {
    const note = await this.notes.create(principalOf(request).userId, body.body);
    return { id: note.id, createdAt: note.createdAt.toISOString() };
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: [NoteDto] })
  async list(@Req() request: Request): Promise<NoteDto[]> {
    return (await this.notes.listOwned(principalOf(request).userId)).map(toDto);
  }

  /** Owner only: anyone else gets 404, not 403, so IDs reveal nothing (SE-02.3). */
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: NoteDto })
  async read(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request,
  ): Promise<NoteDto> {
    const principal = principalOf(request);
    const note = await this.notes.findOwned(principal.userId, id);
    if (!note) {
      await this.failures.record(principal.userId);
      throw new NotFoundException();
    }
    return toDto(note);
  }
}

function toDto(note: Note): NoteDto {
  return { id: note.id, body: note.body, createdAt: note.createdAt.toISOString() };
}
