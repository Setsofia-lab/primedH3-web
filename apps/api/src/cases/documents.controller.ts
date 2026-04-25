/**
 * Documents — per-case file attachments backed by S3.
 *
 * Two-step upload (necessary because PHI must never round-trip through
 * our api server's memory):
 *
 *   1. POST /documents/upload-url
 *      Body: { caseId, name, contentType, sizeBytes?, kind?, patientVisible? }
 *      Returns: { documentId, uploadUrl, expiresIn }
 *      The api inserts a "pending" documents row (with a deterministic
 *      s3 key) AND mints a presigned PUT URL valid for 5 minutes. The
 *      browser PUTs the file directly to S3.
 *
 *   2. (No explicit "finalize" needed — the row exists with size=null
 *      until reads compute it; in practice we store sizeBytes from the
 *      client at request time.)
 *
 *   3. GET /documents?caseId=…   — list, scoped by case visibility +
 *                                  patient_visible for patients.
 *      GET /documents/:id/download-url — presigned GET, 5-min TTL.
 *
 * Visibility (mirrors messages):
 *   - admin/surgeon/coordinator/anesthesia/allied see every doc on a
 *     case they can see.
 *   - patient sees only patient_visible=true docs on their case.
 */
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CurrentUserRow } from '../auth/current-user-row.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthContext } from '../auth/auth-context';
import type { AppConfig } from '../config/config.module';
import { DB_CLIENT, type PrimedDb } from '../db/db.module';
import { cases, documents, patients, type Document, type User } from '../db/schema';
import {
  listDocumentsQuerySchema,
  requestUploadSchema,
  type ListDocumentsQuery,
  type RequestUploadInput,
} from '../admin/dto/admin.schemas';
import { ZodBodyPipe } from '../admin/zod-body.pipe';
import { ZodQueryPipe } from '../admin/zod-query.pipe';
import { meta } from '../admin/audit-meta';

interface UploadResponse {
  document: Document;
  uploadUrl: string;
  expiresIn: number;
}
interface DownloadResponse {
  url: string;
  expiresIn: number;
}

const PRESIGN_TTL_SECONDS = 300; // 5 minutes

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
@Roles('admin', 'surgeon', 'anesthesia', 'coordinator', 'allied', 'patient')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);
  private readonly s3: S3Client;
  private readonly bucket: string | undefined;

  constructor(
    @Inject(DB_CLIENT) private readonly db: PrimedDb,
    private readonly audit: AuditService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {
    this.bucket = this.config.get('UPLOADS_BUCKET', { infer: true }) ?? undefined;
    const region =
      this.config.get('AWS_REGION', { infer: true }) ??
      this.config.get('COGNITO_REGION', { infer: true }) ??
      'us-east-1';
    this.s3 = new S3Client({ region });
    if (!this.bucket) {
      this.logger.warn('UPLOADS_BUCKET not set — document upload + download will 500');
    }
  }

  @Get()
  @ApiOperation({ summary: 'List documents on a case (scoped by visibility)' })
  async list(
    @CurrentUserRow() me: User,
    @Query(new ZodQueryPipe(listDocumentsQuerySchema)) query: ListDocumentsQuery,
  ): Promise<{ items: readonly Document[]; limit: number; offset: number }> {
    const visibleCaseIds = await this.visibleCaseIds(me);
    if (visibleCaseIds === null) {
      // admin: no case-id restriction
    } else if (visibleCaseIds.length === 0) {
      return { items: [], limit: query.limit, offset: query.offset };
    }
    const clauses: SQL[] = [];
    if (visibleCaseIds !== null) clauses.push(inArray(documents.caseId, [...visibleCaseIds]));
    if (query.caseId) clauses.push(eq(documents.caseId, query.caseId));
    if (query.kind) clauses.push(eq(documents.kind, query.kind));
    if (me.role === 'patient') clauses.push(eq(documents.patientVisible, true));
    const where = clauses.length > 0 ? and(...clauses) : undefined;

    const items = await this.db
      .select()
      .from(documents)
      .where(where)
      .orderBy(asc(documents.createdAt))
      .limit(query.limit)
      .offset(query.offset);
    return { items, limit: query.limit, offset: query.offset };
  }

  @Post('upload-url')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Insert a document row + return a 5-min presigned PUT URL',
  })
  async requestUpload(
    @CurrentUser() ctx: AuthContext,
    @CurrentUserRow() me: User,
    @Body(new ZodBodyPipe(requestUploadSchema)) input: RequestUploadInput,
    @Req() req: FastifyRequest,
  ): Promise<UploadResponse> {
    if (!this.bucket) {
      throw new InternalServerErrorException('uploads bucket not configured');
    }
    const caseRow = await this.fetchCaseIfVisible(me, input.caseId);
    const docId = randomUUID();
    const safeName = input.name.replace(/[^\w.\-]/g, '_').slice(0, 200);
    const s3Key = `cases/${caseRow.id}/${docId}/${safeName}`;
    // Default: education docs visible to patient; everything else hidden
    // unless explicitly toggled.
    const patientVisible =
      input.patientVisible ?? (input.kind === 'education' || input.kind === 'consent');

    const [row] = await this.db
      .insert(documents)
      .values({
        id: docId,
        facilityId: caseRow.facilityId,
        caseId: caseRow.id,
        name: input.name,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes ?? null,
        s3Key,
        kind: input.kind ?? 'other',
        patientVisible,
        uploadedByUserId: me.id,
        createdBy: me.id,
      })
      .returning();

    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        ContentType: input.contentType,
      }),
      { expiresIn: PRESIGN_TTL_SECONDS },
    );

    await this.audit.record(
      this.audit.fromContext(ctx, me),
      {
        action: 'create',
        resourceType: 'document',
        resourceId: row!.id,
        targetFacilityId: row!.facilityId,
        after: {
          caseId: row!.caseId,
          name: row!.name,
          kind: row!.kind,
          patientVisible: row!.patientVisible,
          contentType: row!.contentType,
        },
      },
      meta(req),
    );

    return { document: row!, uploadUrl, expiresIn: PRESIGN_TTL_SECONDS };
  }

  @Get(':id/download-url')
  @ApiOperation({ summary: 'Mint a 5-min presigned GET URL for a document' })
  async download(
    @CurrentUserRow() me: User,
    @Param('id') id: string,
  ): Promise<DownloadResponse> {
    if (!this.bucket) {
      throw new InternalServerErrorException('uploads bucket not configured');
    }
    const [row] = await this.db.select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!row) throw new NotFoundException(`document ${id} not found`);
    // Visibility: must be able to see the parent case.
    await this.fetchCaseIfVisible(me, row.caseId);
    if (me.role === 'patient' && !row.patientVisible) {
      throw new NotFoundException(`document ${id} not found`);
    }
    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: row.s3Key,
        ResponseContentDisposition: `attachment; filename="${row.name.replace(/"/g, '')}"`,
      }),
      { expiresIn: PRESIGN_TTL_SECONDS },
    );
    return { url, expiresIn: PRESIGN_TTL_SECONDS };
  }

  // ---- internals ----

  private async visibleCaseIds(me: User): Promise<readonly string[] | null> {
    if (me.role === 'admin') return null;
    if (me.role === 'patient') {
      const linked = await this.db
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.userId, me.id));
      const patientIds = linked.map((r) => r.id);
      if (patientIds.length === 0) return [];
      const rows = await this.db
        .select({ id: cases.id })
        .from(cases)
        .where(inArray(cases.patientId, patientIds));
      return rows.map((r) => r.id);
    }
    const clauses: SQL[] = [];
    if (me.role === 'surgeon') clauses.push(eq(cases.surgeonId, me.id));
    else if (me.facilityId) clauses.push(eq(cases.facilityId, me.facilityId));
    else return [];
    const rows = await this.db
      .select({ id: cases.id })
      .from(cases)
      .where(and(...clauses));
    return rows.map((r) => r.id);
  }

  private async fetchCaseIfVisible(me: User, caseId: string) {
    const [row] = await this.db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
    if (!row) throw new NotFoundException(`case ${caseId} not found`);
    if (me.role === 'admin') return row;
    if (me.role === 'surgeon' && row.surgeonId !== me.id) {
      throw new ForbiddenException('case not visible');
    }
    if (
      (me.role === 'coordinator' || me.role === 'allied' || me.role === 'anesthesia') &&
      (!me.facilityId || row.facilityId !== me.facilityId)
    ) {
      throw new ForbiddenException('case not visible');
    }
    if (me.role === 'patient') {
      const [link] = await this.db
        .select({ id: patients.id })
        .from(patients)
        .where(and(eq(patients.userId, me.id), eq(patients.id, row.patientId)))
        .limit(1);
      if (!link) throw new ForbiddenException('case not visible');
    }
    return row;
  }
}
