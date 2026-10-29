import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { reason } from '../common/error-response.js';
import type { Principal } from '../common/request-context.js';
import type { LinkedPatientDto, LinkedPatientInputDto } from './linked-patients.dto.js';
import { LinkedPatientsRepository } from './linked-patients.repository.js';

/** Linked patients an account may hold (default D-2). */
export const MAX_LINKED_PATIENTS = 10;
const ENTITY = 'linked_patient';

/**
 * Add, edit and remove the people an account books for (AC-03). Each change and its audit entry
 * commit together (SE-05); entries name the profile, never its details.
 */
@Injectable()
export class LinkedPatientsService {
  constructor(
    private readonly linked: LinkedPatientsRepository,
    private readonly audit: AuditService,
  ) {}

  list(principal: Principal): Promise<LinkedPatientDto[]> {
    return this.linked.list(principal.userId);
  }

  async add(principal: Principal, input: LinkedPatientInputDto): Promise<LinkedPatientDto> {
    assertPlausibleYear(input.birthYear);
    const id = await this.linked.transaction(async (client) => {
      if ((await this.linked.countLocked(client, principal.userId)) >= MAX_LINKED_PATIENTS) {
        throw reason(ConflictException, 'linked_patient_limit');
      }
      const created = await this.linked.create(client, principal.userId, input);
      await this.audit.record(
        { action: 'linked_patient.added', entity: ENTITY, entityId: created },
        client,
      );
      return created;
    });
    const { fullName, birthYear, gender, relationship } = input;
    return { id, fullName, birthYear, gender, relationship };
  }

  async edit(principal: Principal, id: string, input: LinkedPatientInputDto): Promise<void> {
    assertPlausibleYear(input.birthYear);
    await this.linked.transaction(async (client) => {
      if (!(await this.linked.update(client, principal.userId, id, input))) {
        throw new NotFoundException();
      }
      await this.audit.record(
        { action: 'linked_patient.edited', entity: ENTITY, entityId: id },
        client,
      );
    });
  }

  async remove(principal: Principal, id: string): Promise<void> {
    await this.linked.transaction(async (client) => {
      if (!(await this.linked.remove(client, principal.userId, id))) throw new NotFoundException();
      await this.audit.record(
        { action: 'linked_patient.removed', entity: ENTITY, entityId: id },
        client,
      );
    });
  }
}

/** Not born in the future; the database bounds the rest. */
function assertPlausibleYear(year: number): void {
  if (year > new Date().getFullYear()) throw reason(BadRequestException, 'birth_year_invalid');
}
